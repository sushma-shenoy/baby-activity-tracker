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
  MedicineEntry,
  MedicineService
} from '../../services/medicine.service';
import {
  notFutureDateTimeValidator,
  trimmedRequiredValidator,
  validDateTimeValidator
} from '../../shared/form-validators';
import { PendingChangesPanelComponent } from '../../shared/pending-changes-panel/pending-changes-panel.component';

@Component({
  selector: 'app-medicine',
  templateUrl: './medicine.page.html',
  styleUrls: ['./medicine.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    PendingChangesPanelComponent
  ]
})
export class MedicinePage implements OnDestroy {
  entries: MedicineEntry[] = [];
  editingId = '';
  errorMessage = '';
  successMessage = '';
  readonly maximumDateTime =
    this.toDateTimeLocal(new Date());

  readonly medicineForm =
    this.formBuilder.nonNullable.group({
      name: [
        '',
        [
          Validators.required,
          trimmedRequiredValidator(),
          Validators.maxLength(60)
        ]
      ],
      dose: [
        '',
        [
          Validators.required,
          trimmedRequiredValidator(),
          Validators.maxLength(30)
        ]
      ],
      givenAt: [
        this.maximumDateTime,
        [
          Validators.required,
          validDateTimeValidator(),
          notFutureDateTimeValidator()
        ]
      ],
      notes: [
        '',
        Validators.maxLength(240)
      ]
    });

  private entriesSubscription?: Subscription;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly medicineService: MedicineService,
    private readonly alertController: AlertController
  ) {
    this.entriesSubscription =
      this.medicineService.entries$.subscribe(
        entries => {
          this.entries = entries;
        }
      );
  }

  ngOnDestroy(): void {
    this.entriesSubscription?.unsubscribe();
  }

  fieldError(
    field: 'name' | 'dose' | 'givenAt' | 'notes'
  ): string {
    const control = this.medicineForm.controls[field];
    if (!control.touched || !control.errors) return '';
    if (control.hasError('required')) {
      return field === 'name'
        ? 'Enter the medicine name.'
        : field === 'dose'
          ? 'Enter the dose given.'
          : 'Choose when the medicine was given.';
    }
    if (control.hasError('maxlength')) {
      const limit = field === 'name' ? 60 : field === 'dose' ? 30 : 240;
      return `Use ${limit} characters or fewer.`;
    }
    if (control.hasError('invalidDateTime')) {
      return 'Enter a valid date and time.';
    }
    if (control.hasError('futureDateTime')) {
      return 'The medicine time cannot be in the future.';
    }
    return 'Check this field.';
  }

  get isEditing(): boolean {
    return Boolean(this.editingId);
  }

  saveMedicine(): void {
    this.clearMessages();

    if (this.medicineForm.invalid) {
      this.medicineForm.markAllAsTouched();
      this.errorMessage =
        'Enter the medicine name, dose, and time it was given.';
      return;
    }

    const formValue =
      this.medicineForm.getRawValue();
    const givenAt =
      new Date(formValue.givenAt).getTime();

    if (
      !Number.isFinite(givenAt) ||
      givenAt > Date.now() + 60_000
    ) {
      this.errorMessage =
        'The time given must be a valid time and cannot be in the future.';
      return;
    }

    const wasSaved = this.medicineService.save({
      id:
        this.editingId ||
        `medicine-${Date.now()}`,
      name: formValue.name,
      dose: formValue.dose,
      givenAt,
      notes: formValue.notes
    });

    if (!wasSaved) {
      this.errorMessage =
        'The medicine entry could not be saved. Check each field.';
      return;
    }

    this.successMessage =
      this.isEditing
        ? 'Medicine entry updated.'
        : 'Medicine entry saved.';
    this.resetForm(false);
  }

  editEntry(entry: MedicineEntry): void {
    this.editingId = entry.id;
    this.clearMessages();
    this.medicineForm.setValue({
      name: entry.name,
      dose: entry.dose,
      givenAt:
        this.toDateTimeLocal(
          new Date(entry.givenAt)
        ),
      notes: entry.notes
    });
  }

  cancelEdit(): void {
    this.resetForm();
  }

  async confirmDelete(
    entry: MedicineEntry
  ): Promise<void> {
    const alert =
      await this.alertController.create({
        header: 'Delete medicine entry?',
        message:
          `${entry.name} (${entry.dose}) will be permanently removed.`,
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
              this.medicineService.delete(entry.id);

              if (this.editingId === entry.id) {
                this.resetForm();
              }
            }
          }
        ]
      });

    await alert.present();
  }

  formatDateTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  trackByEntryId(
    _index: number,
    entry: MedicineEntry
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

    this.medicineForm.reset({
      name: '',
      dose: '',
      givenAt: this.toDateTimeLocal(new Date()),
      notes: ''
    });
  }

  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  private toDateTimeLocal(date: Date): string {
    const localDate =
      new Date(
        date.getTime() -
        date.getTimezoneOffset() * 60_000
      );

    return localDate
      .toISOString()
      .slice(0, 16);
  }
}
