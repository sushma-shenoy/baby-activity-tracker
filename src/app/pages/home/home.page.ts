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
  PreferencesService
} from '../../services/preferences.service';
import {
  BabyProfileService
} from '../../services/baby-profile.service';
import {
  PhotoStorageService
} from '../../services/photo-storage.service';
import {
  ActiveNursingSession,
  NursingService
} from '../../services/nursing.service';

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
    RouterLink
  ]
})
export class HomePage implements OnInit, OnDestroy {
  recentActivities: Activity[] = [];

  greeting = 'Hello';

  lastFeedText = 'No feed logged';
  lastSleepText = 'No sleep logged';
  lastSolidFoodText = 'No solid food logged';

  insightText =
    'Start logging activities to see useful daily patterns.';

  stats = {
    feeds: 0,
    sleep: 0,
    diapers: 0
  };

  donuts: ProgressItem[] = [];

  baby = {
    name: 'Baby',
    age: 'Age not set',
    mood: 'Happy 😊'
  };
  babyPhotoUrl = '';
  activeNursing: ActiveNursingSession | null = null;

  private activitiesSubscription?: Subscription;
  private preferencesSubscription?: Subscription;
  private clockTimer?: ReturnType<typeof setInterval>;
  private nursingClock?: ReturnType<typeof setInterval>;

  constructor(
    private readonly router: Router,
    private readonly activityService: ActivityService,
    private readonly preferencesService: PreferencesService,
    readonly babyProfileService: BabyProfileService,
    private readonly photoStorageService: PhotoStorageService,
    private readonly nursingService: NursingService
  ) {}

  ngOnInit(): void {
    this.updateGreeting();

    this.activitiesSubscription =
      this.activityService.activities$.subscribe(() => {
        this.refreshHomeData();
      });

    this.preferencesSubscription =
      this.preferencesService.preferences$.subscribe(
        preferences => {
          this.baby = {
            name: preferences.baby.name,
            age:
              this.preferencesService.getAgeLabel(
                preferences.baby.birthDate
              ),
            mood: preferences.baby.mood
          };
          this.updateDonuts();
        }
      );

    this.clockTimer = setInterval(() => {
      this.updateGreeting();
      this.refreshLastActivityText();
    }, 60_000);

    this.refreshActiveNursing();
    this.nursingClock = setInterval(() => {
      this.refreshActiveNursing();
    }, 1000);
  }

  ionViewWillEnter(): void {
    this.refreshHomeData();
    this.refreshActiveNursing();
    void this.loadBabyPhoto();
  }

  private async loadBabyPhoto(): Promise<void> {
    this.babyPhotoUrl =
      await this.photoStorageService.getPhotoUrl(
        this.babyProfileService.activeProfile?.photoId
      );
  }

  ngOnDestroy(): void {
    this.activitiesSubscription?.unsubscribe();
    this.preferencesSubscription?.unsubscribe();

    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }
    if (this.nursingClock) {
      clearInterval(this.nursingClock);
    }
  }

  get activeNursingDuration(): string {
    const totalSeconds =
      (this.activeNursing?.leftSeconds || 0) +
      (this.activeNursing?.rightSeconds || 0);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  get activeNursingStatus(): string {
    const side = this.activeNursing?.activeSide;
    return side
      ? `${side[0].toUpperCase()}${side.slice(1)} side active`
      : 'Timer paused';
  }

  private refreshActiveNursing(): void {
    this.activeNursing = this.nursingService.snapshot();
  }

  getIcon(type: Activity['type']): string {
    switch (type) {
      case 'feeding':
        return '🍼';

      case 'solids':
        return '🥣';

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

      case 'solids':
        return 'solids-accent';

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
      solids: '/solids',
      sleep: '/sleep',
      diaper: '/diaper'
    };

    void this.router.navigate([
      routeByType[type]
    ]);
  }

  async switchBaby(profileId: string): Promise<void> {
    if (this.babyProfileService.switchProfile(profileId)) {
      await this.babyProfileService.waitForSync();
      window.location.reload();
    }
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

    const lastSolidFood = activities.find(
      activity =>
        activity.type === 'solids'
    );

    this.lastFeedText = lastFeed
      ? this.getTimeAgo(lastFeed.createdAt)
      : 'No feed logged';

    this.lastSleepText = lastSleep
      ? this.getTimeAgo(lastSleep.createdAt)
      : 'No sleep logged';

    this.lastSolidFoodText = lastSolidFood
      ? this.getTimeAgo(lastSolidFood.createdAt)
      : 'No solid food logged';
  }

  private updateDonuts(): void {
    const goals =
      this.preferencesService.preferences.goals;

    this.donuts = [
      {
        label: 'Feeds',
        value: this.stats.feeds,
        goal: goals.feeds,
        percent: this.calculatePercent(
          this.stats.feeds,
          goals.feeds
        ),
        icon: '🍼',
        class: 'feed-donut',
        unit: 'logs'
      },
      {
        label: 'Sleep',
        value: this.stats.sleep,
        goal: goals.sleepSessions,
        percent: this.calculatePercent(
          this.stats.sleep,
          goals.sleepSessions
        ),
        icon: '😴',
        class: 'sleep-donut',
        unit: 'sessions'
      },
      {
        label: 'Diapers',
        value: this.stats.diapers,
        goal: goals.diapers,
        percent: this.calculatePercent(
          this.stats.diapers,
          goals.diapers
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
