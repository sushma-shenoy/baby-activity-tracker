import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
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
  CaregiverChangeRequest,
  ChangeRequestService
} from '../../services/change-request.service';
import { CaregiverSharingService } from '../../services/caregiver-sharing.service';
import { trackerStorage } from '../../firebase/tracker-storage';
import { BabyProfileService } from '../../services/baby-profile.service';

@Component({
  selector: 'app-change-requests',
  templateUrl: './change-requests.page.html',
  styleUrls: ['./change-requests.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonSpinner,
    IonTitle,
    IonToolbar
  ]
})
export class ChangeRequestsPage {
  private readonly requestService = inject(ChangeRequestService);
  private readonly sharingService = inject(CaregiverSharingService);
  private readonly router = inject(Router);
  private readonly profiles = inject(BabyProfileService);
  private readonly alertController = inject(AlertController);

  requests: CaregiverChangeRequest[] = [];
  busyId = '';
  errorMessage = '';
  message = '';
  readonly selectedIds = new Set<string>();

  constructor() {
    if (!this.sharingService.canManageBabyProfiles) {
      void this.router.navigateByUrl('/settings', { replaceUrl: true });
      return;
    }
    void this.load();
  }

  async approve(request: CaregiverChangeRequest): Promise<void> {
    await this.run(request, 'approved', () =>
      this.requestService.approveMany([request.id, ...(request.companionIds || [])])
    );
  }

  async reject(request: CaregiverChangeRequest): Promise<void> {
    await this.run(request, 'rejected', () =>
      this.requestService.rejectMany([request.id, ...(request.companionIds || [])])
    );
  }

  isSelected(requestId: string): boolean {
    return this.selectedIds.has(requestId);
  }

  toggleSelected(requestId: string): void {
    if (this.selectedIds.has(requestId)) this.selectedIds.delete(requestId);
    else this.selectedIds.add(requestId);
  }

  toggleAll(): void {
    if (this.selectedIds.size === this.requests.length) this.selectedIds.clear();
    else this.requests.forEach(request => this.selectedIds.add(request.id));
  }

  async approveSelected(): Promise<void> {
    const selectedRequests = this.requests.filter(item => this.selectedIds.has(item.id));
    const ids = selectedRequests.flatMap(item => [item.id, ...(item.companionIds || [])]);
    const visibleCount = selectedRequests.length;
    if (!ids.length) return;
    this.busyId = 'bulk';
    this.errorMessage = '';
    this.message = '';
    try {
      await this.requestService.approveMany(ids);
      this.requests = this.requests.filter(item => !this.selectedIds.has(item.id));
      this.selectedIds.clear();
      this.message = `${visibleCount} ${visibleCount === 1 ? 'change' : 'changes'} approved.`;
    } catch (error) {
      await this.load();
      this.selectedIds.clear();
      this.errorMessage = error instanceof Error
        ? error.message
        : 'Unable to approve the selected changes.';
    } finally {
      this.busyId = '';
    }
  }

  async rejectSelected(): Promise<void> {
    if (!this.selectedIds.size) return;
    const alert = await this.alertController.create({
      header: `Reject ${this.selectedIds.size} selected requests?`,
      message: 'The caregiver’s proposed changes will not be added to the family record.',
      buttons: [
        { text: 'Keep requests', role: 'cancel' },
        {
          text: 'Reject selected',
          role: 'destructive',
          handler: () => void this.confirmRejectSelected()
        }
      ]
    });
    await alert.present();
  }

  title(request: CaregiverChangeRequest): string {
    if (request.key === 'baby_activities') return `${this.activityType(request)} change`;
    const labels: Record<string, string> = {
      baby_activities: 'Activity timeline',
      feeds: 'Feeding records',
      baby_solid_food_entries: 'Solid food records',
      sleep_state: 'Sleep records',
      baby_weight_entries: 'Growth records',
      baby_medicine_entries: 'Medicine records',
      baby_vaccination_entries: 'Vaccination records',
      baby_temperature_entries: 'Temperature records',
      baby_milestones: 'Milestones',
      nursing_sessions: 'Nursing records',
      baby_daily_journal_entries: 'Journal entries'
    };
    return labels[request.key] || 'Family tracker data';
  }

  babyName(request: CaregiverChangeRequest): string {
    if (!request.profileId) return 'Outdated request — baby not recorded';
    return this.profiles.profiles.find(profile => profile.id === request.profileId)?.name || 'Baby';
  }

