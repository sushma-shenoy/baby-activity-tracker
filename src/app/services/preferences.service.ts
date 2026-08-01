import { Injectable } from '@angular/core';
import { onTrackerDataChange, trackerStorage } from '../firebase/tracker-storage';
import { BehaviorSubject } from 'rxjs';

export interface BabyProfile {
  name: string;
  birthDate: string;
  mood: string;
  photoId?: string;
}

export interface DailyGoals {
  feeds: number;
  sleepSessions: number;
  diapers: number;
}

export interface AppPreferences {
  baby: BabyProfile;
  goals: DailyGoals;
}

const DEFAULT_PREFERENCES: AppPreferences = {
  baby: {
    name: 'Baby',
    birthDate: '',
    mood: 'Happy 😊'
  },
  goals: {
    feeds: 8,
    sleepSessions: 5,
    diapers: 7
  }
};

@Injectable({
  providedIn: 'root'
})
export class PreferencesService {
  private readonly storageKey = 'baby_preferences';
  private readonly preferencesSubject =
    new BehaviorSubject<AppPreferences>(this.load());

  readonly preferences$ =
    this.preferencesSubject.asObservable();

  get preferences(): AppPreferences {
    return this.preferencesSubject.value;
  }

  constructor() {
    onTrackerDataChange(this.storageKey, () => this.preferencesSubject.next(this.load()));
  }

  save(preferences: AppPreferences): void {
    const normalized: AppPreferences = {
      baby: {
        name:
          preferences.baby.name.trim() ||
          DEFAULT_PREFERENCES.baby.name,
        birthDate:
          preferences.baby.birthDate || '',
        mood:
          preferences.baby.mood ||
          DEFAULT_PREFERENCES.baby.mood,
        ...(
          preferences.baby.photoId
            ? {
                photoId:
                  preferences.baby.photoId
              }
            : {}
        )
      },
      goals: {
        feeds: this.normalizeGoal(
          preferences.goals.feeds,
          DEFAULT_PREFERENCES.goals.feeds
        ),
        sleepSessions: this.normalizeGoal(
          preferences.goals.sleepSessions,
          DEFAULT_PREFERENCES.goals.sleepSessions
        ),
        diapers: this.normalizeGoal(
          preferences.goals.diapers,
          DEFAULT_PREFERENCES.goals.diapers
        )
      }
    };

    trackerStorage.setItem(
      this.storageKey,
      JSON.stringify(normalized)
    );
    this.preferencesSubject.next(normalized);
  }

  getAgeLabel(
    birthDate = this.preferences.baby.birthDate
  ): string {
    if (!birthDate) {
      return 'Age not set';
    }

    const birth = new Date(`${birthDate}T00:00:00`);
    const today = new Date();

    if (
      Number.isNaN(birth.getTime()) ||
      birth > today
    ) {
      return 'Age not set';
    }

    let months =
      (today.getFullYear() - birth.getFullYear()) * 12 +
      today.getMonth() -
      birth.getMonth();

    if (today.getDate() < birth.getDate()) {
      months -= 1;
    }

    if (months < 1) {
      const days = Math.max(
        0,
        Math.floor(
          (today.getTime() - birth.getTime()) /
          86_400_000
        )
      );

      return `${days} ${days === 1 ? 'day' : 'days'}`;
    }

    if (months < 24) {
      return `${months} ${months === 1 ? 'month' : 'months'}`;
    }

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    return remainingMonths
      ? `${years}y ${remainingMonths}m`
      : `${years} ${years === 1 ? 'year' : 'years'}`;
  }

  private load(): AppPreferences {
    try {
      const saved = trackerStorage.getItem(this.storageKey);

      if (!saved) {
        return structuredClone(DEFAULT_PREFERENCES);
      }

      const parsed =
        JSON.parse(saved) as Partial<AppPreferences>;

      const name =
        typeof parsed.baby?.name === 'string'
          ? parsed.baby.name.trim().slice(0, 30)
          : '';
      const birthDate =
        typeof parsed.baby?.birthDate === 'string' &&
        this.isValidBirthDate(parsed.baby.birthDate)
          ? parsed.baby.birthDate
          : '';
      const mood =
        typeof parsed.baby?.mood === 'string' &&
        parsed.baby.mood.length <= 40
          ? parsed.baby.mood
          : DEFAULT_PREFERENCES.baby.mood;

      return {
        baby: {
          name: name || DEFAULT_PREFERENCES.baby.name,
          birthDate,
          mood
        },
        goals: {
          feeds: this.normalizeGoal(
            Number(parsed.goals?.feeds),
            DEFAULT_PREFERENCES.goals.feeds
          ),
          sleepSessions: this.normalizeGoal(
            Number(parsed.goals?.sleepSessions),
            DEFAULT_PREFERENCES.goals.sleepSessions
          ),
          diapers: this.normalizeGoal(
            Number(parsed.goals?.diapers),
            DEFAULT_PREFERENCES.goals.diapers
          )
        }
      };
    } catch {
      return structuredClone(DEFAULT_PREFERENCES);
    }
  }

  private normalizeGoal(
    value: number,
    fallback: number
  ): number {
    const numericValue = Number(value);

    return Number.isFinite(numericValue)
      ? Math.min(24, Math.max(1, Math.round(numericValue)))
      : fallback;
  }

  private isValidBirthDate(value: string): boolean {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day &&
      date <= new Date()
    );
  }
}
