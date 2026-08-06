import { Injectable } from '@angular/core';
import {
  collection,
  DocumentReference,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
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
  profileId: string;
  expiresAt: number;
}

export interface CaregiverMember {
  id: string;
  displayName: string;
  email: string;
  role: 'editor' | 'viewer';
  profileId: string;
  assignedBabyName: string;
  joinedAt: number;
}

export interface PendingCaregiverInvite {
  code: string;
  babyName: string;
  profileId: string;
  createdAt: number;
  expiresAt: number;
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

  get hasPrivateFamily(): boolean {
    return Boolean(firebaseAuth.currentUser) &&
      !trackerStorage.isCaregiverOnlyAccount;
  }

  async createInvite(): Promise<string> {
    const user = firebaseAuth.currentUser;
    if (!user) throw new Error('Sign in first.');
    if (!this.canManageBabyProfiles) {
      throw new Error('Only the family owner can invite caregivers.');
    }

    const code = this.createCode();
    const profile = this.babyProfileService.activeProfile;
    if (!profile) throw new Error('Choose a baby profile first.');
    await setDoc(
      doc(this.firestore, 'caregiverInvites', code),
      {
        ownerId: user.uid,
        ownerName: user.displayName || 'Baby’s family',
        babyName: profile.name,
        profileId: profile.id,
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
    if (!invite.profileId) {
      throw new Error('This invitation is outdated. Ask the owner for a new one.');
    }
    return {
      ownerName: invite.ownerName || 'Baby’s family',
      babyName: invite.babyName || 'the baby',
      profileId: invite.profileId,
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
      profileId?: string;
      expiresAt?: number;
    };
    if (
      !invite.ownerId ||
      !invite.profileId ||
      Number(invite.expiresAt) < Date.now()
    ) {
      throw new Error('That invite code is invalid or has expired.');
    }
    if (invite.ownerId === user.uid) {
      throw new Error('You already own this family.');
    }

    // Preserve a real private family when an existing owner also becomes a
    // caregiver. Invite-first accounts have no profiles and stay
    // caregiver-only until they explicitly create their own family.
    const hadPrivateFamily = !trackerStorage.isCaregiverOnlyAccount;

    const ownerId = invite.ownerId;
    const joinedAt = Date.now();
    await runTransaction(this.firestore, async transaction => {
      const freshInvite = await transaction.get(inviteReference);
      if (!freshInvite.exists()) {
        throw new Error('That invite code was already used or revoked.');
      }
      const freshData = freshInvite.data();
      if (
        freshData['ownerId'] !== ownerId ||
        Number(freshData['expiresAt']) < Date.now()
      ) {
        throw new Error('That invite code is invalid or has expired.');
      }
      transaction.set(doc(
        this.firestore,
        'users',
        ownerId,
        'caregivers',
        user.uid
      ), {
        inviteCode: code,
        displayName: user.displayName || 'Caregiver',
        email: user.email || '',
        role: 'editor',
        profileId: invite.profileId,
        joinedAt
      });
      transaction.set(doc(
        this.firestore,
        'userFamilyLinks',
        user.uid,
        'families',
        ownerId
      ), {
        inviteCode: code,
        ownerId,
        ownerName:
          invite.ownerName || 'Shared family',
        joinedAt
      });
      transaction.delete(inviteReference);
    });

    await trackerStorage.switchDataOwner(ownerId);
    await trackerStorage.setCaregiverOnlyAccount(!hadPrivateFamily);
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

    const babyNames = new Map(
      this.babyProfileService.profiles.map(profile => [profile.id, profile.name])
    );
    const caregivers = snapshot.docs.map(item => {
      const data = item.data();
      const profileId = String(data['profileId'] || '');
      return {
        id: item.id,
        displayName: String(data['displayName'] || 'Caregiver'),
        email: String(data['email'] || ''),
        role: data['role'] === 'viewer' ? 'viewer' as const : 'editor' as const,
        profileId,
        assignedBabyName: babyNames.get(profileId) || 'Baby profile unavailable',
        joinedAt: Number(data['joinedAt']) || 0
      };
    });
    await this.refreshSharedFamilyNames(caregivers);
    return caregivers;
  }

  async listPendingInvites(): Promise<PendingCaregiverInvite[]> {
    const user = firebaseAuth.currentUser;
    if (!user || !this.canManageBabyProfiles) return [];

    const snapshot = await getDocs(query(
      collection(this.firestore, 'caregiverInvites'),
      where('ownerId', '==', user.uid)
    ));
    const now = Date.now();
    const expired = snapshot.docs.filter(
      invitation => Number(invitation.data()['expiresAt']) <= now
    );
    if (expired.length) {
      const batch = writeBatch(this.firestore);
      for (const invitation of expired) batch.delete(invitation.ref);
      await batch.commit();
    }

    return snapshot.docs
      .filter(invitation => Number(invitation.data()['expiresAt']) > now)
      .map(invitation => ({
        code: invitation.id,
        babyName: String(invitation.data()['babyName'] || 'Family account'),
        profileId: String(invitation.data()['profileId'] || ''),
        createdAt: Number(invitation.data()['createdAt']) || 0,
        expiresAt: Number(invitation.data()['expiresAt'])
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async revokeInvite(code: string): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (!user || !this.canManageBabyProfiles) {
      throw new Error('Only the family owner can revoke invitations.');
    }
    const reference = doc(this.firestore, 'caregiverInvites', code);
    const snapshot = await getDoc(reference);
    if (!snapshot.exists()) return;
    if (snapshot.data()['ownerId'] !== user.uid) {
      throw new Error('You cannot revoke this invitation.');
    }
    const batch = writeBatch(this.firestore);
    batch.delete(reference);
    await batch.commit();
  }

  async revokeInvitesForProfile(profileId: string): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (!user || !this.canManageBabyProfiles) {
      throw new Error('Only the family owner can revoke invitations.');
    }

    const snapshot = await getDocs(query(
      collection(this.firestore, 'caregiverInvites'),
      where('ownerId', '==', user.uid)
    ));
    if (snapshot.empty) return;

    const batch = writeBatch(this.firestore);
    for (const invitation of snapshot.docs) {
      if (invitation.data()['profileId'] === profileId) {
        batch.delete(invitation.ref);
      }
    }
    await batch.commit();
  }

  async revokeRequestsForProfile(profileId: string): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (!user || !this.canManageBabyProfiles) {
      throw new Error('Only the family owner can remove pending requests.');
    }
    const snapshot = await getDocs(collection(
      this.firestore, 'users', user.uid, 'changeRequests'
    ));
    const references = snapshot.docs
      .filter(item => !item.data()['profileId'] || item.data()['profileId'] === profileId)
      .map(item => item.ref);
    await this.deleteInChunks(references);
  }

  async removeCaregiversForProfile(profileId: string): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (!user || !this.canManageBabyProfiles) {
      throw new Error('Only the family owner can remove baby access.');
    }
    const snapshot = await getDocs(collection(
      this.firestore, 'users', user.uid, 'caregivers'
    ));
    const caregiverIds = snapshot.docs
      .filter(item => item.data()['profileId'] === profileId)
      .map(item => item.id);
    for (const caregiverId of caregiverIds) {
      await this.removeCaregiver(caregiverId);
    }
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

    const validItems: typeof snapshot.docs = [];
    const staleReferences: DocumentReference[] = [];
    for (const item of snapshot.docs) {
      const membershipReference = doc(
        this.firestore, 'users', item.id, 'caregivers', user.uid
      );
      const membership = await getDoc(membershipReference);
      // The membership is the authority for access. Shared baby data may be
      // temporarily empty while an owner upgrade/backfill is in progress;
      // never revoke a valid membership because its projection is delayed.
      if (membership.exists()) validItems.push(item);
      else {
        staleReferences.push(item.ref);
      }
    }
    await this.deleteInChunks(staleReferences);

    return validItems.map(item => {
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

  async createPrivateFamily(baby: { name: string; birthDate: string }): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (!user) throw new Error('Sign in first.');

    trackerStorage.setPendingOwnFamilyBaby(baby);
    await trackerStorage.switchDataOwner(user.uid);
    await trackerStorage.setCaregiverOnlyAccount(false);
  }

  async removeCaregiver(caregiverId: string): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (!user || !this.canManageBabyProfiles) {
      throw new Error('Only the family owner can remove a caregiver.');
    }
    const pending = await this.requestsByCaregiver(user.uid, caregiverId);
    // Membership + reverse link + request deletes must fit one atomic batch.
    if (pending.size > 498) {
      throw new Error(
        'This caregiver has too many pending requests. Reject those requests before removing the caregiver.'
      );
    }
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
    pending.docs.forEach(item => batch.delete(item.ref));
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
    if (role === 'editor') {
      await updateDoc(
        doc(this.firestore, 'users', user.uid, 'caregivers', caregiverId),
        { role }
      );
      return;
    }

    const pending = await this.requestsByCaregiver(user.uid, caregiverId);
    if (pending.size > 499) {
      throw new Error(
        'This caregiver has too many pending requests. Reject those requests before changing them to Viewer.'
      );
    }
    const batch = writeBatch(this.firestore);
    batch.update(
      doc(this.firestore, 'users', user.uid, 'caregivers', caregiverId),
      { role }
    );
    pending.docs.forEach(item => batch.delete(item.ref));
    await batch.commit();
  }

  async setCaregiverProfile(
    caregiverId: string,
    profileId: string
  ): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (!user || !this.canManageBabyProfiles) {
      throw new Error('Only the family owner can change baby access.');
    }
    if (!this.babyProfileService.profiles.some(profile => profile.id === profileId)) {
      throw new Error('That baby profile no longer exists.');
    }

    const pending = await this.requestsByCaregiver(user.uid, caregiverId);
    // One batch can contain the membership update plus at most 499 deletes.
    // Refusing an unusually large reassignment is safer than partially
    // changing access and leaving some old-baby requests behind.
    if (pending.size > 499) {
      throw new Error(
        'This caregiver has too many pending requests. Reject those requests before changing their assigned baby.'
      );
    }

    const batch = writeBatch(this.firestore);
    batch.update(
      doc(this.firestore, 'users', user.uid, 'caregivers', caregiverId),
      { profileId }
    );
    pending.docs.forEach(item => batch.delete(item.ref));
    await batch.commit();
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
    await this.deleteRequestsByCaregiver(ownerId, user.uid);
    await trackerStorage.switchDataOwner(user.uid);
  }

  private async refreshSharedFamilyNames(
    caregivers: CaregiverMember[]
  ): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (!user || !caregivers.length) return;
    const ownerName = user.displayName || 'Shared family';
    await Promise.all(caregivers.map(caregiver =>
      updateDoc(
        doc(
          this.firestore,
          'userFamilyLinks',
          caregiver.id,
          'families',
          user.uid
        ),
        { ownerName }
      ).catch(() => undefined)
    ));
  }

  private createCode(): string {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map(value => value.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }

  private async deleteRequestsByCaregiver(ownerId: string, caregiverId: string): Promise<void> {
    const pending = await this.requestsByCaregiver(ownerId, caregiverId);
    await this.deleteInChunks(pending.docs.map(item => item.ref));
  }

  private requestsByCaregiver(ownerId: string, caregiverId: string) {
    return getDocs(query(
      collection(this.firestore, 'users', ownerId, 'changeRequests'),
      where('caregiverId', '==', caregiverId)
    ));
  }

  private async deleteInChunks(references: DocumentReference[]): Promise<void> {
    for (let index = 0; index < references.length; index += 400) {
      const batch = writeBatch(this.firestore);
      references.slice(index, index + 400).forEach(reference => batch.delete(reference));
      await batch.commit();
    }
  }
}
