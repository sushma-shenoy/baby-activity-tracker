import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import { AlertController } from '@ionic/angular';
import { DataExportService } from '../../services/data-export.service';

@Component({
  selector: 'app-data-settings',
  templateUrl: './data-settings.page.html',
  styleUrls: ['./data-settings.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar
  ]
})
export class DataSettingsPage {
  private readonly dataExportService = inject(DataExportService);
  private readonly alertController = inject(AlertController);

  isRestoring = false;
  message = '';
  errorMessage = '';

  downloadBackup(): void {
    this.message = '';
    this.errorMessage = '';
    try {
      const filename = this.dataExportService.download();
      this.message = `${filename} downloaded. Keep it private.`;
    } catch {
      this.errorMessage = 'The backup could not be downloaded. Try again in your browser.';
    }
  }

  async selectBackup(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.message = '';
    this.errorMessage = '';
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
              this.message = `${restored} data groups restored. Reloading the app…`;
              setTimeout(() => window.location.reload(), 500);
            }
          }
        ]
      });
      await alert.present();
    } catch (error) {
      this.errorMessage = error instanceof Error
        ? error.message
        : 'Could not read this backup.';
    }
  }
}