  summary(request: CaregiverChangeRequest): string {
    if (request.operation === 'remove') return 'Remove the stored record group';
    try {
      const proposed = JSON.parse(request.value);
      const current = JSON.parse(trackerStorage.getItem(request.key) || '[]');
      if (Array.isArray(proposed) && Array.isArray(current)) {
        return `Change from ${current.length} to ${proposed.length} records`;
      }
    } catch {
      // Use the safe generic description below.
    }
    return 'Update the stored family data';
  }

  proposedValue(request: CaregiverChangeRequest): string {
    if (request.operation === 'remove') return 'Remove this saved information';
    try {
      const proposed = JSON.parse(request.value) as unknown;
      const original = JSON.parse(request.baseValue || 'null') as unknown;
      if (Array.isArray(proposed)) {
        const originals = new Set(
          Array.isArray(original) ? original.map(item => JSON.stringify(item)) : []
        );
        const changed = proposed.find(item => !originals.has(JSON.stringify(item)));
        if (changed && typeof changed === 'object') return this.describeObject(changed);
        return 'Update saved records';
      }
      if (proposed && typeof proposed === 'object') return this.describeObject(proposed);
      return String(proposed);
    } catch {
      return 'Update saved family information';
    }
  }

  dateLabel(request: CaregiverChangeRequest): string {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(request.createdAt));
  }

  private async load(): Promise<void> {
    try {
      this.requests = await this.requestService.list();
    } catch {
      this.errorMessage = 'Unable to load caregiver requests.';
    }
  }

  private async run(
    request: CaregiverChangeRequest,
    result: 'approved' | 'rejected',
    action: () => Promise<void>
  ): Promise<void> {
    this.busyId = request.id;
    this.errorMessage = '';
    this.message = '';
    try {
      await action();
      this.requests = this.requests.filter(item => item.id !== request.id);
      this.selectedIds.delete(request.id);
      this.message = `Change ${result}.`;
    } catch (error) {
      this.errorMessage = error instanceof Error
        ? error.message
        : 'Unable to review this change.';
    } finally {
      this.busyId = '';
    }
  }

  private async confirmRejectSelected(): Promise<void> {
    const selected = this.requests.filter(item => this.selectedIds.has(item.id));
    const ids = selected.reduce<string[]>((all, item) =>
      [...all, item.id, ...(item.companionIds || [])], []);
    this.busyId = 'bulk-reject';
    this.errorMessage = '';
    this.message = '';
    try {
      await this.requestService.rejectMany(ids);
      this.requests = this.requests.filter(item => !this.selectedIds.has(item.id));
      this.selectedIds.clear();
      this.message = `${selected.length} ${selected.length === 1 ? 'request' : 'requests'} rejected.`;
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to reject selected requests.';
    } finally {
      this.busyId = '';
    }
  }

  private describeObject(value: object): string {
    const record = value as Record<string, unknown>;
    if (
      typeof record['type'] === 'string' &&
      Number.isFinite(Number(record['quantity'])) &&
      typeof record['time'] === 'string'
    ) {
      const type = record['type'] === 'expressed' ? 'Expressed milk' : 'Formula';
      return `${type} · ${Number(record['quantity'])} mL · ${record['time']}`;
    }

    const hidden = new Set([
      'id', 'uid', 'userId', 'ownerId', 'caregiverId', 'profileId', 'babyId',
      'createdAt', 'updatedAt', 'createdByUid', 'createdByName'
    ]);
    const details = Object.entries(record)
      .filter(([key, item]) => !hidden.has(key) && item !== '' && item != null)
      .slice(0, 4)
      .map(([key, item]) => `${this.words(key)}: ${String(item)}`);
    return details.join(' · ') || 'Update saved family information';
  }

  private words(value: string): string {
    return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();
  }

  private activityType(request: CaregiverChangeRequest): string {
    try {
      const after = JSON.parse(request.value) as Array<{ type?: string }>;
      const before = new Set((JSON.parse(request.baseValue || '[]') as unknown[]).map(item => JSON.stringify(item)));
      const item = Array.isArray(after) ? after.find(value => !before.has(JSON.stringify(value))) : null;
      return item?.type === 'diaper' ? 'Diaper' : item?.type === 'sleep' ? 'Sleep' : item?.type === 'solids' ? 'Solid food' : 'Feeding';
    } catch { return 'Tracker'; }
  }
}
