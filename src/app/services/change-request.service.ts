import { Injectable } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch
} from 'firebase/firestore';
import { firebaseApp, firebaseAuth } from '../firebase/firebase.config';
import { trackerStorage } from '../firebase/tracker-storage';

export interface CaregiverChangeRequest {
  id: string;
  key: string;
  value: string;
  baseValue: string;
  operation: 'set' | 'remove';
  caregiverId: string;
  caregiverName: string;
  createdAt: number;
  profileId?: string;
  changeGroupId?: string;
  companionIds?: string[];
}

@Injectable({ providedIn: 'root' })
export class ChangeRequestService {
  private readonly firestore = getFirestore(firebaseApp);

  async list(): Promise<CaregiverChangeRequest[]> {
    const user = firebaseAuth.currentUser;
    if (!user || trackerStorage.currentAccessRole !== 'owner') return [];
    const snapshot = await getDocs(collection(
      this.firestore,
      'users',
      user.uid,
      'changeRequests'
    ));
    return this.groupTimelineCompanions(snapshot.docs
      .map(item => ({
        id: item.id,
        ...(item.data() as Omit<CaregiverChangeRequest, 'id'>)
      }))
      .sort((a, b) => b.createdAt - a.createdAt));
  }

  async listMine(ownerId: string): Promise<CaregiverChangeRequest[]> {
    const user = firebaseAuth.currentUser;
    if (
      !user ||
      !ownerId ||
      trackerStorage.currentAccessRole !== 'editor'
    ) return [];

    const snapshot = await getDocs(query(
      collection(this.firestore, 'users', ownerId, 'changeRequests'),
      where('caregiverId', '==', user.uid)
    ));
    return this.groupTimelineCompanions(snapshot.docs
      .map(item => ({
        id: item.id,
        ...(item.data() as Omit<CaregiverChangeRequest, 'id'>)
      }))
      .sort((a, b) => b.createdAt - a.createdAt));
  }

  watchCount(
    ownerId: string,
    caregiverId: string | null,
    callback: (count: number) => void
  ): () => void {
    const base = collection(this.firestore, 'users', ownerId, 'changeRequests');
    const source = caregiverId ? query(base, where('caregiverId', '==', caregiverId)) : base;
    return onSnapshot(source, snapshot => {
      const requests = this.groupTimelineCompanions(snapshot.docs.map(item => ({
        id: item.id,
        ...(item.data() as Omit<CaregiverChangeRequest, 'id'>)
      })));
      callback(requests.length);
    }, () => callback(0));
  }

  async approve(requestId: string): Promise<void> {
    await this.approveMany([requestId]);
  }

  async approveMany(requestIds: string[]): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (!user || trackerStorage.currentAccessRole !== 'owner') {
      throw new Error('Only the family owner can approve changes.');
    }

