import { Injectable } from '@angular/core';
import { onTrackerDataChange, trackerStorage } from '../firebase/tracker-storage';
import { BehaviorSubject } from 'rxjs';
import { firebaseAuth } from '../firebase/firebase.config';

export type TemperatureMethod =
  'axillary' | 'oral' | 'rectal' | 'ear' | 'forehead';
export type TemperatureUnit = 'celsius' | 'fahrenheit';

export interface TemperatureEntry {
  id: string;
  celsius: number;
  measuredAt: number;
  method: TemperatureMethod;
  notes: string;
  createdByUid?: string;
  createdByName?: string;
}

@Injectable({ providedIn: 'root' })
export class TemperatureService {
  private readonly key = 'baby_temperature_entries';
  private readonly unitKey = 'baby_temperature_unit';
  private readonly subject =
    new BehaviorSubject<TemperatureEntry[]>(this.load());
  private readonly unitSubject =
    new BehaviorSubject<TemperatureUnit>(this.loadUnit());

  readonly entries$ = this.subject.asObservable();
  readonly unit$ = this.unitSubject.asObservable();

  constructor() {
    onTrackerDataChange(this.key, () => this.subject.next(this.load()));
    onTrackerDataChange(this.unitKey, () => this.unitSubject.next(this.loadUnit()));
  }

  get entries(): TemperatureEntry[] {
    return this.subject.value;
  }

  get unit(): TemperatureUnit {
    return this.unitSubject.value;
  }

  setUnit(unit: TemperatureUnit): void {
    trackerStorage.setItem(this.unitKey, unit);
    this.unitSubject.next(unit);
  }

  toDisplay(celsius: number, unit = this.unit): number {
    return unit === 'fahrenheit'
      ? celsius * 9 / 5 + 32
      : celsius;
  }

  toCelsius(value: number, unit = this.unit): number {
    return unit === 'fahrenheit'
      ? (value - 32) * 5 / 9
      : value;
  }

  save(entry: TemperatureEntry): boolean {
    const celsius = Number(entry.celsius);

    if (
      !this.isValidEntry({ ...entry, celsius })
    ) {
      return false;
    }

    const normalized = {
      ...entry,
      celsius: Math.round(celsius * 10) / 10,
      notes: entry.notes.trim(),
      createdByUid: this.entries.find(item => item.id === entry.id)?.createdByUid ?? entry.createdByUid ?? firebaseAuth.currentUser?.uid,
      createdByName: this.entries.find(item => item.id === entry.id)?.createdByName ?? entry.createdByName ?? this.currentUserName()
    };
    const existing =
      this.entries.some(item => item.id === entry.id);
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

  private persist(entries: TemperatureEntry[]): void {
    const sorted = [...entries].sort(
      (a, b) => b.measuredAt - a.measuredAt
    );
    trackerStorage.setItem(this.key, JSON.stringify(sorted));
    this.subject.next(sorted);
  }

  private load(): TemperatureEntry[] {
    try {
      const value = JSON.parse(
        trackerStorage.getItem(this.key) || '[]'
      );
      return Array.isArray(value)
        ? value
            .filter(entry => this.isValidEntry(entry))
            .sort((a, b) => b.measuredAt - a.measuredAt)
        : [];
    } catch {
      return [];
    }
  }

  private isValidEntry(value: unknown): value is TemperatureEntry {
    if (!value || typeof value !== 'object') return false;
    const entry = value as Partial<TemperatureEntry>;
    return (
      typeof entry.id === 'string' &&
      entry.id.length > 0 &&
      Number.isFinite(entry.celsius) &&
      Number(entry.celsius) >= 30 &&
      Number(entry.celsius) <= 45 &&
      Number.isFinite(entry.measuredAt) &&
      Number(entry.measuredAt) <= Date.now() + 60_000 &&
      ['axillary', 'oral', 'rectal', 'ear', 'forehead'].includes(
        String(entry.method)
      ) &&
      typeof entry.notes === 'string' &&
      entry.notes.trim().length <= 240
    );
  }

  private loadUnit(): TemperatureUnit {
    return trackerStorage.getItem(this.unitKey) === 'fahrenheit'
      ? 'fahrenheit'
      : 'celsius';
  }
}
