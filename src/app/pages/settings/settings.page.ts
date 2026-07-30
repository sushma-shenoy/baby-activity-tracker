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
  IonToggle,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import {
  trimmedRequiredValidator
} from '../../shared/form-validators';
import { AuthService } from '../../services/auth.service';
import {
  AppPreferences,
  PreferencesService
} from '../../services/preferences.service';
import { DataExportService } from '../../services/data-export.service';
import { AlertController } from '@ionic/angular';
import {
  BabyProfileService,
  ManagedBabyProfile
} from '../../services/baby-profile.service';
import {
  ActivityReminder,
  ActivityReminderService,
  CustomReminder
} from '../../services/notification';

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
    IonToggle,
    IonTitle,
    IonToolbar
  ]
})
export class SettingsPage {
  private readonly authService = inject(AuthService);
  readonly preferencesService =
    inject(PreferencesService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly dataExportService = inject(DataExportService);
  private readonly alertController = inject(AlertController);
  private readonly babyProfileService = inject(BabyProfileService);
  readonly reminderService = inject(ActivityReminderService);

  isLoggingOut = false;
  isSaved = false;
  errorMessage = '';
  exportMessage = '';
  isRestoring = false;
  readonly maximumBirthDate = this.toDateInput(new Date());
  isAddingProfile = false;
  reminderMessage = '';
  reminderError = '';
  reminderSavingType = '';
  isAddingCustomReminder = false;

  readonly newProfileForm = this.fb.nonNullable.group({
    name: [
      '',
      [
        Validators.required,
        trimmedRequiredValidator(),
        Validators.maxLength(30)
      ]
    ],
    birthDate: ['', [Validators.required, this.validBirthDateValidator()]],
    mood: ['Happy 😊']
  });

  readonly customReminderForm = this.fb.nonNullable.group({
    label: ['', [Validators.required, Validators.maxLength(50)]],
    time: ['12:00', [Validators.required, Validators.pattern(
      /^([01]\d|2[0-3]):([0-5]\d)$/
    )]]
  });

  readonly preferencesForm = this.fb.nonNullable.group({
    babyName: [
      this.preferencesService.preferences.baby.name,
      [
        Validators.required,
        trimmedRequiredValidator(),
        Validators.maxLength(30)
      ]
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
      [
        Validators.required,
        Validators.min(1),
        Validators.max(24),
        Validators.pattern(/^\d+$/)
      ]
    ],
    sleepGoal: [
      this.preferencesService.preferences.goals.sleepSessions,
      [
        Validators.required,
        Validators.min(1),
        Validators.max(24),
        Validators.pattern(/^\d+$/)
      ]
    ],
    diapersGoal: [
      this.preferencesService.preferences.goals.diapers,
      [
        Validators.required,
        Validators.min(1),
        Validators.max(24),
        Validators.pattern(/^\d+$/)
      ]
    ]
  });

  get displayName(): string {
    return this.authService.currentUser?.displayName || 'Parent';
  }

  get email(): string {
    return this.authService.currentUser?.email || '';
  }

  get profiles(): ManagedBabyProfile[] {
    return this.babyProfileService.profiles;
  }

  get activeProfileId(): string {
    return this.babyProfileService.activeProfileId;
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

  get newProfileBirthDateError(): string {
    const control = this.newProfileForm.controls.birthDate;
    if (!control.touched || !control.errors) return '';
    if (control.hasError('required')) {
      return 'Enter the baby’s date of birth.';
    }
    if (control.hasError('invalidDate')) {
      return 'Enter a valid calendar date.';
    }
    if (control.hasError('futureDate')) {
      return 'Date of birth cannot be in the future.';
    }
    return '';
  }

  get newProfileNameError(): string {
    const control = this.newProfileForm.controls.name;
    if (!control.touched || !control.errors) return '';
    if (control.hasError('required')) return 'Enter the baby’s name.';
    if (control.hasError('maxlength')) return 'Use 30 characters or fewer.';
    return 'Check the baby’s name.';
  }

  get babyNameError(): string {
    const control = this.preferencesForm.controls.babyName;
    if (!control.touched || !control.errors) return '';
    if (control.hasError('required')) return 'Enter the baby’s name.';
    if (control.hasError('maxlength')) return 'Use 30 characters or fewer.';
    return 'Check the baby’s name.';
  }

  goalError(
    field: 'feedsGoal' | 'sleepGoal' | 'diapersGoal'
  ): string {
    const control = this.preferencesForm.controls[field];
    if (!control.touched || !control.errors) return '';
    if (control.hasError('required')) return 'Enter a daily goal.';
    if (
      control.hasError('min') ||
      control.hasError('max') ||
      control.hasError('pattern')
    ) {
      return 'Choose a whole number from 1 to 24.';
    }
    return 'Enter a valid daily goal.';
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
    this.babyProfileService.syncActiveProfile(preferences.baby);
    this.errorMessage = '';
    this.isSaved = true;
  }

  addProfile(): void {
    if (this.newProfileForm.invalid) {
      this.newProfileForm.markAllAsTouched();
      this.errorMessage = 'Enter a valid name and date of birth.';
      return;
    }

    const value = this.newProfileForm.getRawValue();
    this.babyProfileService.addProfile(
      {
        name: value.name,
        birthDate: value.birthDate,
        mood: value.mood
      },
      this.preferencesService.preferences.goals
    );

    window.location.assign('/home');
  }

  switchProfile(profileId: string): void {
    if (this.babyProfileService.switchProfile(profileId)) {
      window.location.assign('/home');
    }
  }

  async deleteProfile(profile: ManagedBabyProfile): Promise<void> {
    const alert = await this.alertController.create({
      header: `Remove ${profile.name}?`,
      message:
        'This removes this baby profile and its tracker records from this device.',
      cssClass: 'activity-delete-alert',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Remove profile',
          role: 'destructive',
          handler: () => {
            this.babyProfileService.deleteProfile(profile.id);
          }
        }
      ]
    });

    await alert.present();
  }

