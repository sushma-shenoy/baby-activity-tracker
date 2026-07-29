import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface MedicineEntry {
  id: string;
  name: string;
  dose: string;
  givenAt: number;
  notes: string;
  createdAt: number;
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

  save(
    entry: Omit<MedicineEntry, 'createdAt'>
  ): boolean {
    const name = entry.name.trim();
    const dose = entry.dose.trim();
    const notes = entry.notes.trim();

    if (
      !name ||
      name.length > 60 ||
      !dose ||
      dose.length > 30 ||
      !Number.isFinite(entry.givenAt) ||
      entry.givenAt > Date.now() + 60_000 ||
      notes.length > 240
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
      createdAt: existing?.createdAt ?? Date.now()
    };

    const updated = existing
      ? this.entries.map(item =>
          item.id === entry.id ? normalized : item
        )
      : [normalized, ...this.entries];

    this.persist(updated);
    return true;
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

    localStorage.setItem(
      this.storageKey,
      JSON.stringify(sorted)
    );
    this.entriesSubject.next(sorted);
  }

  private load(): MedicineEntry[] {
    try {
      const saved =
        localStorage.getItem(this.storageKey);

      return saved
        ? (JSON.parse(saved) as MedicineEntry[]).sort(
            (first, second) =>
              second.givenAt - first.givenAt
          )
        : [];
    } catch {
      return [];
    }
  }
}
