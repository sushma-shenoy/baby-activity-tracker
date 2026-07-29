import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

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

  save(milestone: Milestone): void {
    const normalized = this.validate(milestone);
    const remaining = this.milestones.filter(
      item => item.id !== normalized.id
    );
    this.persist([normalized, ...remaining]);
  }

  delete(id: string): void {
    this.persist(this.milestones.filter(item => item.id !== id));
  }

  private validate(milestone: Milestone): Milestone {
    const title = milestone.title.trim();
    const notes = milestone.notes.trim();
    const achieved = new Date(`${milestone.achievedDate}T00:00:00`);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (!title || title.length > 80) {
      throw new Error('Enter a milestone name up to 80 characters.');
    }

    if (
      !milestone.achievedDate ||
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

  private persist(milestones: Milestone[]): void {
    const sorted = [...milestones].sort(
      (a, b) =>
        b.achievedDate.localeCompare(a.achievedDate) ||
        b.createdAt - a.createdAt
    );
    localStorage.setItem(this.storageKey, JSON.stringify(sorted));
    this.milestonesSubject.next(sorted);
  }

  private load(): Milestone[] {
    try {
      const parsed = JSON.parse(
        localStorage.getItem(this.storageKey) || '[]'
      );
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
