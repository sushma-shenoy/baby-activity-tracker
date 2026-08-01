import { Injectable } from '@angular/core';
import { onTrackerDataChange, trackerStorage } from '../firebase/tracker-storage';
import { BehaviorSubject } from 'rxjs';
import { firebaseAuth } from '../firebase/firebase.config';

export type MilestoneCategory =
  | 'motor'
  | 'communication'
  | 'social'
  | 'cognitive'
  | 'firsts'
  | 'other';

export interface Milestone {
  id: string;
  title: string;
  category: MilestoneCategory;
  achievedDate: string;
  notes: string;
  createdAt: number;
  createdByUid?: string;
  createdByName?: string;
}

@Injectable({ providedIn: 'root' })
export class MilestoneService {
  private readonly storageKey = 'baby_milestones';
  private readonly milestonesSubject =
    new BehaviorSubject<Milestone[]>(this.load());

  readonly milestones$ = this.milestonesSubject.asObservable();

  get milestones(): Milestone[] {
    return this.milestonesSubject.value;
  }

  constructor() {
    onTrackerDataChange(this.storageKey, () => this.milestonesSubject.next(this.load()));
  }

  save(milestone: Milestone): void {
    const existing = this.milestones.find(item => item.id === milestone.id);
    const user = firebaseAuth.currentUser;
    const normalized = this.validate({
      ...milestone,
      createdByUid: existing?.createdByUid ?? milestone.createdByUid ?? user?.uid,
      createdByName: existing?.createdByName ?? milestone.createdByName ??
        (user ? user.displayName || user.email || 'Caregiver' : undefined)
    });
    const remaining = this.milestones.filter(
      item => item.id !== normalized.id
    );
    this.persist([normalized, ...remaining]);
  }

  delete(id: string): void {
    this.persist(this.milestones.filter(item => item.id !== id));
  }

  private validate(milestone: Milestone): Milestone {
    if (!milestone || typeof milestone !== 'object') {
      throw new Error('Invalid milestone record.');
    }
    const title = milestone.title.trim();
    const notes = milestone.notes.trim();
    const achieved = new Date(`${milestone.achievedDate}T00:00:00`);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (!title || title.length > 80) {
      throw new Error('Enter a milestone name up to 80 characters.');
    }

    if (
      typeof milestone.id !== 'string' ||
      !milestone.id ||
      ![
        'motor',
        'communication',
        'social',
        'cognitive',
        'firsts',
        'other'
      ].includes(milestone.category) ||
      !Number.isFinite(milestone.createdAt)
    ) {
      throw new Error('Invalid milestone record.');
    }

    if (
      !milestone.achievedDate ||
      !this.isValidDate(milestone.achievedDate) ||
      Number.isNaN(achieved.getTime()) ||
      achieved > today
    ) {
      throw new Error('Choose today or an earlier valid date.');
    }

    if (notes.length > 240) {
      throw new Error('Keep notes to 240 characters or fewer.');
    }

    return { ...milestone, title, notes };
  }

  private isValidDate(value: string): boolean {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;
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

  private persist(milestones: Milestone[]): void {
    const sorted = [...milestones].sort(
      (a, b) =>
        b.achievedDate.localeCompare(a.achievedDate) ||
        b.createdAt - a.createdAt
    );
    trackerStorage.setItem(this.storageKey, JSON.stringify(sorted));
    this.milestonesSubject.next(sorted);
  }

  private load(): Milestone[] {
    try {
      const parsed = JSON.parse(
        trackerStorage.getItem(this.storageKey) || '[]'
      );
      if (!Array.isArray(parsed)) return [];
      return (parsed as unknown[])
        .reduce<Milestone[]>((valid, value) => {
          try {
            valid.push(this.validate(value as Milestone));
          } catch {
            // Ignore malformed imported or locally stored records.
          }
          return valid;
        }, [])
        .sort(
          (a, b) =>
            b.achievedDate.localeCompare(a.achievedDate) ||
            b.createdAt - a.createdAt
        );
    } catch {
      return [];
    }
  }
}
