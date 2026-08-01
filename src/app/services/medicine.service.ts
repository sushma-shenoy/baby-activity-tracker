import { Injectable } from '@angular/core';
import { onTrackerDataChange, trackerStorage } from '../firebase/tracker-storage';
import { BehaviorSubject } from 'rxjs';
import { firebaseAuth } from '../firebase/firebase.config';

export interface MedicineEntry {
  id: string;
  name: string;
  dose: string;
  givenAt: number;
  notes: string;
  createdAt: number;
  createdByUid?: string;
  createdByName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MedicineService {
  private readonly storageKey = 'baby_medicine_entries';
  private readonly entriesSubject =
    new BehaviorSubject<MedicineEntry[]>(this.load());

  readonly entries$ = this.entriesSubject.asObservable();

  get entries(): MedicineEntry[] {
    return this.entriesSubject.value;
  }

  constructor() {
    onTrackerDataChange(this.storageKey, () => this.entriesSubject.next(this.load()));
  }

  save(
    entry: Omit<MedicineEntry, 'createdAt'>
  ): boolean {
    const name = entry.name.trim();
    const dose = entry.dose.trim();
    const notes = entry.notes.trim();

    if (
      !this.isValidEntry({
        ...entry,
        name,
        dose,
        notes,
        createdAt: Date.now()
      })
    ) {
      return false;
    }

    const existing = this.entries.find(
      item => item.id === entry.id
    );

    const normalized: MedicineEntry = {
      ...entry,
      name,
      dose,
      notes,
      createdAt: existing?.createdAt ?? Date.now(),
      createdByUid: existing?.createdByUid ?? firebaseAuth.currentUser?.uid,
      createdByName: existing?.createdByName ?? this.currentUserName()
    };

    const updated = existing
      ? this.entries.map(item =>
          item.id === entry.id ? normalized : item
        )
      : [normalized, ...this.entries];

    this.persist(updated);
    return true;
  }

  private currentUserName(): string | undefined {
    const user = firebaseAuth.currentUser;
    return user ? user.displayName || user.email || 'Caregiver' : undefined;
  }

  delete(id: string): void {
    this.persist(
      this.entries.filter(entry => entry.id !== id)
    );
  }

  private persist(entries: MedicineEntry[]): void {
    const sorted = [...entries].sort(
      (first, second) =>
        second.givenAt - first.givenAt
    );

    trackerStorage.setItem(
      this.storageKey,
      JSON.stringify(sorted)
    );
    this.entriesSubject.next(sorted);
  }

  private load(): MedicineEntry[] {
    try {
      const saved =
        trackerStorage.getItem(this.storageKey);

      return saved
        ? (JSON.parse(saved) as unknown[])
            .filter(entry => this.isValidEntry(entry))
            .sort(
            (first, second) =>
              second.givenAt - first.givenAt
          )
        : [];
    } catch {
      return [];
    }
  }

  private isValidEntry(value: unknown): value is MedicineEntry {
    if (!value || typeof value !== 'object') return false;
    const entry = value as Partial<MedicineEntry>;
    return (
      typeof entry.id === 'string' &&
      entry.id.length > 0 &&
      typeof entry.name === 'string' &&
      entry.name.trim().length > 0 &&
      entry.name.trim().length <= 60 &&
      typeof entry.dose === 'string' &&
      entry.dose.trim().length > 0 &&
      entry.dose.trim().length <= 30 &&
      Number.isFinite(entry.givenAt) &&
      Number(entry.givenAt) <= Date.now() + 60_000 &&
      typeof entry.notes === 'string' &&
      entry.notes.trim().length <= 240
    );
  }
}
