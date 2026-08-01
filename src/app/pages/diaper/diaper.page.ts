import {
  Component,
  OnDestroy
} from '@angular/core';
import { Subscription } from 'rxjs';

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
  Activity
} from '../../shared/models/activity-model';

import {
  formatTime24
} from '../../shared/date-time.utils';

import {
  ActivityService
} from '../../services/activity.service';

import {
  PhotoStorageService
} from '../../services/photo-storage.service';

import {
  ActivityReminder,
  ActivityReminderService
} from '../../services/notification';

type DiaperType =
  | 'wet'
  | 'dirty'
  | 'both';

interface ParsedDiaperValue {
  type: DiaperType;
  notes: string;
}

interface DiaperStatistics {
  today: number;
  lastSevenDays: number;
  dailyAverage: string;
  mostCommonType: string;
}

@Component({
  selector: 'app-diaper',
  templateUrl: './diaper.page.html',
  styleUrls: ['./diaper.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonicModule
  ]
})
export class DiaperPage implements OnDestroy {
  private readonly maximumPhotoSize = 10 * 1024 * 1024;
  private selectedPhotoFile?: File;
  private selectedEditPhotoFile?: File;
  private readonly photoUrls:
    Record<string, string> = {};

  formError = '';
  selectedType: DiaperType = 'wet';

  notes = '';
  photoDataUrl = '';

  diaperTime =
    this.toLocalDateTimeValue(
      new Date()
    );

  diaperActivities: Activity[] = [];
  diaperStatistics: DiaperStatistics = {
    today: 0,
    lastSevenDays: 0,
    dailyAverage: '0.0',
    mostCommonType: 'No data'
  };
  reminderMessage = '';
  reminderError = '';
  isSavingReminder = false;

  isEditOpen = false;
  private activitySubscription?: Subscription;

  editDiaper: {
    id: string;
    type: DiaperType;
    notes: string;
    dateTime: string;
    photoDataUrl: string;
    photoId: string;
  } = {
    id: '',
    type: 'wet',
    notes: '',
    dateTime:
      this.toLocalDateTimeValue(
        new Date()
      ),
    photoDataUrl: '',
    photoId: ''
  };

  constructor(
    private readonly activityService:
      ActivityService,

    private readonly photoStorageService:
      PhotoStorageService,

    readonly reminderService:
      ActivityReminderService,

    private readonly actionSheetController:
      ActionSheetController,

    private readonly alertController:
      AlertController
  ) {
    this.loadDiaperActivities();
    this.activitySubscription = this.activityService.activities$.subscribe(
      () => this.loadDiaperActivities()
    );
  }

  ngOnDestroy(): void {
    this.activitySubscription?.unsubscribe();
  }

  ionViewWillEnter(): void {
    this.loadDiaperActivities();
  }

  get selectedTypeLabel(): string {
    return this.getDiaperTypeLabel(
      this.selectedType
    );
  }

  get diaperReminder(): ActivityReminder {
    return this.reminderService.reminders.find(
      reminder => reminder.type === 'diaper'
    )!;
  }

  async updateDiaperReminder(
    enabled: boolean,
    time = this.diaperReminder.time
  ): Promise<void> {
    if (this.isSavingReminder) {
      return;
    }

    this.isSavingReminder = true;
    this.reminderMessage = '';
    this.reminderError = '';

    try {
      const result =
        await this.reminderService.update(
          'diaper',
          { enabled, time }
        );

      if (!result.success) {
        this.reminderError =
          result.message ||
          'Unable to update the reminder.';
        return;
      }

      this.reminderMessage = enabled
        ? `Daily reminder set for ${this.formatReminderTime(time)}.`
        : 'Diaper reminder turned off.';
    } catch {
      this.reminderError =
        'Unable to schedule the reminder on this device.';
    } finally {
      this.isSavingReminder = false;
    }
  }

