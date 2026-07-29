import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface WeightEntry {
  id: string;
  date: string;
  weightKg: number;
  createdAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class GrowthService {
  private readonly storageKey = 'baby_weight_entries';
  private readonly entriesSubject =
    new BehaviorSubject<WeightEntry[]>(this.load());

  readonly entries$ = this.entriesSubject.asObservable();

  get entries(): WeightEntry[] {
    return this.entriesSubject.value;
  }

  saveDailyWeight(
    date: string,
    weightKg: number
  ): boolean {
    if (
      !this.isValidDate(date) ||
      this.isFutureDate(date) ||
      !this.isValidWeight(weightKg)
    ) {
      return false;
    }

    const existing = this.entries.find(
      entry => entry.date === date
    );

    const entry: WeightEntry = {
      id: existing?.id ?? `weight-${date}`,
      date,
      weightKg:
        Math.round(Number(weightKg) * 100) / 100,
      createdAt: existing?.createdAt ?? Date.now()
    };

    const updated = existing
      ? this.entries.map(item =>
          item.id === existing.id ? entry : item
        )
      : [...this.entries, entry];

    this.persist(updated);
    return true;
  }

  delete(id: string): void {
    this.persist(
      this.entries.filter(entry => entry.id !== id)
    );
  }

  private persist(entries: WeightEntry[]): void {
    const sorted = [...entries].sort(
      (first, second) =>
        first.date.localeCompare(second.date)
    );

    localStorage.setItem(
      this.storageKey,
      JSON.stringify(sorted)
    );
    this.entriesSubject.next(sorted);
  }

  private load(): WeightEntry[] {
    try {
      const saved =
        localStorage.getItem(this.storageKey);

      return saved
        ? (JSON.parse(saved) as WeightEntry[])
            .filter(entry =>
              this.isValidDate(entry.date) &&
              !this.isFutureDate(entry.date) &&
              this.isValidWeight(entry.weightKg)
            )
            .sort(
            (first, second) =>
              first.date.localeCompare(second.date)
          )
        : [];
    } catch {
      return [];
    }
  }

  private isValidDate(date: string): boolean {
    const match =
      /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

    if (!match) {
      return false;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(year, month - 1, day);

    return (
      parsed.getFullYear() === year &&
      parsed.getMonth() === month - 1 &&
      parsed.getDate() === day
    );
  }

  private isFutureDate(date: string): boolean {
    const today = new Date();
    const todayValue =
      `${today.getFullYear()}-` +
      `${String(today.getMonth() + 1).padStart(2, '0')}-` +
      `${String(today.getDate()).padStart(2, '0')}`;

    return date > todayValue;
  }

  private isValidWeight(weightKg: number): boolean {
    const numericWeight = Number(weightKg);

    return (
      Number.isFinite(numericWeight) &&
      numericWeight >= 0.5 &&
      numericWeight <= 40
    );
  }
}
