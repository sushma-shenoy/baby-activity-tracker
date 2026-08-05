import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertController } from '@ionic/angular';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonSpinner,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import {
  CaregiverMember,
  CaregiverSharingService,
  PendingCaregiverInvite,
  SharedFamily
} from '../../services/caregiver-sharing.service';

@Component({
  selector: 'app-family-settings',
  templateUrl: './family-settings.page.html',
  styleUrls: ['./family-settings.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonSpinner,
    IonTitle,
    IonToolbar
  ]
})
export class FamilySettingsPage {
  readonly caregiverSharingService = inject(CaregiverSharingService);
  private readonly alertController = inject(AlertController);

  caregivers: CaregiverMember[] = [];
  pendingInvites: PendingCaregiverInvite[] = [];
  sharedFamilies: SharedFamily[] = [];
  isBusy = false;
  message = '';
  errorMessage = '';

  constructor() {
    void this.load();
  }

  get activeSharedFamilyName(): string {
    return this.sharedFamilies.find(
      family => family.ownerId === this.caregiverSharingService.familyOwnerId
    )?.ownerName ?? 'Shared family';
  }

  async changeRole(member: CaregiverMember, role: CaregiverMember['role']): Promise<void> {
    if (member.role === role) return;
    this.isBusy = true;
    this.errorMessage = '';
    try {
      await this.caregiverSharingService.setCaregiverRole(member.id, role);
      member.role = role;
      this.message = `${member.displayName} is now a${role === 'editor' ? 'n editor' : ' viewer'}.`;
    } catch (error) {
      this.errorMessage = this.errorText(error);
    } finally {
      this.isBusy = false;
    }
  }

  async removeCaregiver(member: CaregiverMember): Promise<void> {
    const alert = await this.alertController.create({
      header: `Remove ${member.displayName}?`,
      message:
        'They will immediately lose access to every baby profile and shared care record in this family account.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Remove caregiver',
          role: 'destructive',
          handler: () => void this.confirmRemoveCaregiver(member)
        }
      ]
    });
    await alert.present();
  }

  async revokeInvite(invite: PendingCaregiverInvite): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Revoke invitation?',
      message: `The unused invitation for ${invite.babyName} will stop working immediately.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Revoke invitation',
          role: 'destructive',
          handler: () => void this.confirmRevokeInvite(invite)
        }
      ]
    });
    await alert.present();
  }

  inviteExpiryLabel(invite: PendingCaregiverInvite): string {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(invite.expiresAt));
  }

  async switchToPrivateProfile(): Promise<void> {
    await this.runAndReload(() => this.caregiverSharingService.switchToPrivateProfile());
  }

  async switchToFamily(family: SharedFamily): Promise<void> {
    await this.runAndReload(() => this.caregiverSharingService.switchFamily(family.ownerId));
  }

  async leaveFamily(): Promise<void> {
    await this.runAndReload(() => this.caregiverSharingService.leaveSharedFamily());
  }

  private async load(): Promise<void> {
    this.errorMessage = '';
    const [caregivers, families, invitations] = await Promise.all([
      this.caregiverSharingService.listCaregivers()
        .then(value => ({ value, failed: false }))
        .catch(() => ({ value: [] as CaregiverMember[], failed: true })),
      this.caregiverSharingService.listSharedFamilies()
        .then(value => ({ value, failed: false }))
        .catch(() => ({ value: [] as SharedFamily[], failed: true })),
      this.caregiverSharingService.listPendingInvites()
        .then(value => ({ value, failed: false }))
        .catch(() => ({
          value: [] as PendingCaregiverInvite[],
          failed: true
        }))
    ]);

    this.caregivers = caregivers.value;
    this.sharedFamilies = families.value;
    this.pendingInvites = invitations.value;

    const essentialLoadFailed = this.caregiverSharingService.isSharingAnotherFamily
      ? families.failed
      : caregivers.failed;
    if (essentialLoadFailed) {
      this.errorMessage = 'Unable to load family sharing.';
    }
  }

  private async confirmRemoveCaregiver(member: CaregiverMember): Promise<void> {
    this.isBusy = true;
    this.errorMessage = '';
    try {
      await this.caregiverSharingService.removeCaregiver(member.id);
      await this.load();
      this.message = `${member.displayName} was removed.`;
    } catch (error) {
      this.errorMessage = this.errorText(error);
    } finally {
      this.isBusy = false;
    }
  }

  private async confirmRevokeInvite(
    invite: PendingCaregiverInvite
  ): Promise<void> {
    this.isBusy = true;
    this.errorMessage = '';
    try {
      await this.caregiverSharingService.revokeInvite(invite.code);
      this.pendingInvites = this.pendingInvites.filter(
        item => item.code !== invite.code
      );
      this.message = 'Invitation revoked.';
    } catch (error) {
      this.errorMessage = this.errorText(error);
    } finally {
      this.isBusy = false;
    }
  }

  private async runAndReload(action: () => Promise<void>): Promise<void> {
    this.isBusy = true;
    this.errorMessage = '';
    try {
      await action();
      window.location.reload();
    } catch (error) {
      this.errorMessage = this.errorText(error);
      this.isBusy = false;
    }
  }

  private errorText(error: unknown): string {
    return error instanceof Error ? error.message : 'Unable to update family sharing.';
  }
}
