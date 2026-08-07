import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { firebaseAuth } from '../../firebase/firebase.config';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss']
})
export class ResetPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly code = this.route.snapshot.queryParamMap.get('oobCode') || '';

  readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required]
  });

  email = '';
  isChecking = true;
  isSaving = false;
  isComplete = false;
  errorMessage = '';
  showPassword = false;

  constructor() {
    void this.validateLink();
  }

  private async validateLink(): Promise<void> {
    if (!this.code) {
      this.isChecking = false;
      this.errorMessage = 'This password reset link is incomplete.';
      return;
    }
    try {
      this.email = await verifyPasswordResetCode(firebaseAuth, this.code);
    } catch {
      this.errorMessage = 'This password reset link has expired or was already used.';
    } finally {
      this.isChecking = false;
    }
  }

  async savePassword(): Promise<void> {
    this.errorMessage = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage = 'Use a password with at least 6 characters.';
      return;
    }
    const value = this.form.getRawValue();
    if (value.password !== value.confirmPassword) {
      this.errorMessage = 'The passwords do not match.';
      return;
    }

    this.isSaving = true;
    try {
      await confirmPasswordReset(firebaseAuth, this.code, value.password);
      this.isComplete = true;
      this.form.reset();
    } catch {
      this.errorMessage = 'The reset link has expired. Request a new email and try again.';
    } finally {
      this.isSaving = false;
    }
  }
}
