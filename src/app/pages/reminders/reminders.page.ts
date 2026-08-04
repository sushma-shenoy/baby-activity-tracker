import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonTitle,
  IonToggle,
  IonToolbar
} from '@ionic/angular/standalone';
import {
  ActivityReminder,
  ActivityReminderService,
  CustomReminder
} from '../../services/notification';

@Component({
  selector: 'app-reminders',
  templateUrl: './reminders.page.html',
  styleUrls: ['./reminders.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonInput,
    IonItem,
    IonTitle,
    IonToggle,
    IonToolbar
  ]
})
export class RemindersPage {
  private readonly fb = inject(FormBuilder);
  readonly reminderService = inject(ActivityReminderService);

  reminderMessage = '';
  reminderError = '';
  reminderSavingType = '';
  isAddingCustomReminder = false;

  readonly customReminderForm = this.fb.nonNullable.group({
    label: ['', [Validators.required, Validators.maxLength(50)]],
    time: ['12:00', [Validators.required, Validators.pattern(
      /^([01]\d|2[0-3]):([0-5]\d)$/
    )]]
  });

  async updateReminder(
    reminder: ActivityReminder,
    enabled: boolean,
    time = reminder.time
  ): Promise<void> {
    this.clearMessages();
    this.reminderSavingType = reminder.type;
    const result = await this.reminderService.update(
      reminder.type,
      { enabled, time }
    );
    this.reminderSavingType = '';
    if (!result.success) {
      this.reminderError = result.message || 'Could not update the reminder.';
      return;
    }
    this.reminderMessage = enabled
      ? `${reminder.label} set for ${this.formatTime(time)}.`
      : `${reminder.label} turned off.`;
  }

  async sendTestReminder(): Promise<void> {
    this.clearMessages();
    try {
      const result = await this.reminderService.sendTest();
      if (result.success) this.reminderMessage = result.message;
      else this.reminderError = result.message;
    } catch {
      this.reminderError =
        'Could not schedule a test notification on this device.';
    }
  }

  async addCustomReminder(): Promise<void> {
    this.clearMessages();
    if (this.customReminderForm.invalid) {
      this.customReminderForm.markAllAsTouched();
      this.reminderError =
        'Enter a reminder name and choose a valid time.';
      return;
    }
    const value = this.customReminderForm.getRawValue();
    const result = await this.reminderService.addCustomReminder(
      value.label,
      value.time
    );
    if (!result.success) {
      this.reminderError = result.message || 'Could not add the reminder.';
      return;
    }
    this.reminderMessage =
      `${value.label.trim()} set for ${this.formatTime(value.time)}.`;
    this.customReminderForm.reset({ label: '', time: '12:00' });
    this.isAddingCustomReminder = false;
  }

  async updateCustomReminder(
    reminder: CustomReminder,
    enabled: boolean,
    time = reminder.time
  ): Promise<void> {
    this.clearMessages();
    this.reminderSavingType = reminder.id;
    const result = await this.reminderService.updateCustomReminder(
      reminder.id,
      { enabled, time }
    );
    this.reminderSavingType = '';
    if (!result.success) {
      this.reminderError = result.message || 'Could not update the reminder.';
      return;
    }
    this.reminderMessage = enabled
      ? `${reminder.label} set for ${this.formatTime(time)}.`
      : `${reminder.label} turned off.`;
  }

  async deleteCustomReminder(reminder: CustomReminder): Promise<void> {
    await this.reminderService.deleteCustomReminder(reminder.id);
    this.reminderMessage = `${reminder.label} removed.`;
    this.reminderError = '';
  }

  private clearMessages(): void {
    this.reminderMessage = '';
    this.reminderError = '';
  }

  private formatTime(value: string): string {
    const [hourText, minute] = value.split(':');
    const hour = Number(hourText);
    return `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`;
  }
}
