import {
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';

import {
  CommonModule
} from '@angular/common';

import {
  FormsModule
} from '@angular/forms';

import {
  ActionSheetController,
  AlertController,
  IonicModule
} from '@ionic/angular';

import {
  interval,
  Subscription
} from 'rxjs';

import {
  SleepService
} from '../../services/sleep';

import {
  ActivityService
} from '../../services/activity.service';

import {
  Activity
} from '../../shared/models/activity-model';

@Component({
  selector: 'app-sleep',
  templateUrl: './sleep.page.html',
  styleUrls: ['./sleep.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonicModule
  ]
})
export class SleepPage
  implements OnInit, OnDestroy {

  sleepActivities: Activity[] = [];

  isSleepEditOpen = false;

  timerDisplay = '00:00:00';

  editSleep = {
    id: '',
    durationHours: 0,
    durationMinutes: 0,
    dateTime: new Date().toISOString()
  };

  private timerSubscription?: Subscription;

  constructor(
    public readonly sleepService:
      SleepService,

    private readonly activityService:
      ActivityService,

    private readonly actionSheetController:
      ActionSheetController,

    private readonly alertController:
      AlertController
  ) {}

  ngOnInit(): void {
    this.updateTimerDisplay();

    this.timerSubscription =
      interval(1000).subscribe(() => {
        this.updateTimerDisplay();
      });
  }

  ionViewWillEnter(): void {
    this.loadSleepActivities();
    this.updateTimerDisplay();
  }

  get isRunning(): boolean {
    return Boolean(
      this.sleepService.getState().isRunning
    );
  }

  get hasActiveSession(): boolean {
    const state =
      this.sleepService.getState();

    const elapsedMilliseconds =
      this.sleepService.getTime(state);

    return Boolean(
      state.sessionActive ||
      state.isRunning ||
      elapsedMilliseconds > 0
    );
  }

  get isEditDurationValid(): boolean {
    const hours = Math.max(
      0,
      Number(
        this.editSleep.durationHours
      ) || 0
    );

    const minutes = Math.max(
      0,
      Number(
        this.editSleep.durationMinutes
      ) || 0
    );

    return hours > 0 || minutes > 0;
  }

  start(): void {
    this.sleepService.start();
    this.updateTimerDisplay();
  }

  pause(): void {
    this.sleepService.pause();
    this.updateTimerDisplay();
  }

  stop(): void {
    const stateBeforeStop =
      this.sleepService.getState();

    const totalMilliseconds =
      this.sleepService.getTime(
        stateBeforeStop
      );

    if (
      !stateBeforeStop.sessionActive ||
      totalMilliseconds <= 0
    ) {
      return;
    }

    this.sleepService.stop();

    const completedAt = Date.now();

    const sleepActivityId =
      `sleep-${completedAt}`;

    const sleepActivity: Activity = {
      id: sleepActivityId,
      type: 'sleep',
      title: 'Sleep',
      value:
        this.formatDurationValue(
          totalMilliseconds
        ),
      time:
        new Date(
          completedAt
        ).toLocaleTimeString(
          [],
          {
            hour: '2-digit',
            minute: '2-digit'
          }
        ),
      createdAt: completedAt
    };

    this.activityService.add(
      sleepActivity
    );

    this.sleepService.reset();

    this.timerDisplay =
      '00:00:00';

    this.loadSleepActivities();
  }

  async openSleepActions(
    activity: Activity,
    event?: Event
  ): Promise<void> {
    event?.stopPropagation();

    const actionSheet =
      await this.actionSheetController.create({
        header:
          `Sleep · ${activity.value}`,

        cssClass:
          'activity-action-sheet',

        buttons: [
          {
            text: 'Edit activity',
            icon: 'create-outline',
            data: {
              action: 'edit'
            }
          },
          {
            text: 'Delete activity',
            icon: 'trash-outline',
            role: 'destructive',
            data: {
              action: 'delete'
            }
          },
          {
            text: 'Cancel',
            icon: 'close-outline',
            role: 'cancel',
            data: {
              action: 'cancel'
            }
          }
        ]
      });

    await actionSheet.present();

    const result =
      await actionSheet.onDidDismiss();

    const selectedAction =
      result.data?.action;

    if (selectedAction === 'edit') {
      this.openSleepEdit(activity);
      return;
    }

    if (selectedAction === 'delete') {
      await this.confirmDeleteSleep(
        activity
      );
    }
  }

  async confirmDeleteSleep(
    activity: Activity
  ): Promise<void> {
    const alert =
      await this.alertController.create({
        header:
          'Delete sleep session?',

        message:
          `${activity.value} at ` +
          `${activity.time} will be ` +
          `permanently removed.`,

        cssClass:
          'activity-delete-alert',

        buttons: [
          {
            text: 'Cancel',
            role: 'cancel'
          },
          {
            text: 'Delete',
            role: 'destructive',
            handler: () => {
              this.deleteSleep(
                activity.id
              );
            }
          }
        ]
      });

    await alert.present();
  }

  openSleepEdit(
    activity: Activity
  ): void {
    const totalMinutes =
      this.parseSleepDuration(
        activity.value
      );

    this.editSleep = {
      id: activity.id,
      durationHours:
        Math.floor(
          totalMinutes / 60
        ),
      durationMinutes:
        totalMinutes % 60,
      dateTime:
        new Date(
          activity.createdAt
        ).toISOString()
    };

    this.isSleepEditOpen = true;
  }

  saveSleepEdit(): void {
    if (
      !this.editSleep.id ||
      !this.isEditDurationValid
    ) {
      return;
    }

    const hours = Math.max(
      0,
      Number(
        this.editSleep.durationHours
      ) || 0
    );

    const enteredMinutes = Math.max(
      0,
      Number(
        this.editSleep.durationMinutes
      ) || 0
    );

    const minutes =
      Math.min(
        enteredMinutes,
        59
      );

    const totalMinutes =
      hours * 60 + minutes;

    const selectedDate =
      new Date(
        this.editSleep.dateTime
      );

    const createdAt =
      Number.isNaN(
        selectedDate.getTime()
      )
        ? Date.now()
        : selectedDate.getTime();

    this.activityService.update(
      this.editSleep.id,
      {
        value:
          this.formatMinutes(
            totalMinutes
          ),

        time:
          new Date(
            createdAt
          ).toLocaleTimeString(
            [],
            {
              hour: '2-digit',
              minute: '2-digit'
            }
          ),

        createdAt
      }
    );

    this.closeSleepEdit();
    this.loadSleepActivities();
  }

  closeSleepEdit(): void {
    this.isSleepEditOpen = false;

    this.editSleep = {
      id: '',
      durationHours: 0,
      durationMinutes: 0,
      dateTime:
        new Date().toISOString()
    };
  }

  deleteSleep(
    activityId: string
  ): void {
    this.activityService.delete(
      activityId
    );

    this.loadSleepActivities();
  }

  trackByActivityId(
    _index: number,
    activity: Activity
  ): string {
    return activity.id;
  }

  private loadSleepActivities(): void {
    this.sleepActivities = [
      ...this.activityService.getByType(
        'sleep'
      )
    ].sort(
      (
        firstActivity,
        secondActivity
      ) =>
        secondActivity.createdAt -
        firstActivity.createdAt
    );
  }

  private updateTimerDisplay(): void {
    const state =
      this.sleepService.getState();

    this.timerDisplay =
      this.formatTime(state);
  }

  private formatTime(
    state: any
  ): string {
    let totalMilliseconds =
      Number(state.elapsed) || 0;

    if (
      state.isRunning &&
      state.startTime
    ) {
      totalMilliseconds +=
        Date.now() -
        state.startTime;
    }

    const totalSeconds =
      Math.floor(
        totalMilliseconds / 1000
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

  private parseSleepDuration(
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
      return (
        `${hours} ` +
        `${hours === 1 ? 'hr' : 'hrs'}`
      );
    }

    return (
      `${hours} ` +
      `${hours === 1 ? 'hr' : 'hrs'} ` +
      `${minutes} min`
    );
  }

  private formatDurationValue(
    milliseconds: number
  ): string {
    const totalMinutes =
      Math.max(
        1,
        Math.floor(
          milliseconds / 60000
        )
      );

    return this.formatMinutes(
      totalMinutes
    );
  }

  private pad(
    value: number
  ): string {
    return value
      .toString()
      .padStart(2, '0');
  }

  ngOnDestroy(): void {
    this.timerSubscription
      ?.unsubscribe();
  }
}