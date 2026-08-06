import { Injectable } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  setDoc
} from 'firebase/firestore';
import { firebaseApp, firebaseAuth } from '../firebase/firebase.config';
import { BabyProfileService } from './baby-profile.service';
import { CaregiverSharingService } from './caregiver-sharing.service';
import { PhotoStorageService } from './photo-storage.service';

interface PendingDeletion {
  ownerId: string;
  profileId: string;
  profileDeleted: boolean;
  photosDeleted: boolean;
  invitesDeleted: boolean;
  requestsDeleted: boolean;
  sharedDataDeleted: boolean;
}

const PENDING_DELETION_KEY = 'baby_tracker_pending_profile_deletion';

@Injectable({ providedIn: 'root' })
export class BabyDeletionService {
  private readonly firestore = getFirestore(firebaseApp);

  constructor(
    private readonly profiles: BabyProfileService,
    private readonly sharing: CaregiverSharingService,
    private readonly photos: PhotoStorageService
  ) {}

  async deleteProfile(profileId: string): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (!user || !this.sharing.canManageBabyProfiles) {
      throw new Error('Only the family owner can delete this baby profile.');
    }

    const existing = await this.readPending(user.uid);
    for (const job of existing.filter(item => item.profileId !== profileId)) {
      await this.run(job);
    }

    const matching = existing.find(item => item.profileId === profileId);
    const pending = matching
      ? matching
      : {
          ownerId: user.uid,
          profileId,
          profileDeleted: false,
          photosDeleted: false,
          invitesDeleted: false,
          requestsDeleted: false,
          sharedDataDeleted: false
        };
    await this.savePending(pending);
    await this.run(pending);
  }

  async resumePendingDeletion(): Promise<boolean> {
    const user = firebaseAuth.currentUser;
    if (!user || !this.sharing.canManageBabyProfiles) return false;
    const pending = await this.readPending(user.uid);
    for (const job of pending) await this.run(job);
    return pending.length > 0;
  }

  private async run(pending: PendingDeletion): Promise<void> {
    if (!pending.profileDeleted) {
      const stillExists = this.profiles.profiles.some(
        profile => profile.id === pending.profileId
      );
      if (stillExists && !this.profiles.deleteProfile(pending.profileId)) {
        throw new Error(
          'Keep at least one baby in your family account. Add another baby before deleting this profile.'
        );
      }
      await this.profiles.waitForSync();
      pending.profileDeleted = true;
      await this.savePending(pending);
    }

    if (!pending.photosDeleted) {
      await this.photos.deletePhotosForProfile(pending.profileId);
      pending.photosDeleted = true;
      await this.savePending(pending);
    }

    if (!pending.invitesDeleted) {
      await this.sharing.revokeInvitesForProfile(pending.profileId);
      pending.invitesDeleted = true;
      await this.savePending(pending);
    }

    if (!pending.requestsDeleted) {
      await this.sharing.revokeRequestsForProfile(pending.profileId);
      pending.requestsDeleted = true;
      await this.savePending(pending);
    }

    if (!pending.sharedDataDeleted) {
      const snapshot = await getDocs(collection(
        this.firestore,
        'users', pending.ownerId,
        'sharedProfiles', pending.profileId,
        'trackerData'
      ));
      await Promise.all(snapshot.docs.map(item => deleteDoc(item.ref)));
      pending.sharedDataDeleted = true;
      await this.savePending(pending);
    }

    // This is deliberately last: caregivers retain access while cleanup is
    // retrying, but the deleted profile data is no longer available to read.
    await this.sharing.removeCaregiversForProfile(pending.profileId);
    await deleteDoc(this.jobReference(pending.ownerId, pending.profileId));
    localStorage.removeItem(PENDING_DELETION_KEY);
  }

  private async readPending(ownerId: string): Promise<PendingDeletion[]> {
    const local = this.readLegacyLocalPending();
    if (local?.ownerId === ownerId) {
      await this.savePending(local);
      localStorage.removeItem(PENDING_DELETION_KEY);
    }

    const snapshot = await getDocs(collection(
      this.firestore, 'users', ownerId, 'deletionJobs'
    ));
    return snapshot.docs.map(item => ({
      ownerId,
      profileId: item.id,
      profileDeleted: item.data()['profileDeleted'] === true,
      photosDeleted: item.data()['photosDeleted'] === true,
      invitesDeleted: item.data()['invitesDeleted'] === true,
      requestsDeleted: item.data()['requestsDeleted'] === true,
      sharedDataDeleted: item.data()['sharedDataDeleted'] === true
    }));
  }

  private readLegacyLocalPending(): PendingDeletion | null {
    try {
      const value = JSON.parse(
        localStorage.getItem(PENDING_DELETION_KEY) || 'null'
      ) as PendingDeletion | null;
      return value?.ownerId && value.profileId ? value : null;
    } catch {
      localStorage.removeItem(PENDING_DELETION_KEY);
      return null;
    }
  }

  private async savePending(pending: PendingDeletion): Promise<void> {
    await setDoc(this.jobReference(pending.ownerId, pending.profileId), {
      ownerId: pending.ownerId,
      profileId: pending.profileId,
      profileDeleted: pending.profileDeleted,
      photosDeleted: pending.photosDeleted,
      invitesDeleted: pending.invitesDeleted,
      requestsDeleted: pending.requestsDeleted,
      sharedDataDeleted: pending.sharedDataDeleted,
      updatedAt: Date.now()
    });
  }

  private jobReference(ownerId: string, profileId: string) {
    return doc(
      this.firestore, 'users', ownerId, 'deletionJobs', profileId
    );
  }
}
