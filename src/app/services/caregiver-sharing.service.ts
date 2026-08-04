import { Injectable } from '@angular/core';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import {
  firebaseApp,
  firebaseAuth
} from '../firebase/firebase.config';
import { trackerStorage } from '../firebase/tracker-storage';
import { BabyProfileService } from './baby-profile.service';

export interface CaregiverInviteDetails {
  ownerName: string;
  babyName: string;
  expiresAt: number;
}

export interface CaregiverMember {
  id: string;
  displayName: string;
  email: string;
  role: 'editor' | 'viewer';
  joinedAt: number;
}

export interface SharedFamily {
  ownerId: string;
  ownerName: string;
  joinedAt: number;
}

@Injectable({ providedIn: 'root' })
export class CaregiverSharingService {
  private readonly firestore =
    getFirestore(firebaseApp);

  constructor(
    private readonly babyProfileService: BabyProfileService
  ) {}

  get isSharingAnotherFamily(): boolean {
    return trackerStorage.isUsingSharedFamily;
  }

  get familyOwnerId(): string {
    return trackerStorage.currentDataOwnerId;
  }

  get canEditCurrentFamily(): boolean {
    return trackerStorage.canEditCurrentData;
  }

  get currentFamilyRole(): 'owner' | 'editor' | 'viewer' {
    return trackerStorage.currentAccessRole;
  }

  get canManageBabyProfiles(): boolean {
    return this.currentFamilyRole === 'owner';
  }

  async createInvite(): Promise<string> {
    const user = firebaseAuth.currentUser;
    if (!user) throw new Error('Sign in first.');
    if (!this.canManageBabyProfiles) {
      throw new Error('Only the family owner can invite caregivers.');
    }

    const code = this.createCode();
    await setDoc(
      doc(this.firestore, 'caregiverInvites', code),
      {
        ownerId: user.uid,
        ownerName: user.displayName || 'Baby’s family',
        babyName:
          this.babyProfileService.activeProfile?.name || 'the baby',
        createdAt: Date.now(),
        expiresAt: Date.now() + 86_400_000
      }
    );
    return code;
  }

  async getInviteDetails(rawCode: string): Promise<CaregiverInviteDetails> {
    const code = rawCode.trim().toUpperCase();
    const snapshot = await getDoc(
      doc(this.firestore, 'caregiverInvites', code)
    );
    if (!snapshot.exists()) {
      throw new Error('That invitation is invalid, expired, or already used.');
    }
    const invite = snapshot.data() as Partial<CaregiverInviteDetails>;
    if (Number(invite.expiresAt) < Date.now()) {
      throw new Error('That invitation has expired. Ask the family for a new one.');
    }
    return {
      ownerName: invite.ownerName || 'Baby’s family',
      babyName: invite.babyName || 'the baby',
      expiresAt: Number(invite.expiresAt)
    };
  }

  async joinWithCode(rawCode: string): Promise<string> {
    const user = firebaseAuth.currentUser;
    const code = rawCode.trim().toUpperCase();
    if (!user || !code) {
      throw new Error('Sign in and enter an invite code.');
    }

    const inviteReference =
      doc(this.firestore, 'caregiverInvites', code);
    const inviteSnapshot = await getDoc(inviteReference);
    if (!inviteSnapshot.exists()) {
      throw new Error('That invite code is invalid or has expired.');
    }

    const invite = inviteSnapshot.data() as {
      ownerId?: string;
      ownerName?: string;
      expiresAt?: number;
    };
    if (
      !invite.ownerId ||
      Number(invite.expiresAt) < Date.now()
    ) {
      throw new Error('That invite code is invalid or has expired.');
    }
    if (invite.ownerId === user.uid) {
      throw new Error('You already own this family.');
    }

    const joinedAt = Date.now();
    const batch = writeBatch(this.firestore);
    batch.set(
      doc(
        this.firestore,
        'users',
        invite.ownerId,
        'caregivers',
        user.uid
      ),
      {
        inviteCode: code,
        displayName: user.displayName || 'Caregiver',
        email: user.email || '',
        role: 'editor',
        joinedAt
      }
    );
    batch.set(
      doc(
        this.firestore,
        'userFamilyLinks',
        user.uid,
        'families',
        invite.ownerId
      ),
      {
        inviteCode: code,
        ownerId: invite.ownerId,
        ownerName:
          invite.ownerName || 'Shared family',
        joinedAt
      }
    );
    // Invite codes are single-use. Keeping this deletion in the same batch
    // prevents a membership from being created without consuming its code.
    batch.delete(inviteReference);
    await batch.commit();

    await trackerStorage.switchDataOwner(invite.ownerId);
    return invite.ownerName || 'the shared family';
  }

