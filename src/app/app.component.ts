import { Component, OnDestroy } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { ToastController } from '@ionic/angular';
import {
  ActivityReminderService
} from './services/notification';
import { firebaseAuth } from './firebase/firebase.config';
import { trackerStorage } from './firebase/tracker-storage';
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
  private readonly assignmentChangedListener = () => {
    void this.showAssignmentChangedMessage();
  };
  private readonly writeFailedListener = () => {
    void this.showPermissionMessage(
      'Your change could not be saved. The previous value has been restored.'
    );
  };
  private readonly changeProposedListener = () => {
    void this.showPermissionMessage(
      'Change sent to the family owner for approval.'
    );
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
    window.addEventListener(
      'baby-tracker:caregiver-assignment-changed',
      this.assignmentChangedListener
    );
    window.addEventListener(
      'baby-tracker:write-failed',
      this.writeFailedListener
    );
    window.addEventListener(
      'baby-tracker:change-proposed',
      this.changeProposedListener
    );
    const user = firebaseAuth.currentUser;
    if (
      user &&
      trackerStorage.isCaregiverOnlyAccount &&
      !trackerStorage.isUsingSharedFamily &&
      window.location.pathname !== '/caregiver-no-access' &&
      !window.location.pathname.startsWith('/caregiver-invite')
    ) {
      queueMicrotask(() => window.location.assign('/caregiver-no-access'));
    }
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
    window.removeEventListener(
      'baby-tracker:caregiver-assignment-changed',
      this.assignmentChangedListener
    );
    window.removeEventListener(
      'baby-tracker:write-failed',
      this.writeFailedListener
    );
    window.removeEventListener(
      'baby-tracker:change-proposed',
      this.changeProposedListener
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
    window.setTimeout(() => window.location.assign('/caregiver-no-access'), 250);
  }

  private async showAssignmentChangedMessage(): Promise<void> {
    await this.permissionToast?.dismiss();
    this.permissionToast = await this.toastController.create({
      message: 'Your assigned baby was changed by the family owner. The new baby profile is now open.',
      duration: 4500,
      position: 'bottom',
      color: 'primary',
      buttons: [{ text: 'OK', role: 'cancel' }]
    });
    await this.permissionToast.present();
    window.setTimeout(() => window.location.assign('/home'), 250);
  }
}
