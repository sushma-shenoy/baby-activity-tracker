import {
  Component
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
  Activity
} from '../../shared/models/activity-model';

import {
  ActivityService
} from '../../services/activity.service';

type DiaperType =
  | 'wet'
  | 'dirty'
  | 'both';

interface ParsedDiaperValue {
  type: DiaperType;
  notes: string;
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
export class DiaperPage {
  selectedType: DiaperType = 'wet';

  notes = '';

  diaperTime =
    new Date().toISOString();

  diaperActivities: Activity[] = [];

  isEditOpen = false;

  editDiaper: {
    id: string;
    type: DiaperType;
    notes: string;
    dateTime: string;
  } = {
    id: '',
    type: 'wet',
    notes: '',
    dateTime:
      new Date().toISOString()
  };

  constructor(
    private readonly activityService:
      ActivityService,

    private readonly actionSheetController:
      ActionSheetController,

    private readonly alertController:
      AlertController
  ) {
    this.loadDiaperActivities();
  }

  ionViewWillEnter(): void {
    this.loadDiaperActivities();
  }

  get selectedTypeLabel(): string {
    return this.getDiaperTypeLabel(
      this.selectedType
    );
  }

  saveDiaper(): void {
    const createdAt =
      this.parseDateTime(
        this.diaperTime
      );

    const activity: Activity = {
      id: `diaper-${Date.now()}`,
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
      createdAt
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
        new Date(
          activity.createdAt
        ).toISOString()
    };

    this.isEditOpen = true;
  }

  saveDiaperEdit(): void {
    if (!this.editDiaper.id) {
      return;
    }

    const createdAt =
      this.parseDateTime(
        this.editDiaper.dateTime
      );

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

        createdAt
      }
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
        new Date().toISOString()
    };
  }

  deleteDiaper(
    activityId: string
  ): void {
    this.activityService.delete(
      activityId
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

    return Number.isNaN(
      selectedDate.getTime()
    )
      ? Date.now()
      : selectedDate.getTime();
  }

  private formatActivityTime(
    createdAt: number
  ): string {
    return new Date(
      createdAt
    ).toLocaleTimeString(
      [],
      {
        hour: '2-digit',
        minute: '2-digit'
      }
    );
  }

  private resetForm(): void {
    this.selectedType = 'wet';
    this.notes = '';
    this.diaperTime =
      new Date().toISOString();
  }
}