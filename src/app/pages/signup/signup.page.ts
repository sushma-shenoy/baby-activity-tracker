import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import {
  IonContent,
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonText,
  IonIcon,
  IonCard,
  IonCardContent,
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
    IonContent,
    IonButton,
    IonInput,
    IonItem,
    IonLabel,
    IonText,
    IonIcon,
    IonCard,
    IonCardContent,
    IonSpinner
  ]
})
export class SignupPage {
  signupForm: FormGroup;

  hidePassword = true;
  hideConfirmPassword = true;

  isLoading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.signupForm = this.fb.group({
      name: [
        '',
        [
          Validators.required,
          Validators.minLength(2)
        ]
      ],

      email: [
        '',
        [
          Validators.required,
          Validators.email
        ]
      ],

      password: [
        '',
        [
          Validators.required,
          Validators.minLength(6)
        ]
      ],

      confirmPassword: [
        '',
        Validators.required
      ]
    });
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

    console.log(
      'Account created:',
      result.user
    );

    await this.router.navigateByUrl(
      '/home',
      {
        replaceUrl: true
      }
    );
  }
}