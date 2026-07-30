import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  AppPreferences,
  BabyProfile
} from './preferences.service';

export interface ManagedBabyProfile extends BabyProfile {
  id: string;
  createdAt: number;
}

const PROFILE_LIST_KEY = 'baby_profiles_v2';
const ACTIVE_PROFILE_KEY = 'active_baby_profile_id';
const PROFILE_DATA_PREFIX = 'baby_profile_data';

export const BABY_TRACKER_DATA_KEYS = [
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
  'nursing_sessions',
  'active_nursing_session',
  'baby_activity_reminders',
  'baby_custom_reminders',
  'baby_vaccination_reminder'
] as const;

@Injectable({ providedIn: 'root' })
export class BabyProfileService {
  private readonly profilesSubject =
    new BehaviorSubject<ManagedBabyProfile[]>(
      this.loadOrMigrateProfiles()
    );

  readonly profiles$ = this.profilesSubject.asObservable();

  get profiles(): ManagedBabyProfile[] {
    return this.profilesSubject.value;
  }

  get activeProfileId(): string {
    return localStorage.getItem(ACTIVE_PROFILE_KEY) ??
      this.profiles[0]?.id ??
      '';
  }

  get activeProfile(): ManagedBabyProfile | undefined {
    return this.profiles.find(
      profile => profile.id === this.activeProfileId
    );
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
    localStorage.setItem(
      'baby_preferences',
      JSON.stringify({ baby, goals })
    );
    localStorage.setItem(ACTIVE_PROFILE_KEY, profile.id);
    this.snapshotProfile(profile.id);

    return profile;
  }

  switchProfile(profileId: string): boolean {
    if (
      profileId === this.activeProfileId ||
      !this.profiles.some(profile => profile.id === profileId)
    ) {
      return false;
    }

    this.snapshotActiveProfile();
    this.clearActiveData();
    this.restoreProfile(profileId);
    localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
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

  deleteProfile(profileId: string): boolean {
    if (
      profileId === this.activeProfileId ||
      this.profiles.length <= 1
    ) {
      return false;
    }

    const profiles = this.profiles.filter(
      profile => profile.id !== profileId
    );

    for (const key of BABY_TRACKER_DATA_KEYS) {
      localStorage.removeItem(this.profileDataKey(profileId, key));
    }

    this.persistProfiles(profiles);
    return true;
  }

  private loadOrMigrateProfiles(): ManagedBabyProfile[] {
    try {
      const stored = localStorage.getItem(PROFILE_LIST_KEY);
      if (stored) {
        const profiles = JSON.parse(stored) as ManagedBabyProfile[];
        if (Array.isArray(profiles) && profiles.length > 0) {
          if (
            !profiles.some(
              profile => profile.id === localStorage.getItem(ACTIVE_PROFILE_KEY)
            )
          ) {
            localStorage.setItem(ACTIVE_PROFILE_KEY, profiles[0].id);
          }
          return profiles;
        }
      }
    } catch {
      // Fall through to a safe legacy-data migration.
    }

    const baby = this.loadLegacyBaby();
    const profile: ManagedBabyProfile = {
      id: this.createId(),
      ...baby,
      createdAt: Date.now()
    };

    localStorage.setItem(PROFILE_LIST_KEY, JSON.stringify([profile]));
    localStorage.setItem(ACTIVE_PROFILE_KEY, profile.id);
    this.snapshotProfile(profile.id);
    return [profile];
  }

  private loadLegacyBaby(): BabyProfile {
    try {
      const preferences = JSON.parse(
        localStorage.getItem('baby_preferences') || '{}'
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
      const value = localStorage.getItem(key);
      const scopedKey = this.profileDataKey(profileId, key);

      if (value === null) {
        localStorage.removeItem(scopedKey);
      } else {
        localStorage.setItem(scopedKey, value);
      }
    }
  }

  private restoreProfile(profileId: string): void {
    for (const key of BABY_TRACKER_DATA_KEYS) {
      const value = localStorage.getItem(
        this.profileDataKey(profileId, key)
      );

      if (value !== null) {
        localStorage.setItem(key, value);
      }
    }
  }

  private clearActiveData(): void {
    for (const key of BABY_TRACKER_DATA_KEYS) {
      localStorage.removeItem(key);
    }
  }

  private persistProfiles(profiles: ManagedBabyProfile[]): void {
    localStorage.setItem(PROFILE_LIST_KEY, JSON.stringify(profiles));
    this.profilesSubject.next(profiles);
  }

  private profileDataKey(profileId: string, key: string): string {
    return `${PROFILE_DATA_PREFIX}:${profileId}:${key}`;
  }

  private createId(): string {
    return globalThis.crypto?.randomUUID?.() ??
      `baby-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
