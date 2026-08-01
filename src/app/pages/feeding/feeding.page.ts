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
  dateForTimeToday,
  formatTime24,
  isValidTime24
} from '../../shared/date-time.utils';
import {
  ActiveNursingSession,
  NursingService,
  NursingSession,
  NursingSide
} from '../../services/nursing.service';
import { Subscription } from 'rxjs';
import { BabyProfileService } from '../../services/baby-profile.service';

type FeedingEntryMode = 'bottle' | 'nursing' | null;
type NursingEntryMode = 'manual' | 'live' | null;
type FeedingHistoryFilter = 'all' | 'nursing' | 'formula' | 'expressed';

interface FeedingHistoryItem {
  id: string;
  kind: Exclude<FeedingHistoryFilter, 'all'>;
  timestamp: number;
  feed?: Feed;
  nursing?: NursingSession;
}

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
  feedError = '';
  editingNursingId = '';
  entryMode: FeedingEntryMode = null;
  nursingEntryMode: NursingEntryMode = null;
  historyFilter: FeedingHistoryFilter = 'all';
  readonly historyFilters: Array<{
    type: FeedingHistoryFilter;
    label: string;
    icon: string;
  }> = [
    { type: 'all', label: 'All', icon: '✨' },
    { type: 'nursing', label: 'Nursing', icon: '🤱' },
    { type: 'formula', label: 'Formula', icon: '🍼' },
    { type: 'expressed', label: 'Expressed milk', icon: '🥛' }
  ];
  manualNursing = this.createManualNursing();
  private nursingClock?: ReturnType<typeof setInterval>;
  private activitySubscription?: Subscription;

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
      AlertController,
    public readonly babyProfileService: BabyProfileService
  ) {}

  async switchBaby(profileId: string): Promise<void> {
    if (this.babyProfileService.switchProfile(profileId)) {
      await this.babyProfileService.waitForSync();
      window.location.reload();
    }
  }

  ngOnInit(): void {
    this.loadFeeds();
    this.loadNursing();
    this.nursingClock = setInterval(() => {
      this.activeNursing = this.nursingService.snapshot();
    }, 1000);
    this.activitySubscription = this.activityService.activities$.subscribe(
      () => {
        this.loadFeeds();
        this.loadNursing();
      }
    );
  }

  ngOnDestroy(): void {
    if (this.nursingClock) clearInterval(this.nursingClock);
    this.activitySubscription?.unsubscribe();
  }

  ionViewWillEnter(): void {
    this.loadFeeds();
    this.loadNursing();
  }

  loadNursing(): void {
    this.nursingSessions = this.nursingService.getSessions();
    this.activeNursing = this.nursingService.snapshot();
    if (this.activeNursing && !this.entryMode) {
      this.entryMode = 'nursing';
      this.nursingEntryMode = 'live';
    }
  }

  selectEntryMode(mode: Exclude<FeedingEntryMode, null>): void {
    this.entryMode = mode;
    this.feedError = '';
    this.nursingError = '';
    if (mode !== 'nursing') {
      this.nursingEntryMode = null;
      this.closeManualNursing();
    }
  }

  selectNursingEntryMode(mode: Exclude<NursingEntryMode, null>): void {
    this.nursingEntryMode = mode;
    if (mode === 'manual') this.openManualNursing();
    else this.closeManualNursing();
  }

  resetEntryChoice(): void {
    this.entryMode = null;
    this.nursingEntryMode = null;
    this.closeManualNursing();
    this.feedError = '';
  }

  setHistoryFilter(filter: FeedingHistoryFilter): void {
    this.historyFilter = filter;
  }

  get filteredHistory(): FeedingHistoryItem[] {
    const bottleItems: FeedingHistoryItem[] = this.feeds.map(feed => ({
      id: feed.id,
      kind: feed.type,
      timestamp: this.getFeedTimestamp(feed),
      feed
    }));
    const nursingItems: FeedingHistoryItem[] = this.nursingSessions.map(nursing => ({
      id: nursing.id,
      kind: 'nursing',
      timestamp: nursing.endedAt,
      nursing
    }));
    return [...bottleItems, ...nursingItems]
      .filter(item => this.historyFilter === 'all' || item.kind === this.historyFilter)
      .sort((first, second) => second.timestamp - first.timestamp);
  }

  get historyCount(): number {
    return this.feeds.length + this.nursingSessions.length;
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
      time: formatTime24(
        new Date(session.endedAt)
      ),
      createdAt: session.endedAt
    });
    this.loadNursing();
  }

  openManualNursing(session?: NursingSession): void {
    this.nursingError = '';
    this.entryMode = 'nursing';
    this.nursingEntryMode = 'manual';
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
      leftSeconds > 14_400 ||
      rightSeconds > 14_400 ||
      !Number.isInteger(leftSeconds / 60) ||
      !Number.isInteger(rightSeconds / 60) ||
      this.manualNursing.notes.trim().length > 240 ||
      leftSeconds + rightSeconds < 60
    ) {
      this.nursingError =
        'Enter whole minutes from 0 to 240, at least 1 minute total, a valid past time, and notes up to 240 characters.';
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
        time: formatTime24(
          new Date(startedAt)
        ),
        createdAt: startedAt
      });
      this.loadNursing();
      this.closeManualNursing();
      this.resetEntryChoice();
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
        this.getFeedTimestamp(secondFeed) -
        this.getFeedTimestamp(firstFeed)
    );
  }

  saveFeed(): void {
    if (!this.isValidFeed(this.newFeed)) {
      this.feedError =
        'Choose a feeding type, quantity from 5 to 1000 mL, and a valid time.';
      return;
    }
    this.feedError = '';
    const feedId =
      Date.now().toString();

    const feed: Feed = {
      id: feedId,
      quantity:
        Number(this.newFeed.quantity),
      type: this.newFeed.type,
      time: this.newFeed.time,
      createdAt: this.getCreatedAtFromTime(this.newFeed.time)
    };

    this.feedService.addFeed(feed);

    this.activityService.add(
      this.createFeedingActivity(feed)
    );

    this.resetNewFeedForm();
    this.loadFeeds();
    this.resetEntryChoice();
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
    if (!this.isValidFeed(this.editFeed)) {
      this.feedError =
        'Choose a feeding type, quantity from 5 to 1000 mL, and a valid time.';
      return;
    }
    this.feedError = '';

    const updatedFeed: Feed = {
      id: this.editFeed.id,
      quantity:
        Number(this.editFeed.quantity),
      type: this.editFeed.type,
      time: this.editFeed.time,
      createdAt: this.getCreatedAtFromTime(this.editFeed.time),
      createdByUid: this.editFeed.createdByUid,
      createdByName: this.editFeed.createdByName
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

  trackByHistoryId(_index: number, item: FeedingHistoryItem): string {
    return `${item.kind}-${item.id}`;
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

  private isValidFeed(feed: Feed): boolean {
    const quantity = Number(feed.quantity);
    return (
      ['formula', 'expressed'].includes(feed.type) &&
      Number.isFinite(quantity) &&
      quantity >= 5 &&
      quantity <= 1000 &&
      Number.isInteger(quantity) &&
      isValidTime24(feed.time)
    );
  }

  private toLocalDateTime(timestamp: number): string {
    const date = new Date(timestamp);
    const local = new Date(
      date.getTime() - date.getTimezoneOffset() * 60_000
    );
    return local.toISOString().slice(0, 16);
  }

  private getCurrentTime(): string {
    return formatTime24(
      new Date()
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

    return formatTime24(
      selectedDate
    );
  }

  private createDateFromTime(
    time: string
  ): string {
    const currentDate =
      new Date();

    const parsedDate =
      dateForTimeToday(
        time,
        currentDate
      );

    if (!parsedDate) {
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
        this.getFeedTimestamp(feed)
    };
  }

  private getFeedTimestamp(feed: Feed): number {
    return Number.isFinite(feed.createdAt)
      ? feed.createdAt as number
      : this.getCreatedAtFromTime(feed.time);
  }

  private getCreatedAtFromTime(
    time: string
  ): number {
    const currentDate =
      new Date();

    const parsedDate =
      dateForTimeToday(
        time,
        currentDate
      );

    if (!parsedDate) {
      return Date.now();
    }

    return parsedDate.getTime();
  }
}
