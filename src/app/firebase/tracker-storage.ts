import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  onSnapshot,
  serverTimestamp,
  setDoc,
  waitForPendingWrites,
  Unsubscribe
} from 'firebase/firestore';
import { firebaseApp, firebaseAuth } from './firebase.config';

interface TrackerDocument {
  key: string;
  value: string;
}

const LEGACY_TRACKER_KEYS = new Set([
  'baby_profiles_v2',
  'active_baby_profile_id',
  'baby_preferences',
  'baby_activities',
  'feeds',
  'sleep_state',
  'baby_weight_entries',
  'baby_medicine_entries',
  'baby_vaccination_entries',
  'baby_temperature_entries',
  'baby_temperature_unit',
  'baby_milestones',
  'baby_solid_food_entries',
  'nursing_sessions',
  'active_nursing_session',
  'baby_activity_reminders',
  'baby_custom_reminders',
  'baby_vaccination_reminder',
  'baby_daily_journal_entries'
]);

class TrackerStorage {
  private readonly values = new Map<string, string>();
  private firestore?: Firestore;
  private userId = '';
  private dataOwnerId = '';
  private accessRole: 'owner' | 'editor' | 'viewer' = 'owner';
  private accessSubscription?: Unsubscribe;
  private dataSubscription?: Unsubscribe;
  private testMode = Boolean(
    (globalThis as typeof globalThis & {
      __karma__?: unknown;
    }).__karma__
  );

  get length(): number {
    return this.testMode ? localStorage.length : this.values.size;
  }

  key(index: number): string | null {
    if (this.testMode) return localStorage.key(index);
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.testMode
      ? localStorage.getItem(key)
      : this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.testMode) {
      localStorage.setItem(key, value);
      return;
    }

    if (this.isUsingSharedFamily && this.accessRole === 'editor') {
      if (this.values.get(key) === value) return;
      this.submitChangeRequest('set', key, value);
      queueMicrotask(() => this.dispatchDataChanged(key));
      return;
    }

    this.assertCanEdit();

    const previousValue = this.values.get(key);
    this.values.set(key, value);
    if (!this.firestore || !this.userId) return;

