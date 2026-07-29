import {
  Component,
  OnDestroy
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  AlertController,
  IonicModule
} from '@ionic/angular';
import { Subscription } from 'rxjs';
import {
  VaccinationEntry,
  VaccinationService
} from '../../services/vaccination.service';

@Component({
  selector: 'app-vaccination',
  templateUrl: './vaccination.page.html',
  styleUrls: ['./vaccination.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule
  ]
})
export class VaccinationPage implements OnDestroy {
  entries: VaccinationEntry[] = [];
  editingId = '';
  errorMessage = '';
  successMessage = '';
  readonly todayDate = this.toDateValue(new Date());

  readonly vaccinationForm =
    this.formBuilder.nonNullable.group({
      vaccineName: [
        '',
        [
          Validators.required,
          Validators.maxLength(80)
        ]
      ],
      administeredDate: [
        this.todayDate,
        Validators.required
      ],
      provider: [
        '',
        Validators.maxLength(80)
      ],
      nextDueDate: [''],
      notes: [
        '',
        Validators.maxLength(240)
      ]
    });

  private entriesSubscription?: Subscription;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly vaccinationService:
      VaccinationService,
    private readonly alertController: AlertController
  ) {
    this.entriesSubscription =
      this.vaccinationService.entries$.subscribe(
        entries => {
          this.entries = entries;
        }
      );
  }

  ngOnDestroy(): void {
    this.entriesSubscription?.unsubscribe();
  }

  get isEditing(): boolean {
    return Boolean(this.editingId);
  }

  get upcomingEntries(): VaccinationEntry[] {
    return this.entries
      .filter(entry =>
        entry.nextDueDate &&
        entry.nextDueDate >= this.todayDate
      )
      .sort((first, second) =>
        first.nextDueDate.localeCompare(
          second.nextDueDate
        )
      );
  }

  saveVaccination(): void {
    this.clearMessages();

    if (this.vaccinationForm.invalid) {
      this.vaccinationForm.markAllAsTouched();
      this.errorMessage =
        'Enter the vaccine name and administered date.';
      return;
    }

    const value =
      this.vaccinationForm.getRawValue();

    if (value.administeredDate > this.todayDate) {
      this.errorMessage =
        'The administered date cannot be in the future.';
      return;
    }

    if (
      value.nextDueDate &&
      value.nextDueDate < value.administeredDate
    ) {
      this.errorMessage =
        'The next due date cannot be before the administered date.';
      return;
    }

    const wasSaved =
      this.vaccinationService.save({
        id:
          this.editingId ||
          `vaccination-${Date.now()}`,
        vaccineName: value.vaccineName,
        administeredDate: value.administeredDate,
        provider: value.provider,
        nextDueDate: value.nextDueDate,
        notes: value.notes
      });

    if (!wasSaved) {
      this.errorMessage =
        'The vaccination record could not be saved. Check each field.';
      return;
    }

    this.successMessage =
      this.isEditing
        ? 'Vaccination record updated.'
        : 'Vaccination record saved.';
    this.resetForm(false);
  }

  editEntry(entry: VaccinationEntry): void {
    this.editingId = entry.id;
    this.clearMessages();
    this.vaccinationForm.setValue({
      vaccineName: entry.vaccineName,
      administeredDate: entry.administeredDate,
      provider: entry.provider,
      nextDueDate: entry.nextDueDate,
      notes: entry.notes
    });
  }

  cancelEdit(): void {
    this.resetForm();
  }

  async confirmDelete(
    entry: VaccinationEntry
  ): Promise<void> {
    const alert =
      await this.alertController.create({
        header: 'Delete vaccination record?',
        message:
          `${entry.vaccineName} from ` +
          `${this.formatDate(entry.administeredDate)} will be removed.`,
        cssClass: 'activity-delete-alert',
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel'
          },
          {
            text: 'Delete',
            role: 'destructive',
            handler: () => {
              this.vaccinationService.delete(entry.id);

              if (this.editingId === entry.id) {
                this.resetForm();
              }
            }
          }
        ]
      });

    await alert.present();
  }

  formatDate(value: string): string {
    return new Date(`${value}T00:00:00`)
      .toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
  }

  trackByEntryId(
    _index: number,
    entry: VaccinationEntry
  ): string {
    return entry.id;
  }

  private resetForm(
    clearMessages = true
  ): void {
    this.editingId = '';

    if (clearMessages) {
      this.clearMessages();
    }

    this.vaccinationForm.reset({
      vaccineName: '',
      administeredDate: this.todayDate,
      provider: '',
      nextDueDate: '',
      notes: ''
    });
  }

  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  private toDateValue(date: Date): string {
    return (
      `${date.getFullYear()}-` +
      `${String(date.getMonth() + 1).padStart(2, '0')}-` +
      `${String(date.getDate()).padStart(2, '0')}`
    );
  }
}
