import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Activity } from '../shared/models/activity-model';

@Injectable({
  providedIn: 'root'
})
export class ActivityService {
  private key = 'baby_activities';

  private activitiesSubject = new BehaviorSubject<Activity[]>(this.load());
  activities$ = this.activitiesSubject.asObservable();

  private load(): Activity[] {
    return JSON.parse(localStorage.getItem(this.key) || '[]');
  }

  private save(data: Activity[]) {
    localStorage.setItem(this.key, JSON.stringify(data));
    this.activitiesSubject.next(data);
  }

  getActivities(): Activity[] {
    return this.activitiesSubject.value;
  }

  add(activity: Activity) {
    const updated = [activity, ...this.getActivities()];
    this.save(updated);
  }

  delete(id: string) {
    const updated = this.getActivities().filter(a => a.id !== id);
    this.save(updated);
  }

  getByType(type: Activity['type']) {
    return this.getActivities().filter(a => a.type === type);
  }
}