  async saveDiaper(): Promise<void> {
    const createdAt =
      this.parseDateTime(
        this.diaperTime
      );
    if (!this.isValidActivityDate(createdAt)) {
      this.formError = 'Choose a valid date and time that is not in the future.';
      return;
    }
    if (this.notes.trim().length > 250) {
      this.formError = 'Notes must be 250 characters or fewer.';
      return;
    }
    this.formError = '';

    const activityId = `diaper-${Date.now()}`;
    let photoId: string | undefined;

    if (this.selectedPhotoFile) {
      try {
        photoId = `diaper_${activityId}`;
        await this.photoStorageService.savePhoto(
          photoId,
          this.selectedPhotoFile,
          'diaper'
        );
      } catch {
        this.formError =
          'Unable to upload the photo. Check your connection and try again.';
        return;
      }
    }

    const activity: Activity = {
      id: activityId,
      type: 'diaper',
      title: 'Diaper',
      value:
        this.createDiaperValue(
          this.selectedType,
          this.notes
        ),
      time:
        this.formatActivityTime(
          createdAt
      ),
      createdAt,
      photoId
    };

    this.activityService.add(
      activity
    );

    this.resetForm();
    this.loadDiaperActivities();
  }

  async openDiaperActions(
    activity: Activity,
    event?: Event
  ): Promise<void> {
    event?.stopPropagation();

    const actionSheet =
      await this.actionSheetController.create({
        header:
          this.getActivityTitle(
            activity
          ),

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
      this.openEditDiaper(
        activity
      );

      return;
    }

    if (selectedAction === 'delete') {
      await this.confirmDeleteDiaper(
        activity
      );
    }
  }

  async confirmDeleteDiaper(
    activity: Activity
  ): Promise<void> {
    const alert =
      await this.alertController.create({
        header:
          'Delete diaper entry?',

        message:
          `${this.getActivityTitle(activity)} ` +
          `at ${activity.time} will be ` +
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
              this.deleteDiaper(
                activity.id
              );
            }
          }
        ]
      });

    await alert.present();
  }

  openEditDiaper(
    activity: Activity
  ): void {
    const parsedValue =
      this.parseDiaperValue(
        activity.value
      );

    this.editDiaper = {
      id: activity.id,
      type: parsedValue.type,
      notes: parsedValue.notes,
      dateTime:
        this.toLocalDateTimeValue(
          new Date(
          activity.createdAt
          )
        ),
      photoDataUrl:
        this.getActivityPhoto(activity) ||
        activity.photoDataUrl ||
        '',
      photoId:
        activity.photoId ?? ''
    };

    this.isEditOpen = true;
  }

  async saveDiaperEdit(): Promise<void> {
    if (!this.editDiaper.id) {
      return;
    }

    const createdAt =
      this.parseDateTime(
        this.editDiaper.dateTime
      );
    if (!this.isValidActivityDate(createdAt)) {
      this.formError = 'Choose a valid date and time that is not in the future.';
      return;
    }
    if (this.editDiaper.notes.trim().length > 250) {
      this.formError = 'Notes must be 250 characters or fewer.';
      return;
    }
    this.formError = '';

    let photoPreview =
      this.editDiaper.photoDataUrl;
    let photoId =
      this.editDiaper.photoId;

    if (this.selectedEditPhotoFile) {
      try {
        photoId = `diaper_${this.editDiaper.id}`;
        await this.photoStorageService.savePhoto(
          photoId,
          this.selectedEditPhotoFile,
          'diaper'
        );
      } catch {
        this.formError =
          'Unable to upload the photo. Check your connection and try again.';
        return;
      }
    }

    const removedPhotoId =
      !photoPreview
        ? this.editDiaper.photoId
        : '';

    if (!photoPreview) {
      photoId = '';
    }

    this.activityService.update(
      this.editDiaper.id,
      {
        value:
          this.createDiaperValue(
            this.editDiaper.type,
            this.editDiaper.notes
          ),

        time:
          this.formatActivityTime(
            createdAt
          ),

        createdAt,
        photoId: photoId || undefined,
        photoDataUrl:
          photoPreview.startsWith('data:image/') &&
          !this.selectedEditPhotoFile
            ? photoPreview
            : undefined
      }
    );

    await this.photoStorageService.deletePhoto(
      removedPhotoId
    );

    this.closeDiaperEdit();
    this.loadDiaperActivities();
  }

  closeDiaperEdit(): void {
    this.isEditOpen = false;

    this.editDiaper = {
      id: '',
      type: 'wet',
      notes: '',
      dateTime:
        this.toLocalDateTimeValue(
          new Date()
        ),
      photoDataUrl: '',
      photoId: ''
    };
    this.selectedEditPhotoFile = undefined;
  }

  async deleteDiaper(
    activityId: string
  ): Promise<void> {
    const activity =
      this.diaperActivities.find(
        item => item.id === activityId
      );

    this.activityService.delete(
      activityId
    );

    await this.photoStorageService.deletePhoto(
      activity?.photoId
    );

    this.loadDiaperActivities();
  }

  getActivityDiaperType(
    activity: Activity
  ): DiaperType {
    return this.parseDiaperValue(
      activity.value
    ).type;
  }

  getActivityTitle(
    activity: Activity
  ): string {
    const parsedValue =
      this.parseDiaperValue(
        activity.value
      );

    return this.getDiaperTypeLabel(
      parsedValue.type
    );
  }

  getActivityNotes(
    activity: Activity
  ): string {
    return this.parseDiaperValue(
      activity.value
    ).notes;
  }

  getActivityPhoto(
    activity: Activity
  ): string {
    return (
      activity.photoId
        ? this.photoUrls[activity.photoId]
        : ''
    ) || (activity.photoDataUrl ?? '');
  }

  async selectPhoto(
    event: Event,
    editing = false
  ): Promise<void> {
    const input =
      event.target as HTMLInputElement;
    const file = input.files?.[0];

    input.value = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.formError = 'Choose an image file.';
      return;
    }

    if (file.size > this.maximumPhotoSize) {
      this.formError = 'Choose a photo smaller than 10 MB.';
      return;
    }

    try {
      const photoDataUrl =
        await this.readPhoto(file);

      if (editing) {
        this.editDiaper.photoDataUrl =
          photoDataUrl;
        this.selectedEditPhotoFile = file;
      } else {
        this.photoDataUrl =
          photoDataUrl;
        this.selectedPhotoFile = file;
      }

      this.formError = '';
    } catch {
      this.formError =
        'Unable to attach that photo. Try another image.';
    }
  }

  removePhoto(editing = false): void {
    if (editing) {
      this.editDiaper.photoDataUrl = '';
      this.selectedEditPhotoFile = undefined;
      return;
    }

    this.photoDataUrl = '';
    this.selectedPhotoFile = undefined;
  }

  getDiaperIcon(
    type: DiaperType
  ): string {
    const icons:
      Record<DiaperType, string> = {
        wet: '💧',
        dirty: '💩',
        both: '🧷'
      };

    return icons[type];
  }

  trackByActivityId(
    _index: number,
    activity: Activity
  ): string {
    return activity.id;
  }

  private loadDiaperActivities(): void {
    this.diaperActivities = [
      ...this.activityService.getByType(
        'diaper'
      )
    ].sort(
      (
        firstActivity,
        secondActivity
      ) =>
        secondActivity.createdAt -
        firstActivity.createdAt
    );

    this.updateDiaperStatistics();
    void this.loadActivityPhotos();
  }

  private updateDiaperStatistics(): void {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();
    const sevenDayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6
    ).getTime();
    const todayActivities =
      this.diaperActivities.filter(
        activity =>
          activity.createdAt >= todayStart
      );
    const recentActivities =
      this.diaperActivities.filter(
        activity =>
          activity.createdAt >= sevenDayStart
      );
    const counts:
      Record<DiaperType, number> = {
        wet: 0,
        dirty: 0,
        both: 0
      };

    for (const activity of recentActivities) {
      counts[
        this.getActivityDiaperType(activity)
      ] += 1;
    }

    const mostCommonType =
      recentActivities.length === 0
        ? 'No data'
        : this.getDiaperTypeLabel(
            (
              Object.entries(counts) as
                Array<[DiaperType, number]>
            ).reduce(
              (mostCommon, current) =>
                current[1] > mostCommon[1]
                  ? current
                  : mostCommon
            )[0]
          );

    this.diaperStatistics = {
      today: todayActivities.length,
      lastSevenDays: recentActivities.length,
      dailyAverage:
        (recentActivities.length / 7).toFixed(1),
      mostCommonType
    };
  }

  private async loadActivityPhotos(): Promise<void> {
    await Promise.all(
      this.diaperActivities.map(async activity => {
        if (!activity.photoId) {
          return;
        }

        this.photoUrls[activity.photoId] =
          await this.photoStorageService.getPhotoUrl(
            activity.photoId
          );
      })
    );
  }

  private createDiaperValue(
    type: DiaperType,
    notes: string
  ): string {
    const cleanNotes =
      notes.trim();

    const typeText =
      this.getDiaperTypeLabel(
        type
      );

    return cleanNotes
      ? `${typeText} · ${cleanNotes}`
      : typeText;
  }

  private parseDiaperValue(
    value: string
  ): ParsedDiaperValue {
    const [
      typeText,
      ...noteParts
    ] = value.split(' · ');

    const normalizedTypeText =
      typeText
        .trim()
        .toLowerCase();

    let type: DiaperType = 'wet';

    if (
      normalizedTypeText ===
      'dirty diaper'
    ) {
      type = 'dirty';
    }

    if (
      normalizedTypeText ===
      'wet and dirty'
    ) {
      type = 'both';
    }

    return {
      type,
      notes:
        noteParts
          .join(' · ')
          .trim()
    };
  }

  private getDiaperTypeLabel(
    type: DiaperType
  ): string {
    const labels:
      Record<DiaperType, string> = {
        wet: 'Wet diaper',
        dirty: 'Dirty diaper',
        both: 'Wet and dirty'
      };

    return labels[type];
  }

  private parseDateTime(
    dateTime: string
  ): number {
    const selectedDate =
      new Date(dateTime);

    return selectedDate.getTime();
  }

  private isValidActivityDate(timestamp: number): boolean {
    return Number.isFinite(timestamp) &&
      timestamp <= Date.now() + 60_000;
  }

  private formatActivityTime(
    createdAt: number
  ): string {
    return formatTime24(
      new Date(createdAt)
    );
  }

  private formatReminderTime(time: string): string {
    return new Date(
      `2000-01-01T${time}:00`
    ).toLocaleTimeString(
      [],
      {
        hour: 'numeric',
        minute: '2-digit'
      }
    );
  }

  private resetForm(): void {
    this.selectedType = 'wet';
    this.notes = '';
    this.photoDataUrl = '';
    this.selectedPhotoFile = undefined;
    this.diaperTime =
      this.toLocalDateTimeValue(
        new Date()
      );
  }

  private toLocalDateTimeValue(
    date: Date
  ): string {
    const timezoneOffset =
      date.getTimezoneOffset() * 60_000;

    return new Date(
      date.getTime() - timezoneOffset
    ).toISOString().slice(0, 16);
  }

  private readPhoto(
    file: File
  ): Promise<string> {
    return new Promise(
      (resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
          if (
            typeof reader.result === 'string' &&
            reader.result.startsWith('data:image/')
          ) {
            resolve(reader.result);
            return;
          }

          reject(new Error('Invalid image'));
        };

        reader.onerror = () =>
          reject(reader.error);

        reader.readAsDataURL(file);
      }
    );
  }
}
