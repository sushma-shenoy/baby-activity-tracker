import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CaregiverChangeRequest, ChangeRequestService } from '../../services/change-request.service';
import { CaregiverSharingService } from '../../services/caregiver-sharing.service';
import { BabyProfileService } from '../../services/baby-profile.service';

@Component({
  selector: 'app-pending-changes-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="pending-panel" *ngIf="requests.length">
      <div class="pending-heading">
        <span>⏳</span>
        <div><strong>Pending owner approval</strong><small>These changes are not in the family record yet.</small></div>
      </div>
      <article *ngFor="let request of requests">
        <span class="pending-badge">Pending</span>
        <strong>{{ title(request) }}</strong>
        <p>{{ detail(request) }}</p>
        <small>{{ babyName(request) }} · {{ dateLabel(request) }}</small>
      </article>
    </section>
  `,
  styles: [`
    .pending-panel{margin:14px 0;padding:13px;border:1px solid #e8c87f;border-radius:18px;background:#fff8e8;box-shadow:0 7px 18px rgba(139,101,33,.08)}
    .pending-heading{display:flex;align-items:center;gap:10px;margin-bottom:9px}.pending-heading>span{display:grid;width:38px;height:38px;place-items:center;border-radius:12px;background:#ffebbc}.pending-heading div{display:grid;gap:2px}.pending-heading strong{color:#594725;font-size:.82rem}.pending-heading small{color:#8b7650;font-size:.66rem}
    article{position:relative;margin-top:8px;padding:11px;border:1px solid #edd59d;border-radius:13px;background:#fff}article>strong{display:block;padding-right:62px;color:#55472e;font-size:.78rem}article p{margin:5px 0;color:#6f624d;font-size:.72rem;line-height:1.4}article>small{color:#917d5b;font-size:.64rem}.pending-badge{position:absolute;top:9px;right:9px;padding:4px 7px;border-radius:9px;color:#855f1f;background:#ffebbc;font-size:.56rem;font-weight:900;text-transform:uppercase}
  `]
})
export class PendingChangesPanelComponent implements OnInit, OnDestroy {
  @Input() keys: string[] = [];
  @Input() activityTypes: string[] = [];
  requests: CaregiverChangeRequest[] = [];
  private readonly refreshListener = () => void this.load();

  constructor(
    private readonly requestService: ChangeRequestService,
    private readonly sharingService: CaregiverSharingService,
    private readonly profiles: BabyProfileService
  ) {}

  ngOnInit(): void {
    window.addEventListener('baby-tracker:change-proposed', this.refreshListener);
    void this.load();
  }

  ngOnDestroy(): void {
    window.removeEventListener('baby-tracker:change-proposed', this.refreshListener);
  }

  title(request: CaregiverChangeRequest): string {
    const labels: Record<string, string> = {
      feeds: 'Feeding change', nursing_sessions: 'Nursing change',
      active_nursing_session: 'Nursing timer change', baby_solid_food_entries: 'Solid food change',
      sleep_state: 'Sleep change', baby_weight_entries: 'Growth change',
      baby_medicine_entries: 'Medicine change', baby_vaccination_entries: 'Vaccination change',
      baby_temperature_entries: 'Temperature change', baby_temperature_unit: 'Temperature unit change',
      baby_milestones: 'Milestone change', baby_daily_journal_entries: 'Journal change'
    };
    if (request.key === 'baby_activities') return `${this.activityTypeLabel(request)} change`;
    return labels[request.key] || 'Tracker change';
  }

  detail(request: CaregiverChangeRequest): string {
    if (request.operation === 'remove') return 'Remove saved information';
    const changed = this.changedObject(request);
    if (!changed) return 'Update saved information';
    const hidden = new Set(['id','uid','userId','profileId','babyId','createdAt','updatedAt','createdByUid','createdByName']);
    const record = changed as Record<string, unknown>;
    if (record['quantity'] != null && record['time']) {
      const type = record['type'] === 'expressed' ? 'Expressed milk' : String(record['type'] || 'Feeding');
      return `${type} · ${record['quantity']} mL · ${record['time']}`;
    }
    return Object.entries(record).filter(([key, value]) => !hidden.has(key) && value !== '' && value != null)
      .slice(0, 4).map(([key, value]) => `${this.words(key)}: ${String(value)}`).join(' · ') || 'Update saved information';
  }

  babyName(request: CaregiverChangeRequest): string {
    return this.profiles.profiles.find(profile => profile.id === request.profileId)?.name || 'Baby';
  }

  dateLabel(request: CaregiverChangeRequest): string {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(request.createdAt));
  }

  private async load(): Promise<void> {
    if (this.sharingService.currentFamilyRole !== 'editor') return;
    try {
      const all = await this.requestService.listMine(this.sharingService.familyOwnerId);
      this.requests = all.filter(request => {
        if (!this.keys.includes(request.key)) return false;
        if (request.key !== 'baby_activities') return true;
        return this.activityTypes.includes(this.activityType(request));
      });
    } catch { this.requests = []; }
  }

  private changedObject(request: CaregiverChangeRequest): object | null {
    try {
      const after = JSON.parse(request.value) as unknown;
      const before = JSON.parse(request.baseValue || '[]') as unknown;
      if (Array.isArray(after)) {
        const originals = new Set(Array.isArray(before) ? before.map(item => JSON.stringify(item)) : []);
        return (after.find(item => !originals.has(JSON.stringify(item))) as object) || null;
      }
      return after && typeof after === 'object' ? after : null;
    } catch { return null; }
  }

  private activityType(request: CaregiverChangeRequest): string {
    const item = this.changedObject(request) as { type?: string } | null;
    return typeof item?.type === 'string' ? item.type : '';
  }

  private activityTypeLabel(request: CaregiverChangeRequest): string {
    const type = this.activityType(request);
    return type === 'diaper' ? 'Diaper' : type === 'sleep' ? 'Sleep' : type === 'solids' ? 'Solid food' : 'Feeding';
  }

  private words(value: string): string { return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase(); }
}