    void setDoc(
      this.documentReference(key),
      {
        key,
        value,
        updatedAt: serverTimestamp()
      }
    ).catch(error => {
      if (this.values.get(key) === value) {
        if (previousValue === undefined) this.values.delete(key);
        else this.values.set(key, previousValue);
        this.dispatchDataChanged(key);
      }
      this.dispatchWriteFailed(key, error);
      console.error(`Unable to save tracker data "${key}" to Firestore:`, error);
    });
  }

  removeItem(key: string): void {
    if (this.testMode) {
      localStorage.removeItem(key);
      return;
    }

    if (this.isUsingSharedFamily && this.accessRole === 'editor') {
      if (!this.values.has(key)) return;
      this.submitChangeRequest('remove', key, '');
      queueMicrotask(() => this.dispatchDataChanged(key));
      return;
    }

    this.assertCanEdit();

    const previousValue = this.values.get(key);
    this.values.delete(key);
    if (!this.firestore || !this.userId) return;

    void deleteDoc(this.documentReference(key)).catch(error => {
      if (!this.values.has(key) && previousValue !== undefined) {
        this.values.set(key, previousValue);
        this.dispatchDataChanged(key);
      }
      this.dispatchWriteFailed(key, error);
      console.error(`Unable to delete tracker data "${key}" from Firestore:`, error);
    });
  }

  clear(): void {
    if (this.testMode) {
      localStorage.clear();
      return;
    }

    this.assertCanEdit();

    for (const key of [...this.values.keys()]) {
      this.removeItem(key);
    }
  }

  async initialize(): Promise<void> {
    this.testMode = Boolean(
      (globalThis as typeof globalThis & {
        __karma__?: unknown;
      }).__karma__
    );
    if (this.testMode) return;

    this.firestore = initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentSingleTabManager(undefined)
      })
    });

    await firebaseAuth.authStateReady();
    const user = firebaseAuth.currentUser;
    if (user) {
      await this.useUser(user.uid);
    }
  }

  async useUser(userId: string): Promise<void> {
    if (this.testMode || !this.firestore) return;
    if (this.userId === userId && this.values.size > 0) return;

    this.userId = userId;
    const preferredOwner = localStorage.getItem(
      this.ownerPreferenceKey(userId)
    );

    try {
      await this.loadOwnerData(
        preferredOwner || userId
      );
    } catch {
      localStorage.removeItem(
        this.ownerPreferenceKey(userId)
      );
      await this.loadOwnerData(userId);
    }
  }

  get currentUserId(): string {
    return this.userId;
  }

  get currentDataOwnerId(): string {
    return this.dataOwnerId || this.userId;
  }

  get isUsingSharedFamily(): boolean {
    return Boolean(
      this.userId &&
      this.dataOwnerId &&
      this.userId !== this.dataOwnerId
    );
  }

  get canEditCurrentData(): boolean {
    return this.accessRole !== 'viewer';
  }

  get currentAccessRole(): 'owner' | 'editor' | 'viewer' {
    return this.accessRole;
  }

  requireEditAccess(): void {
    if (!this.testMode) this.assertCanEdit();
  }

  async waitForSync(): Promise<void> {
    if (this.testMode || !this.firestore) return;
    await waitForPendingWrites(this.firestore);
  }

  async switchDataOwner(
    ownerId: string
  ): Promise<void> {
    if (!this.userId || !ownerId) {
      throw new Error('Sign in before switching families.');
    }

    const previousOwnerId = this.dataOwnerId;
    const previousValues = new Map(this.values);
    try {
      await this.loadOwnerData(ownerId);
    } catch (error) {
      this.dataOwnerId = previousOwnerId;
      this.values.clear();
      for (const [key, value] of previousValues) {
        this.values.set(key, value);
      }
      await this.loadAccessRole(previousOwnerId || this.userId);
      this.subscribeToOwnerData(previousOwnerId || this.userId);
      throw error;
    }
    if (ownerId === this.userId) {
      localStorage.removeItem(
        this.ownerPreferenceKey(this.userId)
      );
    } else {
      localStorage.setItem(
        this.ownerPreferenceKey(this.userId),
        ownerId
      );
    }
  }

  private async loadOwnerData(
    ownerId: string
  ): Promise<void> {
    if (!this.firestore) return;

    this.dataSubscription?.();
    this.dataSubscription = undefined;

    await this.loadAccessRole(ownerId);

    this.dataOwnerId = ownerId;
    this.syncViewerMode();
    this.values.clear();

    const snapshot = await getDocs(
      collection(this.firestore, 'users', ownerId, 'trackerData')
    );
    for (const item of snapshot.docs) {
      const data = item.data() as Partial<TrackerDocument>;
      if (
        typeof data.key === 'string' &&
        typeof data.value === 'string'
      ) {
        this.values.set(data.key, data.value);
      }
    }

    if (
      snapshot.empty &&
      ownerId === this.userId
    ) {
      await this.migrateLegacyBrowserData();
    } else if (ownerId === this.userId) {
      this.removeLegacyBrowserData();
    }

    this.subscribeToOwnerData(ownerId);
  }

  clearUser(): void {
    if (this.testMode) return;
    this.accessSubscription?.();
    this.accessSubscription = undefined;
    this.dataSubscription?.();
    this.dataSubscription = undefined;
    this.userId = '';
    this.dataOwnerId = '';
    this.accessRole = 'owner';
    document.body.classList.remove('viewer-mode');
    document.body.classList.remove('caregiver-mode');
    this.values.clear();
  }

  private async migrateLegacyBrowserData(): Promise<void> {
    if (!this.firestore || !this.userId) return;

    const legacyEntries: Array<[string, string]> = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !this.isTrackerKey(key)) continue;
      const value = localStorage.getItem(key);
      if (value !== null) legacyEntries.push([key, value]);
    }

    await Promise.all(
      legacyEntries.map(([key, value]) =>
        setDoc(this.documentReference(key), {
          key,
          value,
          updatedAt: serverTimestamp()
        })
      )
    );

    for (const [key, value] of legacyEntries) {
      this.values.set(key, value);
    }
    this.removeLegacyBrowserData();
  }

  private removeLegacyBrowserData(): void {
    const keys = Array.from(
      { length: localStorage.length },
      (_, index) => localStorage.key(index)
    );
    for (const key of keys) {
      if (key && this.isTrackerKey(key)) {
        localStorage.removeItem(key);
      }
    }
  }

  private isTrackerKey(key: string): boolean {
    return LEGACY_TRACKER_KEYS.has(key) ||
      key.startsWith('baby_profile_data:');
  }

  private documentReference(key: string) {
    return doc(
      this.firestore!,
      'users',
      this.currentDataOwnerId,
      'trackerData',
      encodeURIComponent(key)
    );
  }

  private ownerPreferenceKey(userId: string): string {
    return `baby_shared_owner:${userId}`;
  }

  private async loadAccessRole(ownerId: string): Promise<void> {
    this.accessSubscription?.();
    this.accessSubscription = undefined;

    if (!this.firestore || ownerId === this.userId) {
      this.accessRole = 'owner';
      this.syncViewerMode();
      return;
    }

    const membershipReference = doc(
      this.firestore,
      'users',
      ownerId,
      'caregivers',
      this.userId
    );
    const membership = await getDoc(membershipReference);
    if (!membership.exists()) {
      throw new Error('You no longer have access to this family.');
    }
    this.accessRole = membership.data()['role'] === 'viewer'
      ? 'viewer'
      : 'editor';
    this.syncViewerMode();

    this.accessSubscription = onSnapshot(
      membershipReference,
      snapshot => {
        if (!snapshot.exists()) {
          this.accessRole = 'viewer';
          this.syncViewerMode();
          if (this.currentDataOwnerId === ownerId) {
            void this.switchDataOwner(this.userId).then(() => {
              window.dispatchEvent(
                new CustomEvent('baby-tracker:family-access-removed')
              );
            }).catch(error => {
              console.error('Unable to return to the private profile:', error);
            });
          }
          return;
        }
        this.accessRole = snapshot.data()['role'] === 'viewer'
          ? 'viewer'
          : 'editor';
        this.syncViewerMode();
      },
      error => console.error('Unable to refresh caregiver permission:', error)
    );
  }

  private assertCanEdit(): void {
    if (!this.canEditCurrentData) {
      const message =
        'This family is view-only. Ask the owner for Editor access to make changes.';
      window.dispatchEvent(
        new CustomEvent('baby-tracker:permission-denied', {
          detail: { message }
        })
      );
      throw new Error(message);
    }
  }

  private syncViewerMode(): void {
    document.body.classList.toggle(
      'caregiver-mode',
      this.isUsingSharedFamily
    );
    document.body.classList.toggle(
      'viewer-mode',
      this.isUsingSharedFamily && this.accessRole === 'viewer'
    );
  }

  private dispatchDataChanged(key: string): void {
    window.dispatchEvent(new CustomEvent('baby-tracker:data-changed', {
      detail: { keys: [key] }
    }));
  }

  private dispatchWriteFailed(key: string, error: unknown): void {
    window.dispatchEvent(new CustomEvent('baby-tracker:write-failed', {
      detail: {
        key,
        message: error instanceof Error
          ? error.message
          : 'The change could not be saved.'
      }
    }));
  }

  private submitChangeRequest(
    operation: 'set' | 'remove',
    key: string,
    value: string
  ): void {
    const user = firebaseAuth.currentUser;
    if (!this.firestore || !user || !this.currentDataOwnerId) return;
    const requestId = globalThis.crypto?.randomUUID?.() ??
      `request-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    void setDoc(
      doc(
        this.firestore,
        'users',
        this.currentDataOwnerId,
        'changeRequests',
        requestId
      ),
      {
        key,
        value,
        baseValue: this.getItem(key) || '',
        operation,
        caregiverId: user.uid,
        caregiverName: user.displayName || user.email || 'Caregiver',
        createdAt: Date.now()
      }
    ).then(() => {
      window.dispatchEvent(new CustomEvent('baby-tracker:change-proposed'));
    }).catch(error => {
      this.dispatchWriteFailed(key, error);
      console.error(`Unable to submit change request for "${key}":`, error);
    });
  }

  private subscribeToOwnerData(ownerId: string): void {
    if (!this.firestore) return;
    this.dataSubscription?.();
    this.dataSubscription = onSnapshot(
      collection(this.firestore, 'users', ownerId, 'trackerData'),
      snapshot => {
        if (this.currentDataOwnerId !== ownerId) return;

        const incoming = new Map<string, string>();
        for (const item of snapshot.docs) {
          const data = item.data() as Partial<TrackerDocument>;
          if (typeof data.key === 'string' && typeof data.value === 'string') {
            incoming.set(data.key, data.value);
          }
        }

        const changedKeys = new Set<string>();
        for (const [key, value] of incoming) {
          if (this.values.get(key) !== value) changedKeys.add(key);
        }
        for (const key of this.values.keys()) {
          if (!incoming.has(key)) changedKeys.add(key);
        }
        if (!changedKeys.size) return;

        this.values.clear();
        for (const [key, value] of incoming) this.values.set(key, value);
        window.dispatchEvent(
          new CustomEvent('baby-tracker:data-changed', {
            detail: { keys: [...changedKeys] }
          })
        );
      },
      error => console.error('Unable to receive live tracker updates:', error)
    );
  }
}

export const trackerStorage = new TrackerStorage();

export async function initializeTrackerStorage(): Promise<void> {
  await trackerStorage.initialize();
}

export function onTrackerDataChange(
  keys: string | string[],
  listener: () => void
): () => void {
  const expected = new Set(Array.isArray(keys) ? keys : [keys]);
  const handler = (event: Event) => {
    const changed = (event as CustomEvent<{ keys?: string[] }>).detail?.keys;
    if (changed?.some(key => expected.has(key))) listener();
  };
  window.addEventListener('baby-tracker:data-changed', handler);
  return () => window.removeEventListener('baby-tracker:data-changed', handler);
}
