import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { firebaseAuth } from '../../firebase/firebase.config';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-caregiver-no-access',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './caregiver-no-access.page.html',
  styleUrls: ['./caregiver-no-access.page.scss']
})
export class CaregiverNoAccessPage {
  inviteCode = '';
  errorMessage = '';
  isBusy = false;

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService
  ) {}

  joinFamily(): void {
    const code = this.inviteCode.trim();
    if (!code) {
      this.errorMessage = 'Enter the invitation code sent by the family owner.';
      return;
    }
    void this.router.navigate(['/caregiver-invite'], { queryParams: { code } });
  }

  createFamily(): void {
    void this.router.navigate(['/create-family'], {
      queryParams: { returnUrl: '/caregiver-no-access' }
    });
  }

  async signOut(): Promise<void> {
    this.isBusy = true;
    const result = await this.authService.logout();
    this.isBusy = false;
    if (result.success) void this.router.navigateByUrl('/login', { replaceUrl: true });
    else this.errorMessage = result.errorMessage || 'Unable to sign out.';
  }
}
