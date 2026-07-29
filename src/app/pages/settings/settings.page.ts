import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonBackButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import {
  AppPreferences,
  PreferencesService
} from '../../services/preferences.service';
import { DataExportService } from '../../services/data-export.service';
import { AlertController } from '@ionic/angular';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonButton,
    IonBackButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonInput,
    IonItem,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTitle,
    IonToolbar
  ]
})
export class SettingsPage {
  private readonly authService = inject(AuthService);
  private readonly preferencesService =
    inject(PreferencesService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly dataExportService = inject(DataExportService);
  private readonly alertController = inject(AlertController);

  isLoggingOut = false;
  isSaved = false;
  errorMessage = '';
  exportMessage = '';
  isRestoring = false;
  readonly maximumBirthDate = this.toDateInput(new Date());

  readonly preferencesForm = this.fb.nonNullable.group({
    babyName: [
      this.preferencesService.preferences.baby.name,
      [Validators.required, Validators.maxLength(30)]
    ],
    birthDate: [
      this.preferencesService.preferences.baby.birthDate,
      [
        Validators.required,
        this.validBirthDateValidator()
      ]
    ],
    mood: [
      this.preferencesService.preferences.baby.mood
    ],
    feedsGoal: [
      this.preferencesService.preferences.goals.feeds,
      [Validators.required, Validators.min(1), Validators.max(24)]
    ],
    sleepGoal: [
      this.preferencesService.preferences.goals.sleepSessions,
      [Validators.required, Validators.min(1), Validators.max(24)]
    ],
    diapersGoal: [
      this.preferencesService.preferences.goals.diapers,
      [Validators.required, Validators.min(1), Validators.max(24)]
    ]
  });

  get displayName(): string {
    return this.authService.currentUser?.displayName || 'Parent';
  }

  get email(): string {
    return this.authService.currentUser?.email || '';
  }

  get birthDateError(): string {
    const control = this.preferencesForm.controls.birthDate;
    if (!control.touched || !control.errors) return '';
    if (control.hasError('required')) return 'Enter the baby’s date of birth.';
    if (control.hasError('invalidDate')) return 'Enter a valid calendar date.';
    if (control.hasError('futureDate')) {
      return 'Date of birth cannot be in the future.';
    }
    return '';
  }

  savePreferences(): void {
    this.isSaved = false;

    if (this.preferencesForm.invalid) {
      this.preferencesForm.markAllAsTouched();
      this.errorMessage =
        'Check the profile and goal values before saving.';
      return;
    }

    const formValue = this.preferencesForm.getRawValue();
    const preferences: AppPreferences = {
      baby: {
        name: formValue.babyName,
        birthDate: formValue.birthDate,
        mood: formValue.mood
      },
      goals: {
        feeds: formValue.feedsGoal,
        sleepSessions: formValue.sleepGoal,
        diapers: formValue.diapersGoal
      }
    };

    this.preferencesService.save(preferences);
    this.errorMessage = '';
    this.isSaved = true;
  }

  downloadBackup(): void {
    this.errorMessage = '';
    this.exportMessage = '';

    try {
      const filename = this.dataExportService.download();
      this.exportMessage = `${filename} downloaded. Keep it private.`;
    } catch {
      this.errorMessage =
        'The backup could not be downloaded. Try again in your browser.';
    }
  }

  async selectBackup(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.errorMessage = '';
    this.exportMessage = '';
    if (file.size > 5 * 1024 * 1024) {
      this.errorMessage = 'Backup files must be 5 MB or smaller.';
      return;
    }

    try {
      const backup = this.dataExportService.parseBackup(await file.text());
      const recordGroups = Object.keys(backup.data).length;
      const alert = await this.alertController.create({
        header: 'Restore this backup?',
        message:
          `This backup contains ${recordGroups} data groups from ` +
          `${new Date(backup.exportedAt).toLocaleString()}. ` +
          'Current tracker data on this device will be replaced.',
        cssClass: 'activity-delete-alert',
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Restore data',
            role: 'destructive',
            handler: () => {
              this.isRestoring = true;
              const restored = this.dataExportService.restore(backup);
              this.exportMessage =
                `${restored} data groups restored. Reloading the app…`;
              setTimeout(() => window.location.reload(), 500);
            }
          }
        ]
      });
      await alert.present();
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Could not read this backup.';
    }
  }

  async logout(): Promise<void> {
    this.errorMessage = '';
    this.isLoggingOut = true;

    const result = await this.authService.logout();
    this.isLoggingOut = false;

    if (!result.success) {
      this.errorMessage = result.errorMessage ?? 'Unable to log out.';
      return;
    }

    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  private validBirthDateValidator(): ValidatorFn {
    return (control: AbstractControl<string>): ValidationErrors | null => {
      const value = control.value;
      if (!value) return null;

      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      if (!match) return { invalidDate: true };

      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const date = new Date(year, month - 1, day);
      const isRealDate =
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day;

      if (!isRealDate) return { invalidDate: true };
      return value > this.maximumBirthDate ? { futureDate: true } : null;
    };
  }

  private toDateInput(date: Date): string {
    return (
      `${date.getFullYear()}-` +
      `${String(date.getMonth() + 1).padStart(2, '0')}-` +
      `${String(date.getDate()).padStart(2, '0')}`
    );
  }
}