  async listCaregivers(): Promise<CaregiverMember[]> {
    const user = firebaseAuth.currentUser;
    if (!user || trackerStorage.isUsingSharedFamily) return [];

    const snapshot = await getDocs(
      collection(
        this.firestore,
        'users',
        user.uid,
        'caregivers'
      )
    );

    return snapshot.docs.map(item => ({
      id: item.id,
      ...(item.data() as Omit<CaregiverMember, 'id'>)
    }));
  }

  async listSharedFamilies(): Promise<SharedFamily[]> {
    const user = firebaseAuth.currentUser;
    if (!user) return [];

    await this.ensureActiveFamilyLink(user.uid);

    const snapshot = await getDocs(
      collection(
        this.firestore,
        'userFamilyLinks',
        user.uid,
        'families'
      )
    );

    return snapshot.docs.map(item => {
      const data = item.data() as Omit<
        SharedFamily,
        'ownerId'
      >;
      return {
        ownerId: item.id,
        ownerName: data.ownerName,
        joinedAt: data.joinedAt
      };
    });
  }

  private async ensureActiveFamilyLink(userId: string): Promise<void> {
    const ownerId = trackerStorage.currentDataOwnerId;
    if (!ownerId || ownerId === userId) return;

    const linkReference = doc(
      this.firestore,
      'userFamilyLinks',
      userId,
      'families',
      ownerId
    );
    if ((await getDoc(linkReference)).exists()) return;

    const membership = await getDoc(
      doc(
        this.firestore,
        'users',
        ownerId,
        'caregivers',
        userId
      )
    );
    if (!membership.exists()) return;

    const membershipData = membership.data() as {
      inviteCode?: string;
      joinedAt?: number;
    };
    const inviteCode = membershipData.inviteCode || '';
    const invite = inviteCode
      ? await getDoc(
          doc(this.firestore, 'caregiverInvites', inviteCode)
        )
      : null;

    await setDoc(linkReference, {
      inviteCode,
      ownerId,
      ownerName:
        invite?.exists()
          ? String(invite.data()['ownerName'] || 'Shared family')
          : 'Shared family',
      joinedAt: Number(membershipData.joinedAt) || Date.now()
    });
  }

  async switchFamily(ownerId: string): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (!user) throw new Error('Sign in first.');

    if (ownerId !== user.uid) {
      const link = await getDoc(
        doc(
          this.firestore,
          'userFamilyLinks',
          user.uid,
          'families',
          ownerId
        )
      );
      if (!link.exists()) {
        throw new Error('You no longer have access to that family.');
      }
    }

    await trackerStorage.switchDataOwner(ownerId);
  }

  async switchToPrivateProfile(): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (!user) throw new Error('Sign in first.');

    // Older caregiver memberships did not have a reverse family link.
    // Repair it while we still know the active owner so the caregiver can
    // select this family again after switching back to their own profile.
    await this.ensureActiveFamilyLink(user.uid);
    await trackerStorage.switchDataOwner(user.uid);
  }

  async removeCaregiver(caregiverId: string): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (!user) return;
    const batch = writeBatch(this.firestore);
    batch.delete(
      doc(
        this.firestore,
        'users',
        user.uid,
        'caregivers',
        caregiverId
      )
    );
    batch.delete(
      doc(
        this.firestore,
        'userFamilyLinks',
        caregiverId,
        'families',
        user.uid
      )
    );
    await batch.commit();
  }

  async setCaregiverRole(
    caregiverId: string,
    role: CaregiverMember['role']
  ): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (!user) throw new Error('Sign in first.');
    if (!['editor', 'viewer'].includes(role)) {
      throw new Error('Choose a valid caregiver role.');
    }
    await updateDoc(
      doc(this.firestore, 'users', user.uid, 'caregivers', caregiverId),
      { role }
    );
  }

  async leaveSharedFamily(): Promise<void> {
    const user = firebaseAuth.currentUser;
    const ownerId = trackerStorage.currentDataOwnerId;
    if (!user || ownerId === user.uid) return;

    const batch = writeBatch(this.firestore);
    batch.delete(
      doc(
        this.firestore,
        'users',
        ownerId,
        'caregivers',
        user.uid
      )
    );
    batch.delete(
      doc(
        this.firestore,
        'userFamilyLinks',
        user.uid,
        'families',
        ownerId
      )
    );
    await batch.commit();
    await trackerStorage.switchDataOwner(user.uid);
  }

  private createCode(): string {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map(value => value.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
}
