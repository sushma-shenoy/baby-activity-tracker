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
import { Router, RouterLink } from '@angular/router';
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
  PhotoStorageService
} from '../../services/photo-storage.service';
import {
  CaregiverMember,
  CaregiverSharingService,
  SharedFamily
} from '../../services/caregiver-sharing.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
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
  readonly preferencesService =
    inject(PreferencesService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly dataExportService = inject(DataExportService);
  private readonly alertController = inject(AlertController);
  private readonly babyProfileService = inject(BabyProfileService);
  private readonly photoStorageService = inject(PhotoStorageService);
  readonly caregiverSharingService =
    inject(CaregiverSharingService);

  isLoggingOut = false;
  isSaved = false;
  errorMessage = '';
  exportMessage = '';
  isRestoring = false;
  readonly maximumBirthDate = this.toDateInput(new Date());
  isAddingProfile = false;
  readonly profilePhotoUrls:
    Record<string, string> = {};
  isSavingProfilePhoto = false;
  isDeletingProfile = false;
  caregiverInviteCode = '';
  caregiverJoinCode = '';
  caregiverMessage = '';
  caregiverError = '';
  isCaregiverBusy = false;
  caregivers: CaregiverMember[] = [];
  sharedFamilies: SharedFamily[] = [];

  constructor() {
    void this.loadCaregivers();
  }

  async createCaregiverInvite(): Promise<void> {
    this.isCaregiverBusy = true;
    this.caregiverError = '';
    this.caregiverMessage = '';
    try {
      this.caregiverInviteCode =
        await this.caregiverSharingService.createInvite();
      this.caregiverMessage =
        'Invite created. It expires in 24 hours.';
    } catch (error) {
      this.caregiverError = this.caregiverErrorText(error);
    } finally {
      this.isCaregiverBusy = false;
    }
  }

  async copyCaregiverInvite(): Promise<void> {
    if (!this.caregiverInviteCode) return;
    await navigator.clipboard.writeText(
      this.caregiverInviteCode
    );
    this.caregiverMessage = 'Invite code copied.';
  }

  updateCaregiverJoinCode(event: Event): void {
    this.caregiverJoinCode =
      (event.target as HTMLInputElement).value;
  }

  async joinCaregiverFamily(): Promise<void> {
    this.isCaregiverBusy = true;
    this.caregiverError = '';
    try {
      const familyName =
        await this.caregiverSharingService.joinWithCode(
          this.caregiverJoinCode
        );
      window.location.reload();
      this.caregiverMessage = `Joined ${familyName}.`;
    } catch (error) {
      this.caregiverError = this.caregiverErrorText(error);
    } finally {
      this.isCaregiverBusy = false;
    }
  }

  async removeCaregiver(member: CaregiverMember): Promise<void> {
    await this.caregiverSharingService.removeCaregiver(member.id);
    await this.loadCaregivers();
    this.caregiverMessage = `${member.displayName} was removed.`;
  }

  async changeCaregiverRole(
    member: CaregiverMember,
    role: CaregiverMember['role']
  ): Promise<void> {
    if (member.role === role) return;
    this.isCaregiverBusy = true;
    this.caregiverError = '';
    try {
      await this.caregiverSharingService.setCaregiverRole(member.id, role);
      member.role = role;
      this.caregiverMessage = `${member.displayName} is now a${role === 'editor' ? 'n editor' : ' viewer'}.`;
    } catch (error) {
      this.caregiverError = this.caregiverErrorText(error);
    } finally {
      this.isCaregiverBusy = false;
    }
  }

  async leaveSharedFamily(): Promise<void> {
    this.isCaregiverBusy = true;
    try {
      await this.caregiverSharingService.leaveSharedFamily();
      window.location.reload();
    } catch (error) {
      this.caregiverError = this.caregiverErrorText(error);
      this.isCaregiverBusy = false;
    }
  }

  async switchToPrivateProfile(): Promise<void> {
    this.isCaregiverBusy = true;
    try {
      await this.caregiverSharingService.switchToPrivateProfile();
      window.location.reload();
    } catch (error) {
      this.caregiverError = this.caregiverErrorText(error);
      this.isCaregiverBusy = false;
    }
  }

  async switchToSharedFamily(family: SharedFamily): Promise<void> {
    this.isCaregiverBusy = true;
    try {
      await this.caregiverSharingService.switchFamily(family.ownerId);
      window.location.reload();
    } catch (error) {
      this.caregiverError = this.caregiverErrorText(error);
      this.isCaregiverBusy = false;
    }
  }

  get activeSharedFamilyName(): string {
    return this.sharedFamilies.find(
      family =>
        family.ownerId ===
        this.caregiverSharingService.familyOwnerId
    )?.ownerName ?? 'Shared family';
  }

  private async loadCaregivers(): Promise<void> {
    try {
      this.caregivers =
        await this.caregiverSharingService.listCaregivers();
      this.sharedFamilies =
        await this.caregiverSharingService.listSharedFamilies();
    } catch {
      this.caregivers = [];
      this.sharedFamilies = [];
    }
  }

  private caregiverErrorText(error: unknown): string {
    return error instanceof Error
      ? error.message
      : 'Unable to update family sharing.';
  }

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

  get activeProfileBirthDate(): string {
    const value = this.preferencesService.preferences.baby.birthDate;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }).format(date);
  }

  ionViewWillEnter(): void {
    void this.loadProfilePhotos();
    void this.loadCaregivers();
  }

  getProfilePhoto(profile: ManagedBabyProfile): string {
    return profile.photoId
      ? this.profilePhotoUrls[profile.photoId] || ''
      : '';
  }

  get activeProfilePhoto(): string {
    const profile =
      this.babyProfileService.activeProfile;
    return profile
      ? this.getProfilePhoto(profile)
      : '';
  }

  async selectProfilePhoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!this.caregiverSharingService.canManageBabyProfiles) {
      input.value = '';
      this.errorMessage =
        'Only the baby profile owner can change the profile photo.';
      return;
    }
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    if (
      !file.type.startsWith('image/') ||
      file.size > 10 * 1024 * 1024
    ) {
      this.errorMessage =
        'Choose an image smaller than 10 MB.';
      return;
    }

    const photoId = `profile_${this.activeProfileId}`;
    this.isSavingProfilePhoto = true;
    this.errorMessage = '';

    try {
      await this.photoStorageService.savePhoto(
        photoId,
        file,
        'profile'
      );
      this.babyProfileService.setProfilePhoto(
        this.activeProfileId,
        photoId
      );
      this.profilePhotoUrls[photoId] =
        await this.photoStorageService.getPhotoUrl(photoId);
    } catch {
      this.errorMessage =
        'Unable to save the profile photo. Try another image.';
    } finally {
      this.isSavingProfilePhoto = false;
    }
  }

  async removeProfilePhoto(): Promise<void> {
    if (!this.caregiverSharingService.canManageBabyProfiles) {
      this.errorMessage =
        'Only the baby profile owner can change the profile photo.';
      return;
    }

    const profile =
      this.babyProfileService.activeProfile;

    if (!profile?.photoId) {
      return;
    }

    this.isSavingProfilePhoto = true;
    try {
      await this.photoStorageService.deletePhoto(profile.photoId);
      delete this.profilePhotoUrls[profile.photoId];
      this.babyProfileService.setProfilePhoto(profile.id);
    } finally {
      this.isSavingProfilePhoto = false;
    }
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

    if (!this.caregiverSharingService.canManageBabyProfiles) {
      this.errorMessage =
        'Only the baby profile owner can change profile details and targets.';
      return;
    }

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
        mood: formValue.mood,
        photoId:
          this.babyProfileService.activeProfile?.photoId
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

  async addProfile(): Promise<void> {
    if (this.caregiverSharingService.isSharingAnotherFamily) {
      this.isAddingProfile = false;
      this.errorMessage =
        'Only the family owner can add another baby.';
      return;
    }

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

    await this.babyProfileService.waitForSync();
    window.location.assign('/home');
  }

  async switchProfile(profileId: string): Promise<void> {
    if (this.babyProfileService.switchProfile(profileId)) {
      await this.babyProfileService.waitForSync();
      window.location.assign('/home');
    }
  }

  async deleteProfile(profile: ManagedBabyProfile): Promise<void> {
    if (!this.caregiverSharingService.canManageBabyProfiles) {
      this.errorMessage = 'Only the baby profile owner can delete it.';
      return;
    }

    const alert = await this.alertController.create({
      header: `Delete ${profile.name}?`,
      message:
        'This permanently deletes this baby profile and all of its tracker records for you and every caregiver.',
      cssClass: 'activity-delete-alert',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete profile',
          role: 'destructive',
          handler: async () => {
            this.isDeletingProfile = true;
            this.errorMessage = '';
            try {
              await this.caregiverSharingService.revokeInvitesForProfile(
                profile.id
              );
              await this.photoStorageService.deletePhoto(
                profile.photoId
              );
              const deleted =
                this.babyProfileService.deleteProfile(profile.id);
              if (!deleted) {
                throw new Error(
                  'Keep at least one baby profile in the family.'
                );
              }
              await this.babyProfileService.waitForSync();
              window.location.assign('/settings');
            } catch (error) {
              this.errorMessage = error instanceof Error
                ? error.message
                : 'Unable to delete the baby profile.';
              this.isDeletingProfile = false;
            }
          }
        }
      ]
    });

    await alert.present();
  }

  private async loadProfilePhotos(): Promise<void> {
    await Promise.all(
      this.profiles.map(async profile => {
        if (profile.photoId) {
          this.profilePhotoUrls[profile.photoId] =
            await this.photoStorageService.getPhotoUrl(
              profile.photoId
            );
        }
      })
    );
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
          'Current tracker data in your account will be replaced.',
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
