import { Injectable } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  where
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

  async approve(requestId: string): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (!user || trackerStorage.currentAccessRole !== 'owner') {
      throw new Error('Only the family owner can approve changes.');
    }
    const reference = doc(
      this.firestore,
      'users',
      user.uid,
      'changeRequests',
      requestId
    );
    const snapshot = await getDoc(reference);
    if (!snapshot.exists()) throw new Error('This request is no longer available.');
    const request = snapshot.data() as Omit<CaregiverChangeRequest, 'id'>;
    if ((trackerStorage.getItem(request.key) || '') !== request.baseValue) {
      throw new Error(
        'Family records changed after this request was submitted. Reject it and ask the caregiver to submit it again.'
      );
    }
    if (request.operation === 'remove') trackerStorage.removeItem(request.key);
    else trackerStorage.setItem(request.key, request.value);
    await trackerStorage.waitForSync();
    await deleteDoc(reference);
  }

  async approveMany(requestIds: string[]): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (!user || trackerStorage.currentAccessRole !== 'owner') {
      throw new Error('Only the family owner can approve changes.');
    }

    for (const requestId of requestIds) {
      const reference = doc(
        this.firestore,
        'users',
        user.uid,
        'changeRequests',
        requestId
      );
      const snapshot = await getDoc(reference);
      if (!snapshot.exists()) continue;
      const request = snapshot.data() as Omit<CaregiverChangeRequest, 'id'>;
      const currentValue = trackerStorage.getItem(request.key) || '';
      const nextValue = this.mergeApprovedValue(request, currentValue);
      if (request.operation === 'remove') trackerStorage.removeItem(request.key);
      else trackerStorage.setItem(request.key, nextValue);
      await trackerStorage.waitForSync();
      await deleteDoc(reference);
    }
  }

  async reject(requestId: string): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (!user || trackerStorage.currentAccessRole !== 'owner') {
      throw new Error('Only the family owner can reject changes.');
    }
    await deleteDoc(doc(
      this.firestore,
      'users',
      user.uid,
      'changeRequests',
      requestId
    ));
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
    for (const requestId of requestIds) {
      await this.cancelMine(ownerId, requestId);
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
      const baseItems = new Set(base.map(item => JSON.stringify(item)));
      const proposedItems = new Set(proposed.map(item => JSON.stringify(item)));
      const removed = new Set(
        [...baseItems].filter(item => !proposedItems.has(item))
      );
      const merged = current.filter(item => !removed.has(JSON.stringify(item)));
      const mergedItems = new Set(merged.map(item => JSON.stringify(item)));
      for (const item of proposed) {
        const serialized = JSON.stringify(item);
        if (!baseItems.has(serialized) && !mergedItems.has(serialized)) {
          merged.push(item);
          mergedItems.add(serialized);
        }
      }
      return JSON.stringify(merged);
    } catch {
      throw new Error('One selected request conflicts with newer family data.');
    }
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
        Math.abs(timeline.createdAt - request.createdAt) < 10_000 &&
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
