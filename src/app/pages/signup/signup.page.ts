import { Component, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import {
  IonContent,
  IonButton,
  IonInput,
  IonItem,
  IonSpinner
} from '@ionic/angular/standalone';

import { CommonModule } from '@angular/common';

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
  private readonly router = inject(Router);

  signupForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required]
  });

  hidePassword = true;
  hideConfirmPassword = true;

  isLoading = false;
  errorMessage = '';

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

    await this.router.navigateByUrl(
      '/home',
      {
        replaceUrl: true
      }
    );
  }
}
