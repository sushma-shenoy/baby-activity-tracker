import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import {
  ActivatedRoute,
  RouterLink
} from '@angular/router';
import {
  IonButton,
  IonContent,
  IonInput,
  IonItem,
  IonSpinner
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    IonButton,
    IonContent,
    IonInput,
    IonItem,
    IonSpinner
  ]
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  isLoading = false;
  isResettingPassword = false;
  errorMessage = '';
  successMessage = '';

  async login(): Promise<void> {
    this.clearMessages();

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.errorMessage = 'Please enter a valid email and password.';
      return;
    }

    this.isLoading = true;
    const result = await this.authService.login(
      this.loginForm.value.email,
      this.loginForm.value.password
    ).finally(() => {
      this.isLoading = false;
    });

    if (!result.success) {
      this.errorMessage = result.errorMessage ?? 'Unable to log in.';
      return;
    }

    // Reload so every synchronous tracker service is created from the
    // Firestore data that was hydrated during sign-in.
    this.reloadApp(
      this.getPostLoginDestination()
    );
  }

  reloadApp(destination = '/home'): void {
    window.location.replace(destination);
  }

  async resetPassword(): Promise<void> {
    this.clearMessages();
    const emailControl = this.loginForm.get('email');

    if (!emailControl || emailControl.invalid) {
      emailControl?.markAsTouched();
      this.errorMessage = 'Enter your email address first, then try again.';
      return;
    }

    this.isResettingPassword = true;
    const result = await this.authService.resetPassword(emailControl.value);
    this.isResettingPassword = false;

    if (!result.success) {
      this.errorMessage =
        result.errorMessage ?? 'Unable to send the reset email.';
      return;
    }

    this.successMessage = 'Password reset email sent. Check your inbox.';
  }

  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  getPostLoginDestination(): string {
    const returnUrl =
      this.route.snapshot.queryParamMap.get(
        'returnUrl'
      );

    return (
      returnUrl?.startsWith('/') &&
      !returnUrl.startsWith('//') &&
      returnUrl !== '/login' &&
      returnUrl !== '/signup'
    )
      ? returnUrl
      : '/home';
  }
}
