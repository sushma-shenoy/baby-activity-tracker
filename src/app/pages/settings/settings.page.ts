import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonSpinner,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonSpinner,
    IonTitle,
    IonToolbar
  ]
})
export class SettingsPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  isLoggingOut = false;
  errorMessage = '';

  get displayName(): string {
    return this.authService.currentUser?.displayName || 'Parent';
  }

  get email(): string {
    return this.authService.currentUser?.email || '';
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
}
