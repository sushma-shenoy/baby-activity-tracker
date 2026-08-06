import { Injectable, inject } from '@angular/core';
import {
  onTrackerDataChange,
  trackerStorage
} from '../firebase/tracker-storage';
import { BehaviorSubject } from 'rxjs';
import {
  AppPreferences,
  BabyProfile,
  PreferencesService
} from './preferences.service';

export interface ManagedBabyProfile extends BabyProfile {
  id: string;
  createdAt: number;
}

const PROFILE_LIST_KEY = 'baby_profiles_v2';
const ACTIVE_PROFILE_KEY = 'active_baby_profile_id';
const DEVICE_ACTIVE_PROFILE_KEY = 'baby_tracker_device_active_profile_id';
const PROFILE_DATA_PREFIX = 'baby_profile_data';

export const BABY_TRACKER_DATA_KEYS = [
  'baby_preferences',
  'baby_activities',
  'feeds',
  'baby_solid_food_entries',
  'sleep_state',
  'baby_weight_entries',
  'baby_medicine_entries',
  'baby_vaccination_entries',
  'baby_temperature_entries',
  'baby_temperature_unit',
  'baby_milestones',
  'nursing_sessions',
  'active_nursing_session',
  'baby_activity_reminders',
  'baby_custom_reminders',
  'baby_vaccination_reminder',
  'baby_daily_journal_entries'
] as const;

@Injectable({ providedIn: 'root' })
export class BabyProfileService {
  private readonly preferencesService =
    inject(PreferencesService);

  private readonly profilesSubject =
    new BehaviorSubject<ManagedBabyProfile[]>(
      this.loadOrMigrateProfiles()
    );

  readonly profiles$ = this.profilesSubject.asObservable();

  constructor() {
    onTrackerDataChange(PROFILE_LIST_KEY, () => {
      const profiles = this.readStoredProfiles();
      if (profiles.length) {
        this.profilesSubject.next(profiles);
        const deviceProfileId = localStorage.getItem(DEVICE_ACTIVE_PROFILE_KEY);
        const storedProfileId = trackerStorage.getItem(ACTIVE_PROFILE_KEY);
        const activeProfileId = profiles.some(profile => profile.id === deviceProfileId)
          ? deviceProfileId as string
          : profiles.some(profile => profile.id === storedProfileId)
            ? storedProfileId as string
            : profiles[0].id;
        localStorage.setItem(DEVICE_ACTIVE_PROFILE_KEY, activeProfileId);
      }
    });
  }

  get profiles(): ManagedBabyProfile[] {
    const profiles = this.profilesSubject.value;
    const caregiverProfileId = trackerStorage.currentCaregiverProfileId;
    return trackerStorage.isUsingSharedFamily && caregiverProfileId
      ? profiles.filter(profile => profile.id === caregiverProfileId)
      : profiles;
  }

  get activeProfileId(): string {
    const deviceProfileId = localStorage.getItem(DEVICE_ACTIVE_PROFILE_KEY);
    if (deviceProfileId && this.profiles.some(profile => profile.id === deviceProfileId)) {
      return deviceProfileId;
    }
    return trackerStorage.getItem(ACTIVE_PROFILE_KEY) ??
      this.profiles[0]?.id ??
      '';
  }

  get activeProfile(): ManagedBabyProfile | undefined {
    return this.profiles.find(
      profile => profile.id === this.activeProfileId
    );
  }

  waitForSync(): Promise<void> {
    return trackerStorage.waitForSync();
  }

  addProfile(
    baby: BabyProfile,
    goals: AppPreferences['goals']
  ): ManagedBabyProfile {
    this.snapshotActiveProfile();

    const profile: ManagedBabyProfile = {
      id: this.createId(),
      name: baby.name.trim(),
      birthDate: baby.birthDate,
      mood: baby.mood,
      createdAt: Date.now()
    };

    const profiles = [...this.profiles, profile];
    this.persistProfiles(profiles);
    this.clearActiveData();
    trackerStorage.setItem(
      'baby_preferences',
      JSON.stringify({ baby, goals })
    );
    this.setActiveProfileId(profile.id);
    this.snapshotProfile(profile.id);

    return profile;
  }

  switchProfile(profileId: string): boolean {
    if (trackerStorage.isUsingSharedFamily) return false;
    if (
      profileId === this.activeProfileId ||
      !this.profiles.some(profile => profile.id === profileId)
    ) {
      return false;
    }

    this.snapshotActiveProfile();
    this.clearActiveData();
    this.restoreProfile(profileId);
    this.setActiveProfileId(profileId);
    return true;
  }

  syncActiveProfile(baby: BabyProfile): void {
    const profiles = this.profiles.map(profile =>
      profile.id === this.activeProfileId
        ? { ...profile, ...baby }
        : profile
    );

    this.persistProfiles(profiles);
    this.snapshotActiveProfile();
  }

  setProfilePhoto(
    profileId: string,
    photoId?: string
  ): void {
    const profiles = this.profiles.map(profile =>
      profile.id === profileId
        ? { ...profile, photoId }
        : profile
    );

    this.persistProfiles(profiles);

    if (profileId === this.activeProfileId) {
      const preferences =
        this.preferencesService.preferences;

      this.preferencesService.save({
        ...preferences,
        baby: {
          ...preferences.baby,
          photoId
        }
      });

      this.snapshotActiveProfile();
    }
  }

