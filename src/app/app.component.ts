import { Component, OnDestroy } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { ToastController } from '@ionic/angular';
import {
  ActivityReminderService
} from './services/notification';
@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnDestroy {
  private permissionToast?: HTMLIonToastElement;
  private readonly permissionDeniedListener = (event: Event) => {
    const customEvent = event as CustomEvent<{ message?: string }>;
    void this.showPermissionMessage(customEvent.detail?.message);
  };
  private readonly accessRemovedListener = () => {
    void this.showAccessRemovedMessage();
  };

  constructor(
    private readonly activityReminderService: ActivityReminderService,
    private readonly toastController: ToastController
  ) {
    void this.activityReminderService.initialize();
    window.addEventListener(
      'baby-tracker:permission-denied',
      this.permissionDeniedListener
    );
    window.addEventListener(
      'baby-tracker:family-access-removed',
      this.accessRemovedListener
    );
  }

  ngOnDestroy(): void {
    window.removeEventListener(
      'baby-tracker:permission-denied',
      this.permissionDeniedListener
    );
    window.removeEventListener(
      'baby-tracker:family-access-removed',
      this.accessRemovedListener
    );
  }

  private async showPermissionMessage(message?: string): Promise<void> {
    await this.permissionToast?.dismiss();
    this.permissionToast = await this.toastController.create({
      message: message ||
        'This family is view-only. Ask the owner for Editor access.',
      duration: 3500,
      position: 'bottom',
      color: 'warning',
      buttons: [{ text: 'OK', role: 'cancel' }]
    });
    await this.permissionToast.present();
  }

  private async showAccessRemovedMessage(): Promise<void> {
    await this.permissionToast?.dismiss();
    this.permissionToast = await this.toastController.create({
      message: 'Your access to that shared family was removed. You are now viewing your private profile.',
      duration: 4500,
      position: 'bottom',
      color: 'warning',
      buttons: [{ text: 'OK', role: 'cancel' }]
    });
    await this.permissionToast.present();
    window.setTimeout(() => window.location.assign('/home'), 250);
  }
}
