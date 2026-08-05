import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import { BabyProfileService } from '../../services/baby-profile.service';
import { CaregiverSharingService } from '../../services/caregiver-sharing.service';
import { PhotoStorageService } from '../../services/photo-storage.service';
import { PreferencesService } from '../../services/preferences.service';
import { trimmedRequiredValidator } from '../../shared/form-validators';

@Component({
  selector: 'app-profile-edit',
  templateUrl: './profile-edit.page.html',
  styleUrls: ['./profile-edit.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonInput,
    IonItem,
    IonSelect,
    IonSelectOption,
    IonTitle,
    IonToolbar
  ]
})
export class ProfileEditPage {
  private readonly fb = inject(FormBuilder);
  private readonly preferencesService = inject(PreferencesService);
  private readonly babyProfileService = inject(BabyProfileService);
  private readonly photoStorageService = inject(PhotoStorageService);
  private readonly caregiverSharingService = inject(CaregiverSharingService);
  private readonly router = inject(Router);

  readonly maximumBirthDate = this.toDateInput(new Date());
  activeProfilePhoto = '';
  isSavingPhoto = false;
  errorMessage = '';

  readonly profileForm = this.fb.nonNullable.group({
    babyName: [
      this.preferencesService.preferences.baby.name,
      [Validators.required, trimmedRequiredValidator(), Validators.maxLength(30)]
    ],
    birthDate: [
      this.preferencesService.preferences.baby.birthDate,
      [Validators.required, (control: AbstractControl) => this.validateBirthDate(control)]
    ],
    mood: [this.preferencesService.preferences.baby.mood]
  });

  constructor() {
    if (!this.caregiverSharingService.canManageBabyProfiles) {
      void this.router.navigateByUrl('/settings');
      return;
    }
    void this.loadPhoto();
  }

  async selectProfilePhoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      this.errorMessage = 'Choose an image smaller than 10 MB.';
      return;
    }

    const profileId = this.babyProfileService.activeProfileId;
    const photoId = `profile_${profileId}`;
    this.isSavingPhoto = true;
    this.errorMessage = '';
    try {
      await this.photoStorageService.savePhoto(photoId, file, 'profile');
      this.babyProfileService.setProfilePhoto(profileId, photoId);
      this.activeProfilePhoto = await this.photoStorageService.getPhotoUrl(photoId);
    } catch {
      this.errorMessage = 'Unable to save the profile photo. Try another image.';
    } finally {
      this.isSavingPhoto = false;
    }
  }

  async removeProfilePhoto(): Promise<void> {
    const profile = this.babyProfileService.activeProfile;
    if (!profile?.photoId) return;

    this.isSavingPhoto = true;
    try {
      await this.photoStorageService.deletePhoto(profile.photoId);
      this.babyProfileService.setProfilePhoto(profile.id);
      this.activeProfilePhoto = '';
    } finally {
      this.isSavingPhoto = false;
    }
  }

  save(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.errorMessage = 'Check the profile details before saving.';
      return;
    }

    const value = this.profileForm.getRawValue();
    const current = this.preferencesService.preferences;
    const baby = {
      name: value.babyName.trim(),
      birthDate: value.birthDate,
      mood: value.mood,
      photoId: this.babyProfileService.activeProfile?.photoId
    };
    this.preferencesService.save({ baby, goals: current.goals });
    this.babyProfileService.syncActiveProfile(baby);
    void this.router.navigateByUrl('/settings');
  }

  get nameError(): string {
    const control = this.profileForm.controls.babyName;
    if (!control.touched || !control.errors) return '';
    return control.hasError('maxlength')
      ? 'Use 30 characters or fewer.'
      : 'Enter the baby’s name.';
  }

  get birthDateError(): string {
    const control = this.profileForm.controls.birthDate;
    if (!control.touched || !control.errors) return '';
    if (control.hasError('futureDate')) return 'Date of birth cannot be in the future.';
    if (control.hasError('invalidDate')) return 'Enter a valid calendar date.';
    return 'Enter the baby’s date of birth.';
  }

  private async loadPhoto(): Promise<void> {
    const photoId = this.babyProfileService.activeProfile?.photoId;
    if (photoId) {
      this.activeProfilePhoto = await this.photoStorageService.getPhotoUrl(photoId);
    }
  }

  private validateBirthDate(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    const value = String(control.value);
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime()) || this.toDateInput(date) !== value) {
      return { invalidDate: true };
    }
    return value > this.maximumBirthDate ? { futureDate: true } : null;
  }

  private toDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
