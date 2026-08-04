import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
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

  caregivers: CaregiverMember[] = [];
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
    try {
      [this.caregivers, this.sharedFamilies] = await Promise.all([
        this.caregiverSharingService.listCaregivers(),
        this.caregiverSharingService.listSharedFamilies()
      ]);
    } catch {
      this.caregivers = [];
      this.sharedFamilies = [];
      this.errorMessage = 'Unable to load family sharing.';
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
