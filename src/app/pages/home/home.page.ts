import {
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';

import {
  CommonModule
} from '@angular/common';

import {
  Router,
  RouterLink
} from '@angular/router';

import {
  IonicModule
} from '@ionic/angular';

import {
  Subscription
} from 'rxjs';

import {
  Activity
} from '../../shared/models/activity-model';

import {
  ActivityService
} from '../../services/activity.service';

import {
  ActivityCardComponent
} from '../../components/activity-card/activity-card.component';

interface ProgressItem {
  label: string;
  value: number;
  goal: number;
  percent: number;
  icon: string;
  class: string;
  unit: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterLink,
    ActivityCardComponent
  ]
})
export class HomePage implements OnInit, OnDestroy {
  recentActivities: Activity[] = [];

  greeting = 'Hello';

  lastFeedText = 'No feed logged';
  lastSleepText = 'No sleep logged';

  insightText =
    'Start logging activities to see useful daily patterns.';

  stats = {
    feeds: 0,
    sleep: 0,
    diapers: 0
  };

  donuts: ProgressItem[] = [];

  baby = {
    name: 'Aradhya',
    age: '6 months',
    mood: 'Happy 😊'
  };

  private activitiesSubscription?: Subscription;
  private clockTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly router: Router,
    private readonly activityService: ActivityService
  ) {}

  ngOnInit(): void {
    this.updateGreeting();

    this.activitiesSubscription =
      this.activityService.activities$.subscribe(() => {
        this.refreshHomeData();
      });

    this.clockTimer = setInterval(() => {
      this.updateGreeting();
      this.refreshLastActivityText();
    }, 60_000);
  }

  ionViewWillEnter(): void {
    this.refreshHomeData();
  }

  ngOnDestroy(): void {
    this.activitiesSubscription?.unsubscribe();

    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }
  }

  getIcon(type: Activity['type']): string {
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

  getActivityAccent(
    type: Activity['type']
  ): string {
    switch (type) {
      case 'feeding':
        return 'feeding-accent';

      case 'sleep':
        return 'sleep-accent';

      case 'diaper':
        return 'diaper-accent';

      default:
        return '';
    }
  }

  getTimeAgo(createdAt: number): string {
    const differenceMilliseconds =
      Date.now() - createdAt;

    if (differenceMilliseconds < 0) {
      return 'Just now';
    }

    const differenceMinutes = Math.floor(
      differenceMilliseconds / 60_000
    );

    if (differenceMinutes < 1) {
      return 'Just now';
    }

    if (differenceMinutes < 60) {
      return `${differenceMinutes}m ago`;
    }

    const differenceHours = Math.floor(
      differenceMinutes / 60
    );

    if (differenceHours < 24) {
      const remainingMinutes =
        differenceMinutes % 60;

      return remainingMinutes > 0
        ? `${differenceHours}h ${remainingMinutes}m ago`
        : `${differenceHours}h ago`;
    }

    const differenceDays = Math.floor(
      differenceHours / 24
    );

    return `${differenceDays}d ago`;
  }

  openActivityPage(
    type: Activity['type']
  ): void {
    const routeByType: Record<
      Activity['type'],
      string
    > = {
      feeding: '/feeding',
      sleep: '/sleep',
      diaper: '/diaper'
    };

    void this.router.navigate([
      routeByType[type]
    ]);
  }

  private refreshHomeData(): void {
    const todayActivities =
      this.activityService.getTodayActivities();

    this.recentActivities =
      todayActivities.slice(0, 5);

    this.stats = {
      feeds: todayActivities.filter(
        activity =>
          activity.type === 'feeding'
      ).length,

      sleep: todayActivities.filter(
        activity =>
          activity.type === 'sleep'
      ).length,

      diapers: todayActivities.filter(
        activity =>
          activity.type === 'diaper'
      ).length
    };

    this.updateDonuts();
    this.refreshLastActivityText();
    this.updateInsight(todayActivities);
  }

  private updateGreeting(): void {
    const currentHour =
      new Date().getHours();

    if (currentHour < 12) {
      this.greeting = 'Good morning';
      return;
    }

    if (currentHour < 17) {
      this.greeting = 'Good afternoon';
      return;
    }

    this.greeting = 'Good evening';
  }

  private refreshLastActivityText(): void {
    const activities =
      this.activityService.getActivities();

    const lastFeed = activities.find(
      activity =>
        activity.type === 'feeding'
    );

    const lastSleep = activities.find(
      activity =>
        activity.type === 'sleep'
    );

    this.lastFeedText = lastFeed
      ? this.getTimeAgo(lastFeed.createdAt)
      : 'No feed logged';

    this.lastSleepText = lastSleep
      ? this.getTimeAgo(lastSleep.createdAt)
      : 'No sleep logged';
  }

  private updateDonuts(): void {
    this.donuts = [
      {
        label: 'Feeds',
        value: this.stats.feeds,
        goal: 8,
        percent: this.calculatePercent(
          this.stats.feeds,
          8
        ),
        icon: '🍼',
        class: 'feed-donut',
        unit: 'logs'
      },
      {
        label: 'Sleep',
        value: this.stats.sleep,
        goal: 5,
        percent: this.calculatePercent(
          this.stats.sleep,
          5
        ),
        icon: '😴',
        class: 'sleep-donut',
        unit: 'sessions'
      },
      {
        label: 'Diapers',
        value: this.stats.diapers,
        goal: 7,
        percent: this.calculatePercent(
          this.stats.diapers,
          7
        ),
        icon: '🧷',
        class: 'diaper-donut',
        unit: 'changes'
      }
    ];
  }

  private updateInsight(
    todayActivities: Activity[]
  ): void {
    const feedings = todayActivities
      .filter(
        activity =>
          activity.type === 'feeding'
      )
      .sort(
        (first, second) =>
          first.createdAt - second.createdAt
      );

    if (feedings.length === 0) {
      this.insightText =
        'No feeding has been logged today.';
      return;
    }

    if (feedings.length === 1) {
      this.insightText =
        'One feeding has been logged today. Add another to calculate the average interval.';
      return;
    }

    let totalIntervalMinutes = 0;

    for (
      let index = 1;
      index < feedings.length;
      index++
    ) {
      totalIntervalMinutes += Math.round(
        (
          feedings[index].createdAt -
          feedings[index - 1].createdAt
        ) / 60_000
      );
    }

    const averageIntervalMinutes =
      Math.round(
        totalIntervalMinutes /
        (feedings.length - 1)
      );

    const hours = Math.floor(
      averageIntervalMinutes / 60
    );

    const minutes =
      averageIntervalMinutes % 60;

    const intervalText =
      hours > 0
        ? `${hours}h ${minutes}m`
        : `${minutes}m`;

    this.insightText =
      `${feedings.length} feeds logged today. ` +
      `The average interval is ${intervalText}.`;
  }

  private calculatePercent(
    value: number,
    goal: number
  ): number {
    if (goal <= 0) {
      return 0;
    }

    return Math.min(
      Math.round(
        (value / goal) * 100
      ),
      100
    );
  }
}