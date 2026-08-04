import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import { CaregiverSharingService } from '../../services/caregiver-sharing.service';
import { PreferencesService } from '../../services/preferences.service';

@Component({
  selector: 'app-daily-goals',
  templateUrl: './daily-goals.page.html',
  styleUrls: ['./daily-goals.page.scss'],
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
    IonTitle,
    IonToolbar
  ]
})
export class DailyGoalsPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly preferencesService = inject(PreferencesService);
  private readonly sharingService = inject(CaregiverSharingService);

  errorMessage = '';
  isSaving = false;

  readonly goalsForm = this.fb.nonNullable.group({
    feeds: [this.preferencesService.preferences.goals.feeds, this.goalValidators],
    sleepSessions: [
      this.preferencesService.preferences.goals.sleepSessions,
      this.goalValidators
    ],
    diapers: [
      this.preferencesService.preferences.goals.diapers,
      this.goalValidators
    ]
  });

  ngOnInit(): void {
    if (!this.sharingService.canManageBabyProfiles) {
      void this.router.navigateByUrl('/settings', { replaceUrl: true });
    }
  }

  async save(): Promise<void> {
    this.errorMessage = '';
    if (!this.sharingService.canManageBabyProfiles) {
      this.errorMessage = 'Only the baby profile owner can change targets.';
      return;
    }
    if (this.goalsForm.invalid) {
      this.goalsForm.markAllAsTouched();
      this.errorMessage = 'Choose whole numbers from 1 to 24.';
      return;
    }

    this.isSaving = true;
    this.preferencesService.save({
      ...this.preferencesService.preferences,
      goals: this.goalsForm.getRawValue()
    });
    await this.router.navigateByUrl('/settings');
  }

  hasError(field: 'feeds' | 'sleepSessions' | 'diapers'): boolean {
    const control = this.goalsForm.controls[field];
    return control.touched && control.invalid;
  }

  private get goalValidators() {
    return [
      Validators.required,
      Validators.min(1),
      Validators.max(24),
      Validators.pattern(/^\d+$/)
    ];
  }
}
