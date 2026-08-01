import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { firebaseAuth } from '../firebase/firebase.config';
import { onTrackerDataChange, trackerStorage } from '../firebase/tracker-storage';

export type JournalMood = 'happy' | 'calm' | 'fussy' | 'tired' | 'unwell';

export interface JournalEntry {
  id: string;
  recordedAt: number;
  mood: JournalMood;
  notes: string;
  symptoms: string[];
  createdByUid?: string;
  createdByName?: string;
}

@Injectable({ providedIn: 'root' })
export class DailyJournalService {
  private readonly key = 'baby_daily_journal_entries';
  private readonly subject = new BehaviorSubject<JournalEntry[]>(this.load());
  readonly entries$ = this.subject.asObservable();

  constructor() {
    onTrackerDataChange(this.key, () => this.subject.next(this.load()));
  }

  get entries(): JournalEntry[] {
    return this.subject.value;
  }

  save(entry: JournalEntry): boolean {
    const normalized = this.normalize(entry);
    if (!normalized) return false;
    const existing = this.entries.find(item => item.id === entry.id);
    const user = firebaseAuth.currentUser;
    const attributed: JournalEntry = {
      ...normalized,
      createdByUid: existing?.createdByUid ?? entry.createdByUid ?? user?.uid,
      createdByName: existing?.createdByName ?? entry.createdByName ??
        (user ? user.displayName || user.email || 'Caregiver' : undefined)
    };
    const updated = existing
      ? this.entries.map(item => item.id === entry.id ? attributed : item)
      : [attributed, ...this.entries];
    this.persist(updated);
    return true;
  }

  delete(id: string): void {
    this.persist(this.entries.filter(entry => entry.id !== id));
  }

  private persist(entries: JournalEntry[]): void {
    const sorted = [...entries].sort((a, b) => b.recordedAt - a.recordedAt);
    trackerStorage.setItem(this.key, JSON.stringify(sorted));
    this.subject.next(sorted);
  }

  private load(): JournalEntry[] {
    try {
      const parsed = JSON.parse(trackerStorage.getItem(this.key) || '[]');
      return Array.isArray(parsed)
        ? parsed.map(value => this.normalize(value)).filter((value): value is JournalEntry => Boolean(value)).sort((a, b) => b.recordedAt - a.recordedAt)
        : [];
    } catch {
      return [];
    }
  }

  private normalize(value: unknown): JournalEntry | null {
    if (!value || typeof value !== 'object') return null;
    const entry = value as Partial<JournalEntry>;
    const notes = typeof entry.notes === 'string' ? entry.notes.trim() : '';
    const symptoms = Array.isArray(entry.symptoms)
      ? entry.symptoms.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean).slice(0, 8)
      : [];
    if (
      typeof entry.id !== 'string' || !entry.id ||
      !Number.isFinite(entry.recordedAt) || Number(entry.recordedAt) > Date.now() + 60_000 ||
      !['happy', 'calm', 'fussy', 'tired', 'unwell'].includes(String(entry.mood)) ||
      notes.length > 500 || symptoms.some(item => item.length > 40)
    ) return null;
    return {
      id: entry.id,
      recordedAt: Number(entry.recordedAt),
      mood: entry.mood as JournalMood,
      notes,
      symptoms,
      createdByUid: entry.createdByUid,
      createdByName: entry.createdByName
    };
  }
}
