import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface VaccinationEntry {
  id: string;
  vaccineName: string;
  administeredDate: string;
  provider: string;
  nextDueDate: string;
  notes: string;
  createdAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class VaccinationService {
  private readonly storageKey =
    'baby_vaccination_entries';
  private readonly entriesSubject =
    new BehaviorSubject<VaccinationEntry[]>(this.load());

  readonly entries$ = this.entriesSubject.asObservable();

  get entries(): VaccinationEntry[] {
    return this.entriesSubject.value;
  }

  save(
    entry: Omit<VaccinationEntry, 'createdAt'>
  ): boolean {
    const vaccineName = entry.vaccineName.trim();
    const provider = entry.provider.trim();
    const notes = entry.notes.trim();
    const today = this.todayValue();

    if (
      !vaccineName ||
      vaccineName.length > 80 ||
      !this.isValidDate(entry.administeredDate) ||
      entry.administeredDate > today ||
      (
        entry.nextDueDate &&
        (
          !this.isValidDate(entry.nextDueDate) ||
          entry.nextDueDate < entry.administeredDate
        )
      ) ||
      provider.length > 80 ||
      notes.length > 240
    ) {
      return false;
    }

    const existing = this.entries.find(
      item => item.id === entry.id
    );
    const normalized: VaccinationEntry = {
      ...entry,
      vaccineName,
      provider,
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

  private persist(entries: VaccinationEntry[]): void {
    const sorted = [...entries].sort(
      (first, second) =>
        second.administeredDate.localeCompare(
          first.administeredDate
        )
    );

    localStorage.setItem(
      this.storageKey,
      JSON.stringify(sorted)
    );
    this.entriesSubject.next(sorted);
  }

  private load(): VaccinationEntry[] {
    try {
      const saved =
        localStorage.getItem(this.storageKey);

      return saved
        ? (JSON.parse(saved) as VaccinationEntry[])
            .sort(
              (first, second) =>
                second.administeredDate.localeCompare(
                  first.administeredDate
                )
            )
        : [];
    } catch {
      return [];
    }
  }

  private isValidDate(value: string): boolean {
    const match =
      /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (!match) {
      return false;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);

    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  private todayValue(): string {
    const today = new Date();

    return (
      `${today.getFullYear()}-` +
      `${String(today.getMonth() + 1).padStart(2, '0')}-` +
      `${String(today.getDate()).padStart(2, '0')}`
    );
  }
}
