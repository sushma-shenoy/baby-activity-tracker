import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Activity } from '../shared/models/activity-model';

@Injectable({
  providedIn: 'root'
})
export class ActivityService {
  private readonly key = 'baby_activities';

  private readonly activitiesSubject =
    new BehaviorSubject<Activity[]>(this.load());

  readonly activities$ = this.activitiesSubject.asObservable();

  private load(): Activity[] {
    try {
      const savedActivities = localStorage.getItem(this.key);

      if (!savedActivities) {
        return [];
      }

      const value = JSON.parse(savedActivities);
      if (!Array.isArray(value)) return [];
      const activities = value.filter(
        activity => this.isValidActivity(activity)
      ) as Activity[];

      return this.sortActivities(activities);
    } catch (error) {
      console.error('Unable to load activities', error);
      return [];
    }
  }

  private save(activities: Activity[]): void {
    const sortedActivities = this.sortActivities(activities);

    localStorage.setItem(
      this.key,
      JSON.stringify(sortedActivities)
    );

    this.activitiesSubject.next(sortedActivities);
  }

  private sortActivities(
    activities: Activity[]
  ): Activity[] {
    return [...activities].sort(
      (first, second) =>
        second.createdAt - first.createdAt
    );
  }

  getActivities(): Activity[] {
    return this.activitiesSubject.value;
  }

  add(activity: Activity): void {
    if (!this.isValidActivity(activity)) {
      throw new Error('The activity contains invalid or incomplete data.');
    }
    const updated = [
      activity,
      ...this.getActivities()
    ];

    this.save(updated);
  }

  update(
  id: string,
  changes: Partial<Activity>
): void {
  const updated = this.getActivities().map(activity =>
    activity.id === id
      ? {
          ...activity,
          ...changes,
          id: activity.id
        }
      : activity
  );

  this.save(updated.filter(activity => this.isValidActivity(activity)));
}

  upsertBySourceId(
    sourceId: string,
    activity: Activity
  ): void {
    const existingActivity = this.getActivities().find(
      item => item.id === sourceId
    );

    if (existingActivity) {
      this.update(sourceId, activity);
      return;
    }

    this.add(activity);
  }

  delete(id: string): void {
    const updated = this.getActivities().filter(
      activity => activity.id !== id
    );

    this.save(updated);
  }

  getByType(
    type: Activity['type']
  ): Activity[] {
    return this.getActivities().filter(
      activity => activity.type === type
    );
  }

  getTodayActivities(): Activity[] {
    const today = new Date();

    return this.getActivities().filter(activity => {
      const activityDate = new Date(activity.createdAt);

      return (
        activityDate.getFullYear() === today.getFullYear() &&
        activityDate.getMonth() === today.getMonth() &&
        activityDate.getDate() === today.getDate()
      );
    });
  }

  getTodayCount(
    type: Activity['type']
  ): number {
    return this.getTodayActivities().filter(
      activity => activity.type === type
    ).length;
  }

  private isValidActivity(value: unknown): value is Activity {
    if (!value || typeof value !== 'object') return false;
    const activity = value as Partial<Activity>;
    return (
      typeof activity.id === 'string' &&
      activity.id.length > 0 &&
      ['feeding', 'sleep', 'diaper', 'medicine'].includes(
        String(activity.type)
      ) &&
      typeof activity.title === 'string' &&
      activity.title.trim().length > 0 &&
      typeof activity.value === 'string' &&
      typeof activity.time === 'string' &&
      Number.isFinite(activity.createdAt) &&
      Number(activity.createdAt) <= Date.now() + 60_000
    );
  }
}