  deleteProfile(profileId: string): boolean {
    if (
      !this.profiles.some(profile => profile.id === profileId) ||
      this.profiles.length <= 1
    ) {
      return false;
    }

    const profiles = this.profiles.filter(
      profile => profile.id !== profileId
    );

    if (profileId === this.activeProfileId) {
      this.clearActiveData();
      this.restoreProfile(profiles[0].id);
      this.setActiveProfileId(profiles[0].id);
    }

    for (const key of BABY_TRACKER_DATA_KEYS) {
      trackerStorage.removeItem(this.profileDataKey(profileId, key));
    }

    this.persistProfiles(profiles);
    return true;
  }

  private loadOrMigrateProfiles(): ManagedBabyProfile[] {
    try {
      const profiles = this.readStoredProfiles();
      if (profiles.length > 0) {
          const deviceProfileId = localStorage.getItem(DEVICE_ACTIVE_PROFILE_KEY);
          const storedProfileId = trackerStorage.getItem(ACTIVE_PROFILE_KEY);
          const activeProfileId =
            profiles.some(profile => profile.id === deviceProfileId)
              ? deviceProfileId as string
              : profiles.some(profile => profile.id === storedProfileId)
                ? storedProfileId as string
                : profiles[0].id;
          this.setActiveProfileId(activeProfileId);
        return profiles;
      }
    } catch {
      // Fall through to a safe legacy-data migration.
    }

    if (trackerStorage.isCaregiverOnlyAccount) {
      return [];
    }

    const pendingBaby = trackerStorage.pendingOwnFamilyBaby;
    const baby: BabyProfile = pendingBaby
      ? {
          name: pendingBaby.name,
          birthDate: pendingBaby.birthDate,
          mood: 'Happy 😊'
        }
      : this.loadLegacyBaby();
    const profile: ManagedBabyProfile = {
      id: this.createId(),
      ...baby,
      createdAt: Date.now()
    };

    trackerStorage.setItem(PROFILE_LIST_KEY, JSON.stringify([profile]));
    this.setActiveProfileId(profile.id);
    this.snapshotProfile(profile.id);
    if (pendingBaby) trackerStorage.clearPendingOwnFamilyBaby();
    return [profile];
  }

  private readStoredProfiles(): ManagedBabyProfile[] {
    try {
      const stored = trackerStorage.getItem(PROFILE_LIST_KEY);
      if (!stored) return [];
      const profiles = JSON.parse(stored) as ManagedBabyProfile[];
      return Array.isArray(profiles)
        ? profiles.filter(profile =>
            typeof profile?.id === 'string' &&
            typeof profile?.name === 'string'
          )
        : [];
    } catch {
      return [];
    }
  }

  private loadLegacyBaby(): BabyProfile {
    try {
      const preferences = JSON.parse(
        trackerStorage.getItem('baby_preferences') || '{}'
      ) as Partial<AppPreferences>;

      return {
        name: preferences.baby?.name || 'Baby',
        birthDate: preferences.baby?.birthDate || '',
        mood: preferences.baby?.mood || 'Happy 😊'
      };
    } catch {
      return {
        name: 'Baby',
        birthDate: '',
        mood: 'Happy 😊'
      };
    }
  }

  private snapshotActiveProfile(): void {
    if (this.activeProfileId) {
      this.snapshotProfile(this.activeProfileId);
    }
  }

  private snapshotProfile(profileId: string): void {
    for (const key of BABY_TRACKER_DATA_KEYS) {
      const value = trackerStorage.getItem(key);
      const scopedKey = this.profileDataKey(profileId, key);

      if (value === null) {
        trackerStorage.removeItem(scopedKey);
      } else {
        trackerStorage.setItem(scopedKey, value);
      }
    }
  }

  private restoreProfile(profileId: string): void {
    for (const key of BABY_TRACKER_DATA_KEYS) {
      const value = trackerStorage.getItem(
        this.profileDataKey(profileId, key)
      );

      if (value !== null) {
        trackerStorage.setItem(key, value);
      }
    }
  }

  private clearActiveData(): void {
    for (const key of BABY_TRACKER_DATA_KEYS) {
      trackerStorage.removeItem(key);
    }
  }

  private persistProfiles(profiles: ManagedBabyProfile[]): void {
    trackerStorage.setItem(PROFILE_LIST_KEY, JSON.stringify(profiles));
    this.profilesSubject.next(profiles);
  }

  private setActiveProfileId(profileId: string): void {
    localStorage.setItem(DEVICE_ACTIVE_PROFILE_KEY, profileId);
    if (!trackerStorage.isUsingSharedFamily) {
      trackerStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
    }
  }

  private profileDataKey(profileId: string, key: string): string {
    return `${PROFILE_DATA_PREFIX}:${profileId}:${key}`;
  }

  private createId(): string {
    return globalThis.crypto?.randomUUID?.() ??
      `baby-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
