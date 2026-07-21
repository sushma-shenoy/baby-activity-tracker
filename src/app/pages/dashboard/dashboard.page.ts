import {
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';

import {
  CommonModule
} from '@angular/common';

import {
  Router
} from '@angular/router';

import {
  IonicModule
} from '@ionic/angular';

import {
  interval,
  Subscription
} from 'rxjs';

import {
  ActivityService
} from '../../services/activity.service';

import {
  SleepService
} from '../../services/sleep';

import {
  Activity
} from '../../shared/models/activity-model';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule
  ]
})
export class DashboardPage
  implements OnInit, OnDestroy {

  stats = {
    feeding: 0,
    sleep: '0 min',
    diaper: 0,
    lastFeedAgo: 'No feed yet'
  };

  activities: Activity[] = [];

  todayActivityCount = 0;

  greeting = 'Good day';

  todayLabel =
    new Date().toLocaleDateString(
      [],
      {
        month: 'short',
        day: 'numeric'
      }
    );

  sleepTimerDisplay = '00:00:00';

  isSleepRunning = false;

  hasActiveSleepSession = false;

  private activitySubscription?:
    Subscription;

  private timerSubscription?:
    Subscription;

  private allActivities: Activity[] = [];

  constructor(
    private readonly router: Router,
    private readonly activityService:
      ActivityService,
    private readonly sleepService:
      SleepService
  ) { }

  ngOnInit(): void {
    this.updateGreeting();

    this.activitySubscription =
      this.activityService.activities$
        .subscribe(
          activities => {
            this.allActivities = [
              ...activities
            ];

            this.updateDashboard(
              this.allActivities
            );
          }
        );

    this.updateSleepTimer();

    this.timerSubscription =
      interval(1000).subscribe(() => {
        this.updateSleepTimer();

        /*
         * Refreshes relative text such as
         * "5 min ago" without requiring a
         * new activity to be added.
         */
        this.updateLastFeed(
          this.allActivities
        );
      });
  }

  ionViewWillEnter(): void {
    this.updateGreeting();

    this.updateDashboard(
      this.allActivities
    );

    this.updateSleepTimer();
  }

  goTo(page: string): void {
    this.router.navigate([
      `/${page}`
    ]);
  }

  add(type: string): void {
    this.goTo(type);
  }

  getIcon(type: string): string {
    switch (type) {
      case 'feeding':
        return '🍼';

      case 'sleep':
        return '😴';

      case 'diaper':
        return '🧷';

      default:
        return '📝';
    }
  }

  trackByActivityId(
    _index: number,
    activity: Activity
  ): string {
    return activity.id;
  }

  private updateDashboard(
    activities: Activity[]
  ): void {
    const sortedActivities = [
      ...activities
    ].sort(
      (
        firstActivity,
        secondActivity
      ) =>
        secondActivity.createdAt -
        firstActivity.createdAt
    );

    const todayActivities =
      sortedActivities.filter(
        activity =>
          this.isToday(
            activity.createdAt
          )
      );

    this.todayActivityCount =
      todayActivities.length;

    this.activities =
      todayActivities.slice(0, 5);

    this.stats.feeding =
      todayActivities.filter(
        activity =>
          activity.type === 'feeding'
      ).length;

    this.stats.diaper =
      todayActivities.filter(
        activity =>
          activity.type === 'diaper'
      ).length;

    this.stats.sleep =
      this.calculateSleepDuration(
        todayActivities
      );

    this.updateLastFeed(
      sortedActivities
    );
  }

  private updateLastFeed(
    activities: Activity[]
  ): void {
    const lastFeed = [
      ...activities
    ]
      .filter(
        activity =>
          activity.type === 'feeding'
      )
      .sort(
        (
          firstActivity,
          secondActivity
        ) =>
          secondActivity.createdAt -
          firstActivity.createdAt
      )[0];

    this.stats.lastFeedAgo =
      lastFeed
        ? this.formatRelativeTime(
          lastFeed.createdAt
        )
        : 'No feed yet';
  }

  private calculateSleepDuration(
    activities: Activity[]
  ): string {
    const totalMinutes =
      activities
        .filter(
          activity =>
            activity.type === 'sleep'
        )
        .reduce(
          (
            total,
            activity
          ) =>
            total +
            this.parseDurationMinutes(
              activity.value
            ),
          0
        );

    return this.formatMinutes(
      totalMinutes
    );
  }

  private parseDurationMinutes(
    value: string
  ): number {
    const hourMatch =
      value.match(
        /(\d+)\s*(?:hr|hrs|hour|hours)/i
      );

    const minuteMatch =
      value.match(
        /(\d+)\s*(?:min|mins|minute|minutes)/i
      );

    const hours =
      hourMatch
        ? Number(hourMatch[1])
        : 0;

    const minutes =
      minuteMatch
        ? Number(minuteMatch[1])
        : 0;

    return hours * 60 + minutes;
  }

  private formatMinutes(
    totalMinutes: number
  ): string {
    if (totalMinutes <= 0) {
      return '0 min';
    }

    const hours =
      Math.floor(
        totalMinutes / 60
      );

    const minutes =
      totalMinutes % 60;

    if (hours === 0) {
      return `${minutes} min`;
    }

    if (minutes === 0) {
      return `${hours} hr`;
    }

    return `${hours}h ${minutes}m`;
  }

  private updateSleepTimer(): void {
    const state =
      this.sleepService.getState();

    const elapsedMilliseconds =
      this.sleepService.getTime(
        state
      );

    this.isSleepRunning =
      Boolean(state.isRunning);

    this.hasActiveSleepSession =
      Boolean(
        state.sessionActive ||
        state.isRunning ||
        elapsedMilliseconds > 0
      );

    this.sleepTimerDisplay =
      this.formatTimer(
        elapsedMilliseconds
      );
  }

  private formatTimer(
    milliseconds: number
  ): string {
    const totalSeconds =
      Math.floor(
        milliseconds / 1000
      );

    const hours =
      Math.floor(
        totalSeconds / 3600
      );

    const minutes =
      Math.floor(
        (
          totalSeconds % 3600
        ) / 60
      );

    const seconds =
      totalSeconds % 60;

    return (
      `${this.pad(hours)}:` +
      `${this.pad(minutes)}:` +
      `${this.pad(seconds)}`
    );
  }

  private formatRelativeTime(
    createdAt: number
  ): string {
    const difference =
      Math.max(
        0,
        Date.now() - createdAt
      );

    const minutes =
      Math.floor(
        difference / 60000
      );

    if (minutes < 1) {
      return 'Just now';
    }

    if (minutes < 60) {
      return (
        `${minutes} ` +
        `${minutes === 1
          ? 'minute'
          : 'minutes'} ago`
      );
    }

    const hours =
      Math.floor(
        minutes / 60
      );

    if (hours < 24) {
      return (
        `${hours} ` +
        `${hours === 1
          ? 'hour'
          : 'hours'} ago`
      );
    }

    const days =
      Math.floor(
        hours / 24
      );

    if (days === 1) {
      return 'Yesterday';
    }

    if (days < 7) {
      return `${days} days ago`;
    }

    return new Date(
      createdAt
    ).toLocaleDateString(
      [],
      {
        month: 'short',
        day: 'numeric'
      }
    );
  }

  private isToday(
    timestamp: number
  ): boolean {
    const date =
      new Date(timestamp);

    const today =
      new Date();

    return (
      date.getFullYear() ===
      today.getFullYear() &&
      date.getMonth() ===
      today.getMonth() &&
      date.getDate() ===
      today.getDate()
    );
  }

  private updateGreeting(): void {
    const hour =
      new Date().getHours();

    if (hour < 12) {
      this.greeting =
        'Good morning';

      return;
    }

    if (hour < 17) {
      this.greeting =
        'Good afternoon';

      return;
    }

    this.greeting =
      'Good evening';
  }

  private pad(
    value: number
  ): string {
    return value
      .toString()
      .padStart(2, '0');
  }

  ngOnDestroy(): void {
    this.activitySubscription
      ?.unsubscribe();

    this.timerSubscription
      ?.unsubscribe();
  }
}