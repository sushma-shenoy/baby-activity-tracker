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
  Feed,
  FeedService
} from '../../services/feed';

import {
  ActivityService
} from '../../services/activity.service';
import {
  ActiveNursingSession,
  NursingService,
  NursingSession,
  NursingSide
} from '../../services/nursing.service';

@Component({
  selector: 'app-feeding',
  templateUrl: './feeding.page.html',
  styleUrls: ['./feeding.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonicModule
  ]
})
export class FeedingPage implements OnInit, OnDestroy {
  feeds: Feed[] = [];
  nursingSessions: NursingSession[] = [];
  activeNursing: ActiveNursingSession | null = null;
  showManualNursing = false;
  nursingError = '';
  editingNursingId = '';
  manualNursing = this.createManualNursing();
  private nursingClock?: ReturnType<typeof setInterval>;

  isEditOpen = false;

  newFeedPickerValue =
    new Date().toISOString();

  editFeedPickerValue =
    new Date().toISOString();

  newFeed: Feed = {
    id: '',
    quantity: 120,
    type: 'formula',
    time: this.getCurrentTime()
  };

  editFeed: Feed = {
    id: '',
    quantity: 120,
    type: 'formula',
    time: this.getCurrentTime()
  };

  constructor(
    public readonly feedService: FeedService,
    private readonly activityService:
      ActivityService,
    private readonly nursingService:
      NursingService,
    private readonly actionSheetController:
      ActionSheetController,
    private readonly alertController:
      AlertController
  ) {}

  ngOnInit(): void {
    this.loadFeeds();
    this.loadNursing();
    this.nursingClock = setInterval(() => {
      this.activeNursing = this.nursingService.snapshot();
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.nursingClock) clearInterval(this.nursingClock);
  }

  ionViewWillEnter(): void {
    this.loadFeeds();
    this.loadNursing();
  }

  loadNursing(): void {
    this.nursingSessions = this.nursingService.getSessions();
    this.activeNursing = this.nursingService.snapshot();
  }

  toggleNursing(side: NursingSide): void {
    this.activeNursing =
      this.activeNursing?.activeSide === side
        ? this.nursingService.pause()
        : this.nursingService.startOrSwitch(side);
  }

  finishNursing(): void {
    const session = this.nursingService.finish();
    if (!session) return;
    this.activityService.add({
      id: session.id,
      type: 'feeding',
      title: 'Nursing',
      value:
        `Left ${this.formatDuration(session.leftSeconds)} · ` +
        `Right ${this.formatDuration(session.rightSeconds)}`,
      time: new Date(session.endedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      }),
      createdAt: session.endedAt
    });
    this.loadNursing();
  }

  openManualNursing(session?: NursingSession): void {
    this.nursingError = '';
    this.showManualNursing = true;
    this.editingNursingId = session?.id || '';
    this.manualNursing = session
      ? {
          leftMinutes: Math.round(session.leftSeconds / 60),
          rightMinutes: Math.round(session.rightSeconds / 60),
          dateTime: this.toLocalDateTime(session.startedAt),
          lastSide: session.lastSide,
          notes: session.notes
        }
      : this.createManualNursing();
  }

  closeManualNursing(): void {
    this.showManualNursing = false;
    this.editingNursingId = '';
    this.nursingError = '';
    this.manualNursing = this.createManualNursing();
  }

