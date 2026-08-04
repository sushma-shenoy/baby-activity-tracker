import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import * as QRCode from 'qrcode';
import { environment } from '../../../environments/environment';
import {
  CaregiverInviteDetails,
  CaregiverSharingService
} from '../../services/caregiver-sharing.service';
import { BabyProfileService } from '../../services/baby-profile.service';

type InviteState = 'create' | 'joining' | 'joined' | 'error';

@Component({
  selector: 'app-caregiver-invite',
  templateUrl: './caregiver-invite.page.html',
  styleUrls: ['./caregiver-invite.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class CaregiverInvitePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly sharingService = inject(CaregiverSharingService);
  readonly babyProfileService = inject(BabyProfileService);

  state: InviteState = 'create';
  isBusy = false;
  recipientEmail = '';
  inviteCode = '';
  redemptionCode = '';
  inviteUrl = '';
  qrDataUrl = '';
  message = '';
  errorMessage = '';
  joinedFamilyName = '';
  joinedBabyName = '';

  async ngOnInit(): Promise<void> {
    const code = this.route.snapshot.queryParamMap.get('code');
    if (code) await this.acceptInvitation(code);
  }

  get babyName(): string {
    return this.babyProfileService.activeProfile?.name || 'your baby';
  }

  async createInvitation(): Promise<void> {
    this.isBusy = true;
    this.errorMessage = '';
    this.message = '';
    try {
      this.inviteCode = await this.sharingService.createInvite();
      const baseUrl = environment.appUrl || window.location.origin;
      this.inviteUrl =
        `${baseUrl.replace(/\/$/, '')}/caregiver-invite?code=` +
        encodeURIComponent(this.inviteCode);
      this.qrDataUrl = await QRCode.toDataURL(this.inviteUrl, {
        width: 360,
        margin: 2,
        color: { dark: '#493966', light: '#FFFFFF' }
      });
      this.message = 'Invitation ready. It expires in 24 hours and can be used once.';
    } catch (error) {
      this.errorMessage = this.errorText(error);
    } finally {
      this.isBusy = false;
    }
  }

  async redeemCode(): Promise<void> {
    const code = this.redemptionCode.trim();
    if (!code) {
      this.errorMessage = 'Enter an invite code.';
      return;
    }
    await this.acceptInvitation(code);
  }

  sendEmail(): void {
    if (!this.inviteUrl || !this.isValidEmail(this.recipientEmail)) {
      this.errorMessage = 'Enter a valid caregiver email address first.';
      return;
    }
    const subject = `You’re invited to care for ${this.babyName}`;
    const body = [
      '👶 You have been invited to be a caregiver!',
      '',
      `You are invited to help care for ${this.babyName} in Baby Tracker.`,
      'You will be able to stay connected with feeding, sleep, diaper, health, and milestone updates.',
      '',
      'Open your secure invitation:',
      this.inviteUrl,
      '',
      'This invitation expires in 24 hours and works only once.',
      '',
      'With care,',
      `${this.babyName}’s family 💜`
    ].join('\n');
    window.location.href =
      `mailto:${encodeURIComponent(this.recipientEmail)}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
  }

  async shareInvitation(): Promise<void> {
    if (!this.inviteUrl) return;
    const text =
      `You’re invited to be a caregiver for ${this.babyName} in Baby Tracker. ` +
      'This secure invitation expires in 24 hours.';
    if (navigator.share) {
      await navigator.share({
        title: `Care for ${this.babyName}`,
        text,
        url: this.inviteUrl
      });
      return;
    }
    await this.copyLink();
  }

  async copyLink(): Promise<void> {
    if (!this.inviteUrl) return;
    await navigator.clipboard.writeText(this.inviteUrl);
    this.message = 'Invitation link copied.';
  }

  private async acceptInvitation(code: string): Promise<void> {
    this.state = 'joining';
    try {
      const details: CaregiverInviteDetails =
        await this.sharingService.getInviteDetails(code);
      this.joinedBabyName = details.babyName;
      this.joinedFamilyName = await this.sharingService.joinWithCode(code);
      this.state = 'joined';
    } catch (error) {
      this.errorMessage = this.errorText(error);
      this.state = 'error';
    }
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  private errorText(error: unknown): string {
    return error instanceof Error
      ? error.message
      : 'Something went wrong. Please try again.';
  }
}
