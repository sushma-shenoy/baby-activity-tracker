import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { CaregiverSharingService } from '../../services/caregiver-sharing.service';
import { trimmedRequiredValidator } from '../../shared/form-validators';

@Component({
  selector: 'app-create-family',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IonicModule],
  templateUrl: './create-family.page.html',
  styleUrls: ['./create-family.page.scss']
})
export class CreateFamilyPage {
  private readonly fb = inject(FormBuilder);
  private readonly sharingService = inject(CaregiverSharingService);
  private readonly route = inject(ActivatedRoute);

  readonly backHref = this.route.snapshot.queryParamMap.get('returnUrl') ===
    '/settings/family'
    ? '/settings/family'
    : '/caregiver-no-access';

  readonly maximumBirthDate = new Date().toISOString().slice(0, 10);
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, trimmedRequiredValidator(), Validators.maxLength(30)]],
    birthDate: ['', Validators.required]
  });
  isBusy = false;
  errorMessage = '';

  async createFamily(): Promise<void> {
    this.errorMessage = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage = 'Enter the baby’s name and date of birth.';
      return;
    }
    const baby = this.form.getRawValue();
    if (baby.birthDate > this.maximumBirthDate) {
      this.errorMessage = 'Date of birth cannot be in the future.';
      return;
    }
    this.isBusy = true;
    try {
      await this.sharingService.createPrivateFamily({
        name: baby.name.trim(),
        birthDate: baby.birthDate
      });
      sessionStorage.setItem('baby_family_created', 'true');
      window.location.replace('/home');
    } catch (error) {
      this.errorMessage = error instanceof Error
        ? error.message
        : 'Unable to create your family account.';
      this.isBusy = false;
    }
  }
}