  saveManualNursing(): void {
    const startedAt = new Date(this.manualNursing.dateTime).getTime();
    const leftSeconds = Number(this.manualNursing.leftMinutes) * 60;
    const rightSeconds = Number(this.manualNursing.rightMinutes) * 60;

    if (
      !Number.isFinite(startedAt) ||
      startedAt > Date.now() + 60_000 ||
      !Number.isFinite(leftSeconds) ||
      !Number.isFinite(rightSeconds) ||
      leftSeconds < 0 ||
      rightSeconds < 0 ||
      leftSeconds + rightSeconds < 60
    ) {
      this.nursingError =
        'Enter at least one minute and choose a time that is not in the future.';
      return;
    }

    try {
      const existing = this.nursingSessions.find(
        session => session.id === this.editingNursingId
      );
      const session: NursingSession = {
        id: existing?.id || crypto.randomUUID(),
        startedAt,
        endedAt: startedAt + (leftSeconds + rightSeconds) * 1000,
        leftSeconds,
        rightSeconds,
        lastSide: this.manualNursing.lastSide,
        notes: this.manualNursing.notes
      };
      this.nursingService.saveSession(session);
      this.activityService.upsertBySourceId(session.id, {
        id: session.id,
        type: 'feeding',
        title: 'Nursing',
        value:
          `Left ${this.formatDuration(leftSeconds)} · ` +
          `Right ${this.formatDuration(rightSeconds)}`,
        time: new Date(startedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        }),
        createdAt: startedAt
      });
      this.loadNursing();
      this.closeManualNursing();
    } catch (error) {
      this.nursingError =
        error instanceof Error ? error.message : 'Could not save the session.';
    }
  }

  deleteNursing(session: NursingSession): void {
    this.nursingService.delete(session.id);
    this.activityService.delete(session.id);
    this.loadNursing();
  }

  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${minutes}:${remaining.toString().padStart(2, '0')}`;
  }

  get lastNursingSide(): string {
    const side =
      this.activeNursing?.lastSide ??
      this.nursingSessions[0]?.lastSide;
    return side
      ? `${side[0].toUpperCase()}${side.slice(1)}`
      : 'None yet';
  }

  get nursingSummary24Hours() {
    const cutoff = Date.now() - 86_400_000;
    const sessions = this.nursingSessions.filter(
      session => session.startedAt >= cutoff
    );
    const leftSeconds = sessions.reduce(
      (total, session) => total + session.leftSeconds,
      0
    );
    const rightSeconds = sessions.reduce(
      (total, session) => total + session.rightSeconds,
      0
    );
    const totalSeconds = leftSeconds + rightSeconds;

    return {
      count: sessions.length,
      leftSeconds,
      rightSeconds,
      totalSeconds,
      leftPercent:
        totalSeconds > 0 ? Math.round(leftSeconds / totalSeconds * 100) : 50,
      rightPercent:
        totalSeconds > 0 ? Math.round(rightSeconds / totalSeconds * 100) : 50
    };
  }

  formatSummaryDuration(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (!hours) return `${minutes} min`;
    return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
  }

  loadFeeds(): void {
    this.feeds = [
      ...this.feedService.getFeeds()
    ].sort(
      (
        firstFeed,
        secondFeed
      ) =>
        this.getCreatedAtFromTime(
          secondFeed.time
        ) -
        this.getCreatedAtFromTime(
          firstFeed.time
        )
    );
  }

  saveFeed(): void {
    const feedId =
      Date.now().toString();

    const feed: Feed = {
      id: feedId,
      quantity:
        Number(this.newFeed.quantity),
      type: this.newFeed.type,
      time: this.newFeed.time
    };

    this.feedService.addFeed(feed);

    this.activityService.add(
      this.createFeedingActivity(feed)
    );

    this.resetNewFeedForm();
    this.loadFeeds();
  }

  edit(feed: Feed): void {
    this.editFeed = {
      ...feed
    };

    this.editFeedPickerValue =
      this.createDateFromTime(
        feed.time
      );

    this.isEditOpen = true;
  }

  saveEdit(): void {
    if (!this.editFeed.id) {
      return;
    }

    const updatedFeed: Feed = {
      id: this.editFeed.id,
      quantity:
        Number(this.editFeed.quantity),
      type: this.editFeed.type,
      time: this.editFeed.time
    };

    const updatedFeeds =
      this.feeds.map(feed =>
        feed.id === updatedFeed.id
          ? updatedFeed
          : feed
      );

    this.feedService.saveAll(
      updatedFeeds
    );

    this.activityService.upsertBySourceId(
      updatedFeed.id,
      this.createFeedingActivity(
        updatedFeed
      )
    );

    this.closeEditModal();
    this.loadFeeds();
  }

  closeEditModal(): void {
    this.isEditOpen = false;

    this.editFeed = {
      id: '',
      quantity: 120,
      type: 'formula',
      time: this.getCurrentTime()
    };

    this.editFeedPickerValue =
      new Date().toISOString();
  }

  async openFeedActions(
    feed: Feed,
    event?: Event
  ): Promise<void> {
    event?.stopPropagation();

    const feedingType =
      feed.type === 'formula'
        ? 'Formula'
        : 'Expressed milk';

    const actionSheet =
      await this.actionSheetController.create({
        header:
          `${feed.quantity} ml · ` +
          feedingType,

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
      this.edit(feed);
      return;
    }

    if (selectedAction === 'delete') {
      await this.confirmDeleteFeed(
        feed
      );
    }
  }

  private async confirmDeleteFeed(
    feed: Feed
  ): Promise<void> {
    const alert =
      await this.alertController.create({
        header: 'Delete feeding?',

        message:
          `${feed.quantity} ml at ` +
          `${feed.time} will be ` +
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
              this.delete(feed.id);
            }
          }
        ]
      });

    await alert.present();
  }

  delete(id: string): void {
    this.feedService.deleteFeed(id);

    this.activityService.delete(id);

    this.loadFeeds();
  }

  formatTime(event: CustomEvent): void {
    const selectedValue =
      event.detail.value;

    if (!selectedValue) {
      return;
    }

    this.newFeed.time =
      this.formatSelectedTime(
        String(selectedValue)
      );
  }

  formatEditTime(
    event: CustomEvent
  ): void {
    const selectedValue =
      event.detail.value;

    if (!selectedValue) {
      return;
    }

    this.editFeed.time =
      this.formatSelectedTime(
        String(selectedValue)
      );
  }

  decreaseNewFeedQuantity(): void {
    this.newFeed.quantity =
      Math.max(
        10,
        Number(
          this.newFeed.quantity
        ) - 10
      );
  }

  increaseNewFeedQuantity(): void {
    this.newFeed.quantity =
      Number(
        this.newFeed.quantity
      ) + 10;
  }

  decreaseEditFeedQuantity(): void {
    this.editFeed.quantity =
      Math.max(
        10,
        Number(
          this.editFeed.quantity
        ) - 10
      );
  }

  increaseEditFeedQuantity(): void {
    this.editFeed.quantity =
      Number(
        this.editFeed.quantity
      ) + 10;
  }

  trackByFeedId(
    _index: number,
    feed: Feed
  ): string {
    return feed.id;
  }

  private resetNewFeedForm(): void {
    const currentTime =
      this.getCurrentTime();

    this.newFeed = {
      id: '',
      quantity: 120,
      type: 'formula',
      time: currentTime
    };

    this.newFeedPickerValue =
      new Date().toISOString();
  }

  private createManualNursing() {
    return {
      leftMinutes: 0,
      rightMinutes: 0,
      dateTime: this.toLocalDateTime(Date.now()),
      lastSide: 'left' as NursingSide,
      notes: ''
    };
  }

  private toLocalDateTime(timestamp: number): string {
    const date = new Date(timestamp);
    const local = new Date(
      date.getTime() - date.getTimezoneOffset() * 60_000
    );
    return local.toISOString().slice(0, 16);
  }

  private getCurrentTime(): string {
    return new Date()
      .toLocaleTimeString(
        [],
        {
          hour: '2-digit',
          minute: '2-digit'
        }
      );
  }

  private formatSelectedTime(
    value: string
  ): string {
    const selectedDate =
      new Date(value);

    if (
      Number.isNaN(
        selectedDate.getTime()
      )
    ) {
      return this.getCurrentTime();
    }

    return selectedDate
      .toLocaleTimeString(
        [],
        {
          hour: '2-digit',
          minute: '2-digit'
        }
      );
  }

  private createDateFromTime(
    time: string
  ): string {
    const currentDate =
      new Date();

    const parsedDate =
      new Date(
        `${currentDate.toDateString()} ` +
        time
      );

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return currentDate.toISOString();
    }

    return parsedDate.toISOString();
  }

  private createFeedingActivity(
    feed: Feed
  ) {
    const feedingType =
      feed.type === 'formula'
        ? 'Formula'
        : 'Expressed milk';

    return {
      id: feed.id,
      type: 'feeding' as const,
      title: 'Feeding',
      value:
        `${feed.quantity} ml · ` +
        feedingType,
      time: feed.time,
      createdAt:
        this.getCreatedAtFromTime(
          feed.time
        )
    };
  }

  private getCreatedAtFromTime(
    time: string
  ): number {
    const currentDate =
      new Date();

    const parsedDate =
      new Date(
        `${currentDate.toDateString()} ` +
        time
      );

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return Date.now();
    }

    return parsedDate.getTime();
  }
}
