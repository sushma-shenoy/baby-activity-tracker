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

@Component({
  selector: 'app-my-change-requests',
  templateUrl: './my-change-requests.page.html',
  styleUrls: ['./my-change-requests.page.scss'],
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
export class MyChangeRequestsPage {
  private readonly requestService = inject(ChangeRequestService);
  private readonly sharingService = inject(CaregiverSharingService);
  private readonly router = inject(Router);
  private readonly alertController = inject(AlertController);

  requests: CaregiverChangeRequest[] = [];
  loading = true;
  busyId = '';
  errorMessage = '';
  message = '';
  readonly selectedIds = new Set<string>();

  constructor() {
    if (this.sharingService.currentFamilyRole !== 'editor') {
      void this.router.navigateByUrl('/home', { replaceUrl: true });
      return;
    }
    void this.load();
  }

  title(request: CaregiverChangeRequest): string {
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

  proposedValue(request: CaregiverChangeRequest): string {
    if (request.operation === 'remove') return 'Remove this saved information';
    try {
      const proposed = JSON.parse(request.value) as unknown;
      const original = JSON.parse(request.baseValue || 'null') as unknown;
      if (Array.isArray(proposed)) {
        const originals = new Set(
          Array.isArray(original) ? original.map(item => JSON.stringify(item)) : []
        );
        const added = proposed.find(item => !originals.has(JSON.stringify(item)));
        if (added && typeof added === 'object') return this.describeObject(added);
        return `${proposed.length} saved ${proposed.length === 1 ? 'record' : 'records'}`;
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

  async cancel(request: CaregiverChangeRequest): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Cancel this request?',
      message: 'The family owner will no longer be able to approve this change.',
      buttons: [
        { text: 'Keep request', role: 'cancel' },
        {
          text: 'Cancel request',
          role: 'destructive',
          handler: () => void this.confirmCancel(request)
        }
      ]
    });
    await alert.present();
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

  async cancelSelected(): Promise<void> {
    if (!this.selectedIds.size) return;
    const alert = await this.alertController.create({
      header: `Cancel ${this.selectedIds.size} requests?`,
      message: 'The family owner will no longer be able to approve these changes.',
      buttons: [
        { text: 'Keep requests', role: 'cancel' },
        {
          text: 'Cancel selected',
          role: 'destructive',
          handler: () => void this.confirmCancelSelected()
        }
      ]
    });
    await alert.present();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    try {
      this.requests = await this.requestService.listMine(
        this.sharingService.familyOwnerId
      );
    } catch {
      this.errorMessage = 'Unable to load your pending requests.';
    } finally {
      this.loading = false;
    }
  }

  private async confirmCancel(request: CaregiverChangeRequest): Promise<void> {
    this.busyId = request.id;
    this.errorMessage = '';
    this.message = '';
    try {
      await this.requestService.cancelMineMany(
        this.sharingService.familyOwnerId,
        [request.id, ...(request.companionIds || [])]
      );
      this.requests = this.requests.filter(item => item.id !== request.id);
      this.selectedIds.delete(request.id);
      this.message = 'Request cancelled.';
    } catch (error) {
      this.errorMessage = error instanceof Error
        ? error.message
        : 'Unable to cancel this request.';
    } finally {
      this.busyId = '';
    }
  }

  private describeObject(value: object): string {
    const hidden = new Set([
      'id', 'uid', 'userId', 'ownerId', 'caregiverId', 'profileId', 'babyId',
      'createdAt', 'updatedAt', 'createdByUid', 'createdByName'
    ]);
    const record = value as Record<string, unknown>;
    if (
      typeof record['type'] === 'string' &&
      Number.isFinite(Number(record['quantity'])) &&
      typeof record['time'] === 'string'
    ) {
      const type = record['type'] === 'expressed' ? 'Expressed milk' : 'Formula';
      return `${type} · ${Number(record['quantity'])} mL · ${record['time']}`;
    }
    const details = Object.entries(value)
      .filter(([key, item]) => !hidden.has(key) && item !== '' && item != null)
      .slice(0, 4)
      .map(([key, item]) => `${this.words(key)}: ${String(item)}`);
    return details.join(' · ') || 'Update saved family information';
  }

  private async confirmCancelSelected(): Promise<void> {
    const selectedRequests = this.requests.filter(item => this.selectedIds.has(item.id));
    const ids = selectedRequests.flatMap(item => [item.id, ...(item.companionIds || [])]);
    const visibleCount = selectedRequests.length;
    this.busyId = 'bulk';
    this.errorMessage = '';
    this.message = '';
    try {
      await this.requestService.cancelMineMany(
        this.sharingService.familyOwnerId,
        ids
      );
      this.requests = this.requests.filter(item => !this.selectedIds.has(item.id));
      this.selectedIds.clear();
      this.message = `${visibleCount} ${visibleCount === 1 ? 'request' : 'requests'} cancelled.`;
    } catch (error) {
      await this.load();
      this.selectedIds.clear();
      this.errorMessage = error instanceof Error
        ? error.message
        : 'Unable to cancel the selected requests.';
    } finally {
      this.busyId = '';
    }
  }

  private words(value: string): string {
    return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();
  }
}