  async updateReminder(
    reminder: ActivityReminder,
    enabled: boolean,
    time = reminder.time
  ): Promise<void> {
    this.reminderMessage = '';
    this.reminderError = '';
    this.reminderSavingType = reminder.type;

    const result = await this.reminderService.update(
      reminder.type,
      { enabled, time }
    );

    this.reminderSavingType = '';
    if (!result.success) {
      this.reminderError = result.message || 'Could not update the reminder.';
      return;
    }

    this.reminderMessage = enabled
      ? `${reminder.label} set for ${this.formatReminderTime(time)}.`
      : `${reminder.label} turned off.`;
  }

  async sendTestReminder(): Promise<void> {
    this.reminderMessage = '';
    this.reminderError = '';

    try {
      const result = await this.reminderService.sendTest();
      if (result.success) {
        this.reminderMessage = result.message;
      } else {
        this.reminderError = result.message;
      }
    } catch {
      this.reminderError =
        'Could not schedule a test notification on this device.';
    }
  }

  async addCustomReminder(): Promise<void> {
    this.reminderMessage = '';
    this.reminderError = '';
    if (this.customReminderForm.invalid) {
      this.customReminderForm.markAllAsTouched();
      this.reminderError =
        'Enter a reminder name and choose a valid time.';
      return;
    }

    const value = this.customReminderForm.getRawValue();
    const result = await this.reminderService.addCustomReminder(
      value.label,
      value.time
    );
    if (!result.success) {
      this.reminderError = result.message || 'Could not add the reminder.';
      return;
    }

    this.reminderMessage =
      `${value.label.trim()} set for ${this.formatReminderTime(value.time)}.`;
    this.customReminderForm.reset({ label: '', time: '12:00' });
    this.isAddingCustomReminder = false;
  }

  async updateCustomReminder(
    reminder: CustomReminder,
    enabled: boolean,
    time = reminder.time
  ): Promise<void> {
    this.reminderMessage = '';
    this.reminderError = '';
    this.reminderSavingType = reminder.id;
    const result = await this.reminderService.updateCustomReminder(
      reminder.id,
      { enabled, time }
    );
    this.reminderSavingType = '';
    if (!result.success) {
      this.reminderError = result.message || 'Could not update the reminder.';
      return;
    }
    this.reminderMessage = enabled
      ? `${reminder.label} set for ${this.formatReminderTime(time)}.`
      : `${reminder.label} turned off.`;
  }

  async deleteCustomReminder(reminder: CustomReminder): Promise<void> {
    await this.reminderService.deleteCustomReminder(reminder.id);
    this.reminderMessage = `${reminder.label} removed.`;
    this.reminderError = '';
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

  private formatReminderTime(value: string): string {
    const [hour, minute] = value.split(':').map(Number);
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(2000, 0, 1, hour, minute));
  }
}
