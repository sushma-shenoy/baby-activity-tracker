import { Injectable } from '@angular/core';
import { Activity } from '../shared/models/activity-model';

export interface DiaperBreakdown {
  wet: number;
  dirty: number;
  both: number;
}

export interface DailyAnalytics {
  date: Date;

  totalActivities: number;

  feeding: {
    count: number;
    totalAmountMl: number;
    averageAmountMl: number;
    averageIntervalMinutes: number;
    lastFeedAt: number | null;
  };

  sleep: {
    count: number;
    totalMinutes: number;
    averageMinutes: number;
    longestMinutes: number;
  };

  diaper: {
    count: number;
    breakdown: DiaperBreakdown;
  };
}

export interface AnalyticsComparison {
  activityDifference: number;
  feedingDifference: number;
  sleepMinutesDifference: number;
  diaperDifference: number;
}

export interface InsightMessage {
  icon: string;
  title: string;
  message: string;
  type: 'feeding' | 'sleep' | 'diaper' | 'general';
}

@Injectable({
  providedIn: 'root'
})
export class InsightService {
  calculateDailyAnalytics(
    activities: Activity[],
    targetDate = new Date()
  ): DailyAnalytics {
    const dailyActivities = activities
      .filter(activity =>
        this.isSameDay(
          activity.createdAt,
          targetDate
        )
      )
      .sort(
        (first, second) =>
          first.createdAt - second.createdAt
      );

    const feedingActivities =
      dailyActivities.filter(
        activity =>
          activity.type === 'feeding'
      );

    const sleepActivities =
      dailyActivities.filter(
        activity =>
          activity.type === 'sleep'
      );

    const diaperActivities =
      dailyActivities.filter(
        activity =>
          activity.type === 'diaper'
      );

    const feedingAmounts =
      feedingActivities
        .map(activity =>
          this.parseFeedingAmount(
            activity.value
          )
        )
        .filter(amount => amount > 0);

    const sleepDurations =
      sleepActivities
        .map(activity =>
          this.parseSleepDuration(
            activity.value
          )
        )
        .filter(duration => duration > 0);

    const diaperBreakdown =
      this.calculateDiaperBreakdown(
        diaperActivities
      );

    const totalFeedAmount =
      feedingAmounts.reduce(
        (total, amount) =>
          total + amount,
        0
      );

    const totalSleepMinutes =
      sleepDurations.reduce(
        (total, duration) =>
          total + duration,
        0
      );

    return {
      date: targetDate,

      totalActivities:
        dailyActivities.length,

      feeding: {
        count:
          feedingActivities.length,

        totalAmountMl:
          totalFeedAmount,

        averageAmountMl:
          feedingAmounts.length
            ? Math.round(
                totalFeedAmount /
                feedingAmounts.length
              )
            : 0,

        averageIntervalMinutes:
          this.calculateAverageInterval(
            feedingActivities
          ),

        lastFeedAt:
          feedingActivities.length
            ? feedingActivities[
                feedingActivities.length - 1
              ].createdAt
            : null
      },

      sleep: {
        count:
          sleepActivities.length,

        totalMinutes:
          totalSleepMinutes,

        averageMinutes:
          sleepDurations.length
            ? Math.round(
                totalSleepMinutes /
                sleepDurations.length
              )
            : 0,

        longestMinutes:
          sleepDurations.length
            ? Math.max(
                ...sleepDurations
              )
            : 0
      },

      diaper: {
        count:
          diaperActivities.length,

        breakdown:
          diaperBreakdown
      }
    };
  }

  compareDays(
    today: DailyAnalytics,
    yesterday: DailyAnalytics
  ): AnalyticsComparison {
    return {
      activityDifference:
        today.totalActivities -
        yesterday.totalActivities,

      feedingDifference:
        today.feeding.count -
        yesterday.feeding.count,

      sleepMinutesDifference:
        today.sleep.totalMinutes -
        yesterday.sleep.totalMinutes,

      diaperDifference:
        today.diaper.count -
        yesterday.diaper.count
    };
  }

  calculateWeeklyAnalytics(
  activities: Activity[],
  endDate = new Date()
): WeeklyAnalytics {
  const days: WeeklyDayAnalytics[] = [];

  for (let offset = 6; offset >= 0; offset--) {
    const date = new Date(endDate);

    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - offset);

    const analytics =
      this.calculateDailyAnalytics(
        activities,
        date
      );

    days.push({
      date,
      dayLabel:
        date.toLocaleDateString(
          [],
          {
            weekday: 'short'
          }
        ),

      shortDateLabel:
        date.toLocaleDateString(
          [],
          {
            month: 'short',
            day: 'numeric'
          }
        ),

      isToday:
        this.isSameDay(
          date.getTime(),
          endDate
        ),

      feedingCount:
        analytics.feeding.count,

      feedingVolumeMl:
        analytics.feeding.totalAmountMl,

      sleepMinutes:
        analytics.sleep.totalMinutes,

      diaperCount:
        analytics.diaper.count,

      totalActivities:
        analytics.totalActivities
    });
  }

