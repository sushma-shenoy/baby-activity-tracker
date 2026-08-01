import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { onTrackerDataChange, trackerStorage } from '../firebase/tracker-storage';
import { firebaseAuth } from '../firebase/firebase.config';

export type SolidFoodAmount =
  | 'taste'
  | 'some'
  | 'most'
  | 'all';

export type SolidFoodReaction =
  | 'neutral'
  | 'liked'
  | 'disliked'
  | 'possible-reaction';

export interface SolidFoodEntry {
  id: string;
  foods: string;
  amount: SolidFoodAmount;
  reaction: SolidFoodReaction;
  notes: string;
  eatenAt: number;
  createdByUid?: string;
  createdByName?: string;
}

@Injectable({ providedIn: 'root' })
export class SolidFoodService {
  private readonly storageKey =
    'baby_solid_food_entries';
  private readonly entriesSubject =
    new BehaviorSubject<SolidFoodEntry[]>(
      this.load()
    );

  readonly entries$ =
    this.entriesSubject.asObservable();

  get entries(): SolidFoodEntry[] {
    return this.entriesSubject.value;
  }

  constructor() {
    onTrackerDataChange(this.storageKey, () => this.entriesSubject.next(this.load()));
  }

  save(entry: SolidFoodEntry): boolean {
    const normalized = this.normalize(entry);
    if (!normalized) return false;

    const existing = this.entries.some(
      item => item.id === normalized.id
    );
    const attributed = this.withCreator(normalized);
    const entries = existing
      ? this.entries.map(item =>
          item.id === normalized.id
            ? { ...attributed, createdByUid: item.createdByUid || attributed.createdByUid, createdByName: item.createdByName || attributed.createdByName }
            : item
        )
      : [attributed, ...this.entries];

    this.persist(entries);
    return true;
  }

  delete(id: string): void {
    this.persist(
      this.entries.filter(
        entry => entry.id !== id
      )
    );
  }

  private normalize(
    value: unknown
  ): SolidFoodEntry | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const entry =
      value as Partial<SolidFoodEntry>;
    const foods =
      typeof entry.foods === 'string'
        ? entry.foods.trim()
        : '';
    const notes =
      typeof entry.notes === 'string'
        ? entry.notes.trim()
        : '';

    if (
      typeof entry.id !== 'string' ||
      !entry.id ||
      !foods ||
      foods.length > 500 ||
      notes.length > 240 ||
      !['taste', 'some', 'most', 'all']
        .includes(String(entry.amount)) ||
      ![
        'neutral',
        'liked',
        'disliked',
        'possible-reaction'
      ].includes(String(entry.reaction)) ||
      !Number.isFinite(entry.eatenAt) ||
      Number(entry.eatenAt) >
        Date.now() + 60_000
    ) {
      return null;
    }

    return {
      id: entry.id,
      foods,
      amount:
        entry.amount as SolidFoodAmount,
      reaction:
        entry.reaction as SolidFoodReaction,
      notes,
      eatenAt: Number(entry.eatenAt),
      createdByUid: entry.createdByUid,
      createdByName: entry.createdByName
    };
  }

  private withCreator(entry: SolidFoodEntry): SolidFoodEntry {
    const user = firebaseAuth.currentUser;
    return !user || entry.createdByUid ? entry : {
      ...entry, createdByUid: user.uid,
      createdByName: user.displayName || user.email || 'Caregiver'
    };
  }

  private persist(
    entries: SolidFoodEntry[]
  ): void {
    const sorted = [...entries].sort(
      (first, second) =>
        second.eatenAt - first.eatenAt
    );
    trackerStorage.setItem(
      this.storageKey,
      JSON.stringify(sorted)
    );
    this.entriesSubject.next(sorted);
  }

  private load(): SolidFoodEntry[] {
    try {
      const parsed = JSON.parse(
        trackerStorage.getItem(
          this.storageKey
        ) || '[]'
      );
      if (!Array.isArray(parsed)) return [];

      return parsed
        .map(value => this.normalize(value))
        .filter(
          (
            entry
          ): entry is SolidFoodEntry =>
            Boolean(entry)
        )
        .sort(
          (first, second) =>
            second.eatenAt - first.eatenAt
        );
    } catch {
      return [];
    }
  }
}
