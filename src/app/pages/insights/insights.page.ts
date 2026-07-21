import {
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';

import {
  CommonModule
} from '@angular/common';

import {
  IonicModule
} from '@ionic/angular';

import {
  Subscription
} from 'rxjs';

import {
  ActivityService
} from '../../services/activity.service';

import {
  SleepService
} from '../../services/sleep';

import {
 AnalyticsComparison,
  DailyAnalytics,
  InsightMessage,
  InsightService,
  TrendDirection,
  WeeklyAnalytics
} from './../../services/insights';

@Component({
  selector: 'app-insights',
  templateUrl: './insights.page.html',
  styleUrls: ['./insights.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule
  ]
})
export class InsightsPage
  implements OnInit, OnDestroy {
weeklyAnalytics:
  WeeklyAnalytics =
    this.createEmptyWeeklyAnalytics();
  todayAnalytics:
    DailyAnalytics =
    this.createEmptyAnalytics();

  yesterdayAnalytics:
    DailyAnalytics =
    this.createEmptyAnalytics();

  comparison:
    AnalyticsComparison = {
      activityDifference: 0,
      feedingDifference: 0,
      sleepMinutesDifference: 0,
      diaperDifference: 0
    };

  insightMessages:
    InsightMessage[] = [];

  activeSleepDisplay = '0 min';

  hasActiveSleepSession = false;

  private activitySubscription?:
    Subscription;

  constructor(
    private readonly activityService:
      ActivityService,

    private readonly sleepService:
      SleepService,

    private readonly insightService:
      InsightService
  ) { }

  ngOnInit(): void {
    this.activitySubscription =
      this.activityService.activities$
        .subscribe(activities => {
          this.calculateAnalytics(
            activities
          );
        });

    this.updateActiveSleep();
  }

  ionViewWillEnter(): void {
    this.calculateAnalytics(
      this.activityService.getActivities()
    );

    this.updateActiveSleep();
  }

  get todayDateLabel(): string {
    return new Date().toLocaleDateString(
      [],
      {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      }
    );
  }

  get lastFeedText(): string {
    const lastFeedAt =
      this.todayAnalytics
        .feeding
        .lastFeedAt;

    if (!lastFeedAt) {
      return 'No feed yet';
    }

    const differenceMinutes =
      Math.max(
        0,
        Math.floor(
          (
            Date.now() -
            lastFeedAt
          ) / 60000
        )
      );

    if (differenceMinutes < 1) {
      return 'Just now';
    }

    if (differenceMinutes < 60) {
      return `${differenceMinutes} min ago`;
    }

    return (
      `${Math.floor(
        differenceMinutes / 60
      )} hr ` +
      `${differenceMinutes % 60} min ago`
    );
  }

  get feedingIntervalText(): string {
    return this.formatDuration(
      this.todayAnalytics
        .feeding
        .averageIntervalMinutes
    );
  }

  get totalSleepText(): string {
    return this.formatDuration(
      this.todayAnalytics
        .sleep
        .totalMinutes
    );
  }
getFeedingBarHeight(
  value: number
): number {
  return this.insightService
    .getBarHeight(
      value,
      this.weeklyAnalytics
        .maximums
        .feedingCount
    );
}

getVolumeBarHeight(
  value: number
): number {
  return this.insightService
    .getBarHeight(
      value,
      this.weeklyAnalytics
        .maximums
        .feedingVolumeMl
    );
}

getSleepBarHeight(
  value: number
): number {
  return this.insightService
    .getBarHeight(
      value,
      this.weeklyAnalytics
        .maximums
        .sleepMinutes
    );
}

getDiaperBarHeight(
  value: number
): number {
  return this.insightService
    .getBarHeight(
      value,
      this.weeklyAnalytics
        .maximums
        .diaperCount
    );
}

getTrendLabel(
  trend: TrendDirection
): string {
  return this.insightService
    .getTrendLabel(trend);
}

getTrendIcon(
  trend: TrendDirection
): string {
  return this.insightService
    .getTrendIcon(trend);
}

getTrendClass(
  trend: TrendDirection
): string {
  return `trend-${trend}`;
}

get weeklyAverageSleepText():
  string {
  return this.formatDuration(
    this.weeklyAnalytics
      .averages
      .sleepMinutes
  );
}

get todayVsAverageText():
  string {
  const today =
    this.todayAnalytics
      .totalActivities;

  const average =
    this.weeklyAnalytics
      .averages
      .totalActivities;

  const difference =
    today - average;

  if (
    Math.abs(difference) < 0.5
  ) {
    return 'Near the 7-day average';
  }

  if (difference > 0) {
    return (
      `${this.formatNumber(
        difference
      )} above average`
    );
  }

  return (
    `${this.formatNumber(
      Math.abs(difference)
    )} below average`
  );
}

trackByDay(
  _index: number,
  day: {
    date: Date;
  }
): number {
  return day.date.getTime();
}

private formatNumber(
  value: number
): string {
  return Number.isInteger(value)
    ? value.toString()
    : value.toFixed(1);
}

private createEmptyWeeklyAnalytics():
  WeeklyAnalytics {
  return {
    days: [],

    averages: {
      feedingCount: 0,
      feedingVolumeMl: 0,
      sleepMinutes: 0,
      diaperCount: 0,
      totalActivities: 0
    },

    totals: {
      feedingCount: 0,
      feedingVolumeMl: 0,
      sleepMinutes: 0,
      diaperCount: 0,
      totalActivities: 0
    },

    maximums: {
      feedingCount: 1,
      feedingVolumeMl: 1,
      sleepMinutes: 1,
      diaperCount: 1
    },

    busiestDay: null,

    trends: {
      feeding: 'insufficient',
      feedingVolume: 'insufficient',
      sleep: 'insufficient',
      diaper: 'insufficient'
    }
  };
}
formatChartDuration(
  totalMinutes: number
): string {
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const hours =
    Math.floor(
      totalMinutes / 60
    );

  const minutes =
    totalMinutes % 60;

  return minutes > 0
    ? `${hours}h${minutes}m`
    : `${hours}h`;
}
  get longestSleepText(): string {
    return this.formatDuration(
      this.todayAnalytics
        .sleep
        .longestMinutes
    );
  }

  get averageSleepText(): string {
    return this.formatDuration(
      this.todayAnalytics
        .sleep
        .averageMinutes
    );
  }

  trackByInsightTitle(
    _index: number,
    insight: InsightMessage
  ): string {
    return insight.title;
  }

  private calculateAnalytics(
    activities:
      ReturnType<
        ActivityService['getActivities']
      >
  ): void {
    const today =
      new Date();

    const yesterday =
      new Date();

    yesterday.setDate(
      yesterday.getDate() - 1
    );

    this.todayAnalytics =
      this.insightService
        .calculateDailyAnalytics(
          activities,
          today
        );

    this.yesterdayAnalytics =
      this.insightService
        .calculateDailyAnalytics(
          activities,
          yesterday
        );

    this.comparison =
      this.insightService.compareDays(
        this.todayAnalytics,
        this.yesterdayAnalytics
      );

    this.insightMessages =
      this.insightService
        .createInsightMessages(
          this.todayAnalytics,
          this.comparison
        );
  }

  private updateActiveSleep(): void {
    const sleepState =
      this.sleepService.getState();

    const elapsedMilliseconds =
      this.sleepService.getTime(
        sleepState
      );

    this.hasActiveSleepSession =
      sleepState.sessionActive &&
      elapsedMilliseconds > 0;

    this.activeSleepDisplay =
      this.formatDuration(
        Math.floor(
          elapsedMilliseconds / 60000
        )
      );
  }

  private formatDuration(
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

  private createEmptyAnalytics():
    DailyAnalytics {
    return {
      date: new Date(),

      totalActivities: 0,

      feeding: {
        count: 0,
        totalAmountMl: 0,
        averageAmountMl: 0,
        averageIntervalMinutes: 0,
        lastFeedAt: null
      },

      sleep: {
        count: 0,
        totalMinutes: 0,
        averageMinutes: 0,
        longestMinutes: 0
      },

      diaper: {
        count: 0,
        breakdown: {
          wet: 0,
          dirty: 0,
          both: 0
        }
      }
    };
  }

  ngOnDestroy(): void {
    this.activitySubscription
      ?.unsubscribe();
  }
}