  const totals = {
    feedingCount:
      this.sum(
        days.map(day =>
          day.feedingCount
        )
      ),

    feedingVolumeMl:
      this.sum(
        days.map(day =>
          day.feedingVolumeMl
        )
      ),

    sleepMinutes:
      this.sum(
        days.map(day =>
          day.sleepMinutes
        )
      ),

    diaperCount:
      this.sum(
        days.map(day =>
          day.diaperCount
        )
      ),

    totalActivities:
      this.sum(
        days.map(day =>
          day.totalActivities
        )
      )
  };

  const averages = {
    feedingCount:
      this.roundToOneDecimal(
        totals.feedingCount /
        days.length
      ),

    feedingVolumeMl:
      Math.round(
        totals.feedingVolumeMl /
        days.length
      ),

    sleepMinutes:
      Math.round(
        totals.sleepMinutes /
        days.length
      ),

    diaperCount:
      this.roundToOneDecimal(
        totals.diaperCount /
        days.length
      ),

    totalActivities:
      this.roundToOneDecimal(
        totals.totalActivities /
        days.length
      )
  };

  const maximums = {
    feedingCount:
      Math.max(
        1,
        ...days.map(day =>
          day.feedingCount
        )
      ),

    feedingVolumeMl:
      Math.max(
        1,
        ...days.map(day =>
          day.feedingVolumeMl
        )
      ),

    sleepMinutes:
      Math.max(
        1,
        ...days.map(day =>
          day.sleepMinutes
        )
      ),

    diaperCount:
      Math.max(
        1,
        ...days.map(day =>
          day.diaperCount
        )
      )
  };

  const busiestDay =
    days.reduce<WeeklyDayAnalytics | null>(
      (busiest, current) => {
        if (
          !busiest ||
          current.totalActivities >
          busiest.totalActivities
        ) {
          return current;
        }

        return busiest;
      },
      null
    );

  return {
    days,
    averages,
    totals,
    maximums,
    busiestDay,

    trends: {
      feeding:
        this.calculateTrend(
          days.map(day =>
            day.feedingCount
          )
        ),

      feedingVolume:
        this.calculateTrend(
          days.map(day =>
            day.feedingVolumeMl
          )
        ),

      sleep:
        this.calculateTrend(
          days.map(day =>
            day.sleepMinutes
          )
        ),

      diaper:
        this.calculateTrend(
          days.map(day =>
            day.diaperCount
          )
        )
    }
  };
}

getBarHeight(
  value: number,
  maximum: number
): number {
  if (
    value <= 0 ||
    maximum <= 0
  ) {
    return 4;
  }

  return Math.max(
    8,
    Math.round(
      value / maximum * 100
    )
  );
}

getTrendLabel(
  trend: TrendDirection
): string {
  switch (trend) {
    case 'increasing':
      return 'Increasing';

    case 'decreasing':
      return 'Decreasing';

    case 'stable':
      return 'Stable';

    default:
      return 'More data needed';
  }
}

getTrendIcon(
  trend: TrendDirection
): string {
  switch (trend) {
    case 'increasing':
      return '↗';

    case 'decreasing':
      return '↘';

    case 'stable':
      return '→';

    default:
      return '—';
  }
}

private calculateTrend(
  values: number[]
): TrendDirection {
  const recordedValues =
    values.filter(value =>
      value > 0
    );

  if (recordedValues.length < 3) {
    return 'insufficient';
  }

  const midpoint =
    Math.floor(
      values.length / 2
    );

  const firstHalf =
    values.slice(0, midpoint);

  const secondHalf =
    values.slice(midpoint);

  const firstAverage =
    this.average(firstHalf);

  const secondAverage =
    this.average(secondHalf);

  if (
    firstAverage === 0 &&
    secondAverage === 0
  ) {
    return 'insufficient';
  }

  const baseline =
    Math.max(
      firstAverage,
      1
    );

  const changePercentage =
    (
      secondAverage -
      firstAverage
    ) / baseline * 100;

  if (changePercentage >= 15) {
    return 'increasing';
  }

  if (changePercentage <= -15) {
    return 'decreasing';
  }

  return 'stable';
}

private average(
  values: number[]
): number {
  if (values.length === 0) {
    return 0;
  }

  return (
    this.sum(values) /
    values.length
  );
}

