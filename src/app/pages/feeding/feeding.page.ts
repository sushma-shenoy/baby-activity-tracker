import {
  Component,
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
export class FeedingPage implements OnInit {
  feeds: Feed[] = [];

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
    private readonly actionSheetController:
      ActionSheetController,
    private readonly alertController:
      AlertController
  ) {}

  ngOnInit(): void {
    this.loadFeeds();
  }

  ionViewWillEnter(): void {
    this.loadFeeds();
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
        : 'Breast';

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
        : 'Breast';

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