    await runTransaction(this.firestore, async transaction => {
      const requestReferences = requestIds.map(requestId => doc(
        this.firestore, 'users', user.uid, 'changeRequests', requestId
      ));
      const profilesReference = doc(
        this.firestore, 'users', user.uid, 'trackerData',
        encodeURIComponent('baby_profiles_v2')
      );
      const activeProfileReference = doc(
        this.firestore, 'users', user.uid, 'trackerData',
        encodeURIComponent('active_baby_profile_id')
      );
      const [requestSnapshots, profilesSnapshot, activeProfileSnapshot] = await Promise.all([
        Promise.all(requestReferences.map(reference => transaction.get(reference))),
        transaction.get(profilesReference),
        transaction.get(activeProfileReference)
      ]);
      const requests = requestSnapshots
        .map((snapshot, index) => snapshot.exists() ? {
          reference: requestReferences[index],
          data: snapshot.data() as Omit<CaregiverChangeRequest, 'id'>
        } : null)
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      const profiles = this.profileIdsFromValue(
        profilesSnapshot.exists() ? String(profilesSnapshot.data()['value'] || '') : ''
      );
      const activeProfileId = activeProfileSnapshot.exists()
        ? String(activeProfileSnapshot.data()['value'] || '')
        : localStorage.getItem('baby_tracker_device_active_profile_id') || '';
      if (!profiles.size) {
        throw new Error('Unable to load the family baby profiles.');
      }

      const candidateKeys: string[] = [];
      for (const request of requests) {
        for (const profileId of profiles) {
          candidateKeys.push(
            profileId === activeProfileId
              ? request.data.key
              : `baby_profile_data:${profileId}:${request.data.key}`
          );
        }
      }
      const uniqueKeys = [...new Set(candidateKeys)];
      const targetReferences = new Map(uniqueKeys.map(key => [key, doc(
        this.firestore,
        'users',
        user.uid,
        'trackerData',
        encodeURIComponent(key)
      )]));
      const targetSnapshots = await Promise.all(
        uniqueKeys.map(key => transaction.get(targetReferences.get(key)!))
      );
      const values = new Map(uniqueKeys.map((key, index) => [
        key,
        targetSnapshots[index].exists()
          ? String(targetSnapshots[index].data()['value'] || '')
          : ''
      ]));

      const resolvedProfileIds = requests.map(request => {
        if (request.data.profileId && profiles.has(request.data.profileId)) {
          return request.data.profileId;
        }
        const matches = [...profiles].filter(profileId => {
          const key = profileId === activeProfileId
            ? request.data.key
            : `baby_profile_data:${profileId}:${request.data.key}`;
          return (values.get(key) || '') === request.data.baseValue;
        });
        if (matches.length === 1) return matches[0];
        throw new Error(
          'This older request is not linked to one specific baby. Reject it and ask the caregiver to submit it again.'
        );
      });
      const targetKeys = requests.map((request, index) =>
        resolvedProfileIds[index] === activeProfileId
          ? request.data.key
          : `baby_profile_data:${resolvedProfileIds[index]}:${request.data.key}`
      );

      requests.forEach((request, index) => {
        const key = targetKeys[index];
        const currentValue = values.get(key) || '';
        const nextValue = this.mergeApprovedValue(request.data, currentValue);
        values.set(key, nextValue);
        transaction.delete(request.reference);
      });

      for (const key of new Set(targetKeys)) {
        const value = values.get(key) || '';
        const reference = targetReferences.get(key)!;
        if (!value) transaction.delete(reference);
        else transaction.set(reference, { key, value, updatedAt: serverTimestamp() });
      }
    });
  }

  async reject(requestId: string): Promise<void> {
    await this.rejectMany([requestId]);
  }

  async rejectMany(requestIds: string[]): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (!user || trackerStorage.currentAccessRole !== 'owner') {
      throw new Error('Only the family owner can reject changes.');
    }
    for (let index = 0; index < requestIds.length; index += 400) {
      const batch = writeBatch(this.firestore);
      requestIds.slice(index, index + 400).forEach(requestId => batch.delete(doc(
        this.firestore, 'users', user.uid, 'changeRequests', requestId
      )));
      await batch.commit();
    }
  }

  async cancelMine(ownerId: string, requestId: string): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (
      !user ||
      !ownerId ||
      trackerStorage.currentAccessRole !== 'editor'
    ) {
      throw new Error('Only the caregiver who submitted this request can cancel it.');
    }
    await deleteDoc(doc(
      this.firestore,
      'users',
      ownerId,
      'changeRequests',
      requestId
    ));
  }

  async cancelMineMany(ownerId: string, requestIds: string[]): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (!user || !ownerId || trackerStorage.currentAccessRole !== 'editor') {
      throw new Error('Only the caregiver who submitted these requests can cancel them.');
    }
    for (let index = 0; index < requestIds.length; index += 400) {
      const batch = writeBatch(this.firestore);
      requestIds.slice(index, index + 400).forEach(requestId => batch.delete(doc(
        this.firestore, 'users', ownerId, 'changeRequests', requestId
      )));
      await batch.commit();
    }
  }

  private mergeApprovedValue(
    request: Omit<CaregiverChangeRequest, 'id'>,
    currentValue: string
  ): string {
    if (request.operation === 'remove') {
      if (currentValue !== request.baseValue) {
        throw new Error('One selected request conflicts with newer family data.');
      }
      return '';
    }
    if (currentValue === request.baseValue) return request.value;

    try {
      const base = JSON.parse(request.baseValue) as unknown;
      const proposed = JSON.parse(request.value) as unknown;
      const current = JSON.parse(currentValue) as unknown;
      if (!Array.isArray(base) || !Array.isArray(proposed) || !Array.isArray(current)) {
        throw new Error();
      }
      if (this.allHaveIds([...base, ...proposed, ...current])) {
        const baseById = new Map(base.map(item => [String(item.id), JSON.stringify(item)]));
        const proposedById = new Map(proposed.map(item => [String(item.id), item]));
        const mergedById = new Map(current.map(item => [String(item.id), item]));
        for (const id of baseById.keys()) {
          if (!proposedById.has(id)) mergedById.delete(id);
        }
        for (const [id, item] of proposedById) {
          if (baseById.get(id) !== JSON.stringify(item)) mergedById.set(id, item);
        }
        return JSON.stringify([...mergedById.values()]);
      }
      const baseItems = new Set(base.map(item => JSON.stringify(item)));
      const proposedItems = new Set(proposed.map(item => JSON.stringify(item)));
      const merged = current.filter(item => !baseItems.has(JSON.stringify(item)) || proposedItems.has(JSON.stringify(item)));
      const mergedItems = new Set(merged.map(item => JSON.stringify(item)));
      proposed.forEach(item => {
        const serialized = JSON.stringify(item);
        if (!baseItems.has(serialized) && !mergedItems.has(serialized)) merged.push(item);
      });
      return JSON.stringify(merged);
    } catch {
      throw new Error('One selected request conflicts with newer family data.');
    }
  }

  private profileIdsFromValue(value: string): Set<string> {
    try {
      const profiles = JSON.parse(value || '[]') as Array<{ id?: unknown }>;
      return new Set(profiles
        .filter(profile => typeof profile?.id === 'string')
        .map(profile => String(profile.id)));
    } catch {
      return new Set();
    }
  }

  private allHaveIds(items: unknown[]): items is Array<Record<string, unknown> & { id: unknown }> {
    return items.every(item => item !== null && typeof item === 'object' && 'id' in item);
  }

  private groupTimelineCompanions(
    requests: CaregiverChangeRequest[]
  ): CaregiverChangeRequest[] {
    const timelineRequests = requests.filter(item => item.key === 'baby_activities');
    const hiddenTimelineIds = new Set<string>();

    for (const request of requests) {
      if (request.key === 'baby_activities') continue;
      const changedIds = this.changedRecordIds(request);
      if (!changedIds.size) continue;
      const companion = timelineRequests.find(timeline =>
        !hiddenTimelineIds.has(timeline.id) &&
        timeline.caregiverId === request.caregiverId &&
        (
          Boolean(request.changeGroupId) &&
          timeline.changeGroupId === request.changeGroupId
          || Math.abs(timeline.createdAt - request.createdAt) < 10_000
        ) &&
        [...this.changedRecordIds(timeline)].some(id => changedIds.has(id))
      );
      if (companion) {
        request.companionIds = [companion.id];
        hiddenTimelineIds.add(companion.id);
      }
    }

    return requests.filter(request => !hiddenTimelineIds.has(request.id));
  }

  private changedRecordIds(request: CaregiverChangeRequest): Set<string> {
    try {
      const before = JSON.parse(request.baseValue || '[]') as unknown;
      const after = JSON.parse(request.value || '[]') as unknown;
      if (!Array.isArray(before) || !Array.isArray(after)) return new Set();
      const beforeById = new Map(before
        .filter(item => item && typeof item === 'object' && 'id' in item)
        .map(item => [String((item as { id: unknown }).id), JSON.stringify(item)]));
      const afterById = new Map(after
        .filter(item => item && typeof item === 'object' && 'id' in item)
        .map(item => [String((item as { id: unknown }).id), JSON.stringify(item)]));
      return new Set([...new Set([...beforeById.keys(), ...afterById.keys()])]
        .filter(id => beforeById.get(id) !== afterById.get(id)));
    } catch {
      return new Set();
    }
  }
}