private sum(
  values: number[]
): number {
  return values.reduce(
    (total, value) =>
      total + value,
    0
  );
}

private roundToOneDecimal(
  value: number
): number {
  return Math.round(
    value * 10
  ) / 10;
}
  createInsightMessages(
    today: DailyAnalytics,
    comparison: AnalyticsComparison
  ): InsightMessage[] {
    const messages: InsightMessage[] = [];

    messages.push(
      this.createFeedingInsight(
        today,
        comparison
      )
    );

    messages.push(
      this.createSleepInsight(
        today,
        comparison
      )
    );

    messages.push(
      this.createDiaperInsight(
        today,
        comparison
      )
    );

    messages.push({
      icon: '✨',
      title: 'Daily activity',
      message:
        this.createActivitySummary(
          today,
          comparison
        ),
      type: 'general'
    });

    return messages;
  }

  parseFeedingAmount(
    value: string
  ): number {
    const normalizedValue =
      value.toLowerCase();

    const mlMatch =
      normalizedValue.match(
        /(\d+(?:\.\d+)?)\s*ml/
      );

    if (mlMatch) {
      return Math.round(
        Number(mlMatch[1])
      );
    }

    const ounceMatch =
      normalizedValue.match(
        /(\d+(?:\.\d+)?)\s*(?:oz|ounce|ounces)/
      );

    if (ounceMatch) {
      return Math.round(
        Number(ounceMatch[1]) *
        29.5735
      );
    }

    return 0;
  }

  parseSleepDuration(
    value: string
  ): number {
    const normalizedValue =
      value.toLowerCase();

    const clockMatch =
      normalizedValue.match(
        /(\d{1,2}):(\d{2}):(\d{2})/
      );

    if (clockMatch) {
      const hours =
        Number(clockMatch[1]);

      const minutes =
        Number(clockMatch[2]);

      const seconds =
        Number(clockMatch[3]);

      return Math.round(
        hours * 60 +
        minutes +
        seconds / 60
      );
    }

    const hourMatch =
      normalizedValue.match(
        /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)/
      );

    const minuteMatch =
      normalizedValue.match(
        /(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)/
      );

    const hours =
      hourMatch
        ? Number(hourMatch[1])
        : 0;

    const minutes =
      minuteMatch
        ? Number(minuteMatch[1])
        : 0;

    return Math.round(
      hours * 60 + minutes
    );
  }

  private calculateAverageInterval(
    activities: Activity[]
  ): number {
    if (activities.length < 2) {
      return 0;
    }

    const timestamps =
      activities
        .map(activity =>
          activity.createdAt
        )
        .sort(
          (first, second) =>
            first - second
        );

    let totalInterval = 0;

    for (
      let index = 1;
      index < timestamps.length;
      index++
    ) {
      totalInterval +=
        timestamps[index] -
        timestamps[index - 1];
    }

    const averageMilliseconds =
      totalInterval /
      (timestamps.length - 1);

    return Math.round(
      averageMilliseconds / 60000
    );
  }

  private calculateDiaperBreakdown(
    activities: Activity[]
  ): DiaperBreakdown {
    const breakdown: DiaperBreakdown = {
      wet: 0,
      dirty: 0,
      both: 0
    };

    for (const activity of activities) {
      const normalizedValue =
        activity.value.toLowerCase();

      if (
        normalizedValue.includes(
          'wet and dirty'
        ) ||
        normalizedValue.includes('both')
      ) {
        breakdown.both++;
        continue;
      }

      if (
        normalizedValue.includes(
          'dirty'
        )
      ) {
        breakdown.dirty++;
        continue;
      }

      if (
        normalizedValue.includes(
          'wet'
        )
      ) {
        breakdown.wet++;
      }
    }

    return breakdown;
  }

  private createFeedingInsight(
    today: DailyAnalytics,
    comparison: AnalyticsComparison
  ): InsightMessage {
    if (today.feeding.count === 0) {
      return {
        icon: '🍼',
        title: 'Feeding',
        message:
          'No feeding activity has been recorded today.',
        type: 'feeding'
      };
    }

    const amountText =
      today.feeding.averageAmountMl > 0
        ? ` Average recorded amount is ${today.feeding.averageAmountMl} ml.`
        : '';

    const comparisonText =
      this.formatCountComparison(
        comparison.feedingDifference,
        'feed'
      );

    return {
      icon: '🍼',
      title: 'Feeding',
      message:
        `${today.feeding.count} ` +
        `${today.feeding.count === 1
          ? 'feed'
          : 'feeds'} recorded today.` +
        amountText +
        comparisonText,
      type: 'feeding'
    };
  }

  private createSleepInsight(
    today: DailyAnalytics,
    comparison: AnalyticsComparison
  ): InsightMessage {
    if (today.sleep.count === 0) {
      return {
        icon: '😴',
        title: 'Sleep',
        message:
          'No completed sleep activity has been recorded today.',
        type: 'sleep'
      };
    }

    const comparisonText =
      comparison.sleepMinutesDifference === 0
        ? ' This matches yesterday’s recorded sleep.'
        : comparison.sleepMinutesDifference > 0
          ? ` This is ${this.formatDuration(
              comparison.sleepMinutesDifference
            )} more than yesterday.`
          : ` This is ${this.formatDuration(
              Math.abs(
                comparison.sleepMinutesDifference
              )
            )} less than yesterday.`;

    return {
      icon: '😴',
      title: 'Sleep',
      message:
        `${this.formatDuration(
          today.sleep.totalMinutes
        )} of sleep has been recorded today. ` +
        `The longest session was ${this.formatDuration(
          today.sleep.longestMinutes
        )}.` +
        comparisonText,
      type: 'sleep'
    };
  }

  private createDiaperInsight(
    today: DailyAnalytics,
    comparison: AnalyticsComparison
  ): InsightMessage {
    if (today.diaper.count === 0) {
      return {
        icon: '🧷',
        title: 'Diapers',
        message:
          'No diaper changes have been recorded today.',
        type: 'diaper'
      };
    }

    const breakdown =
      today.diaper.breakdown;

    return {
      icon: '🧷',
      title: 'Diapers',
      message:
        `${today.diaper.count} changes recorded: ` +
        `${breakdown.wet} wet, ` +
        `${breakdown.dirty} dirty and ` +
        `${breakdown.both} both.` +
        this.formatCountComparison(
          comparison.diaperDifference,
          'change'
        ),
      type: 'diaper'
    };
  }

  private createActivitySummary(
    today: DailyAnalytics,
    comparison: AnalyticsComparison
  ): string {
    if (today.totalActivities === 0) {
      return (
        'No activities have been recorded today. ' +
        'Add a feeding, sleep or diaper entry to begin the summary.'
      );
    }

    if (comparison.activityDifference === 0) {
      return (
        `${today.totalActivities} activities have been recorded today, ` +
        `the same number as yesterday.`
      );
    }

    if (comparison.activityDifference > 0) {
      return (
        `${today.totalActivities} activities have been recorded today, ` +
        `${comparison.activityDifference} more than yesterday.`
      );
    }

    return (
      `${today.totalActivities} activities have been recorded today, ` +
      `${Math.abs(
        comparison.activityDifference
      )} fewer than yesterday.`
    );
  }

  private formatCountComparison(
    difference: number,
    singularLabel: string
  ): string {
    if (difference === 0) {
      return '';
    }

    const absoluteDifference =
      Math.abs(difference);

    const label =
      absoluteDifference === 1
        ? singularLabel
        : `${singularLabel}s`;

    return difference > 0
      ? ` That is ${absoluteDifference} ${label} more than yesterday.`
      : ` That is ${absoluteDifference} ${label} fewer than yesterday.`;
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

    return `${hours} hr ${minutes} min`;
  }

  private isSameDay(
    timestamp: number,
    targetDate: Date
  ): boolean {
    const date =
      new Date(timestamp);

    return (
      date.getFullYear() ===
        targetDate.getFullYear() &&
      date.getMonth() ===
        targetDate.getMonth() &&
      date.getDate() ===
        targetDate.getDate()
    );
  }
}

export interface WeeklyDayAnalytics {
  date: Date;
  dayLabel: string;
  shortDateLabel: string;
  isToday: boolean;

  feedingCount: number;
  feedingVolumeMl: number;
  sleepMinutes: number;
  diaperCount: number;
  totalActivities: number;
}

export interface WeeklyAnalytics {
  days: WeeklyDayAnalytics[];

  averages: {
    feedingCount: number;
    feedingVolumeMl: number;
    sleepMinutes: number;
    diaperCount: number;
    totalActivities: number;
  };

  totals: {
    feedingCount: number;
    feedingVolumeMl: number;
    sleepMinutes: number;
    diaperCount: number;
    totalActivities: number;
  };

  maximums: {
    feedingCount: number;
    feedingVolumeMl: number;
    sleepMinutes: number;
    diaperCount: number;
  };

  busiestDay: WeeklyDayAnalytics | null;

  trends: {
    feeding: TrendDirection;
    feedingVolume: TrendDirection;
    sleep: TrendDirection;
    diaper: TrendDirection;
  };
}

export type TrendDirection =
  | 'increasing'
  | 'decreasing'
  | 'stable'
  | 'insufficient';
  
  