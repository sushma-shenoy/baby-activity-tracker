import { Component, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { trackerStorage } from '../../firebase/tracker-storage';
import {
  IonContent,
  IonButton,
  IonInput,
  IonItem,
  IonSpinner
} from '@ionic/angular/standalone';

import { CommonModule } from '@angular/common';
import {
  trimmedRequiredValidator
} from '../../shared/form-validators';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.page.html',
  styleUrls: ['./signup.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    IonContent,
    IonButton,
    IonInput,
    IonItem,
    IonSpinner
  ]
})
export class SignupPage {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  signupForm: FormGroup = this.fb.group({
    name: ['', [
      Validators.required,
      trimmedRequiredValidator(),
      Validators.minLength(2),
      Validators.maxLength(50)
    ]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [
      Validators.required,
      Validators.minLength(6),
      Validators.maxLength(128)
    ]],
    confirmPassword: ['', Validators.required]
  });

  hidePassword = true;
  hideConfirmPassword = true;

  isLoading = false;
  errorMessage = '';

  fieldError(
    field: 'name' | 'email' | 'password' | 'confirmPassword'
  ): string {
    const control = this.signupForm.controls[field];
    if (!control.touched || !control.errors) return '';
    if (control.hasError('required')) {
      const messages = {
        name: 'Enter your name.',
        email: 'Enter your email address.',
        password: 'Create a password.',
        confirmPassword: 'Enter the password again.'
      };
      return messages[field];
    }
    if (control.hasError('email')) return 'Enter a valid email address.';
    if (control.hasError('minlength')) {
      return field === 'name'
        ? 'Name must be at least 2 characters.'
        : 'Password must be at least 6 characters.';
    }
    if (control.hasError('maxlength')) {
      return field === 'name'
        ? 'Name must be 50 characters or fewer.'
        : 'Password must be 128 characters or fewer.';
    }
    return 'Check this field.';
  }

  async signUp(): Promise<void> {
    this.errorMessage = '';

    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      this.errorMessage =
        'Please complete all fields correctly.';
      return;
    }

    const {
      name,
      email,
      password,
      confirmPassword
    } = this.signupForm.value;

    if (password !== confirmPassword) {
      this.signupForm.controls['confirmPassword'].setErrors({
        passwordMismatch: true
      });
      this.signupForm.controls['confirmPassword'].markAsTouched();
      this.errorMessage =
        'Passwords do not match.';
      return;
    }

    this.isLoading = true;

    const result =
      await this.authService.signUp(
        name,
        email,
        password
      );

    this.isLoading = false;

    if (!result.success) {
      this.errorMessage =
        result.errorMessage ??
        'Unable to create your account.';
      return;
    }

    const destination = this.getPostSignupDestination();
    if (
      result.user &&
      destination.startsWith('/caregiver-invite')
    ) {
      try {
        await trackerStorage.setCaregiverOnlyAccount(true);
      } catch {
        this.errorMessage =
          'Your account was created, but caregiver setup could not be saved. Please try signing in again.';
        return;
      }
    }

    // Reload so the new account starts with its Firestore-backed data store.
    this.reloadApp(destination);
  }

  reloadApp(destination = '/home'): void {
    window.location.replace(destination);
  }

  private getPostSignupDestination(): string {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    return (
      returnUrl?.startsWith('/') &&
      !returnUrl.startsWith('//') &&
      returnUrl !== '/login' &&
      returnUrl !== '/signup'
    ) ? returnUrl : '/home';
  }
}
