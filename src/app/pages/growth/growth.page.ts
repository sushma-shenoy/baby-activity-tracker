import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  AlertController,
  IonicModule
} from '@ionic/angular';
import {
  Chart,
  ChartConfiguration,
  registerables
} from 'chart.js';
import { Subscription } from 'rxjs';
import {
  GrowthService,
  WeightEntry
} from '../../services/growth.service';
import {
  PreferencesService
} from '../../services/preferences.service';

Chart.register(...registerables);

@Component({
  selector: 'app-growth',
  templateUrl: './growth.page.html',
  styleUrls: ['./growth.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule
  ]
})
export class GrowthPage
  implements AfterViewInit, OnDestroy {
  @ViewChild('weightChart')
  private chartCanvas?: ElementRef<HTMLCanvasElement>;

  entries: WeightEntry[] = [];
  savedMessage = '';
  errorMessage = '';
  readonly todayDate =
    this.toDateInputValue(new Date());

  readonly weightForm =
    this.formBuilder.nonNullable.group({
      date: [
        this.todayDate,
        [
          Validators.required,
          this.validDateValidator(),
          this.notFutureDateValidator(),
          this.notBeforeBirthDateValidator()
        ]
      ],
      weightKg: [
        null as number | null,
        [
          Validators.required,
          Validators.min(0.5),
          Validators.max(40),
          this.weightPrecisionValidator()
        ]
      ]
    });

  private chart?: Chart<'line'>;
  private entriesSubscription?: Subscription;
  private viewReady = false;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly growthService: GrowthService,
    private readonly preferencesService: PreferencesService,
    private readonly alertController: AlertController
  ) {
    this.entriesSubscription =
      this.growthService.entries$.subscribe(entries => {
        this.entries = [...entries].reverse();

        if (this.viewReady) {
          this.renderChart();
        }
      });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderChart();
  }

  ngOnDestroy(): void {
    this.entriesSubscription?.unsubscribe();
    this.chart?.destroy();
  }

  get latestEntry(): WeightEntry | undefined {
    return this.entries[0];
  }

  get minimumDate(): string | null {
    return (
      this.preferencesService.preferences.baby.birthDate ||
      null
    );
  }

  get dateError(): string {
    const control = this.weightForm.controls.date;

    if (!control.touched || !control.errors) {
      return '';
    }

    if (control.hasError('required')) {
      return 'Choose a measurement date.';
    }

    if (control.hasError('invalidDate')) {
      return 'Enter a valid calendar date.';
    }

    if (control.hasError('futureDate')) {
      return 'Weight checks cannot be dated in the future.';
    }

    if (control.hasError('beforeBirth')) {
      return 'The measurement date cannot be before the baby’s birth date.';
    }

    return 'Check the measurement date.';
  }

  get weightError(): string {
    const control = this.weightForm.controls.weightKg;

    if (!control.touched || !control.errors) {
      return '';
    }

    if (control.hasError('required')) {
      return 'Enter the baby’s weight.';
    }

    if (
      control.hasError('min') ||
      control.hasError('max')
    ) {
      return 'Weight must be between 0.5 and 40 kg.';
    }

    if (control.hasError('weightPrecision')) {
      return 'Use no more than two decimal places.';
    }

    return 'Enter a valid weight.';
  }

  get weightChange(): number | null {
    if (this.entries.length < 2) {
      return null;
    }

    return Math.round(
      (
        this.entries[0].weightKg -
        this.entries[1].weightKg
      ) * 100
    ) / 100;
  }

  saveWeight(): void {
    this.savedMessage = '';
    this.errorMessage = '';

    if (this.weightForm.invalid) {
      this.weightForm.markAllAsTouched();
      this.errorMessage =
        'Enter a date and a weight between 0.5 and 40 kg.';
      return;
    }

    const { date, weightKg } =
      this.weightForm.getRawValue();

    const wasSaved =
      this.growthService.saveDailyWeight(
      date,
      Number(weightKg)
    );

    if (!wasSaved) {
      this.errorMessage =
        'This measurement could not be saved. Check the date and weight.';
      return;
    }

    this.savedMessage =
      'Daily weight saved. Existing entries for this date are updated.';
  }

  editEntry(entry: WeightEntry): void {
    this.weightForm.setValue({
      date: entry.date,
      weightKg: entry.weightKg
    });
    this.savedMessage = '';
    this.errorMessage = '';
  }

  async confirmDeleteEntry(
    entry: WeightEntry
  ): Promise<void> {
    const alert =
      await this.alertController.create({
        header: 'Delete weight check?',
        message:
          `${entry.weightKg.toFixed(2)} kg recorded on ` +
          `${this.formatDate(entry.date)} will be permanently removed.`,
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
              this.growthService.delete(entry.id);
              this.savedMessage = '';
              this.errorMessage = '';
            }
          }
        ]
      });

    await alert.present();
  }

  formatDate(date: string): string {
    return new Date(`${date}T00:00:00`)
      .toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
  }

  trackByEntryId(
    _index: number,
    entry: WeightEntry
  ): string {
    return entry.id;
  }

  private renderChart(): void {
    if (!this.chartCanvas) {
      return;
    }

    const chronological =
      [...this.entries].reverse();

    this.chart?.destroy();

    const configuration:
      ChartConfiguration<'line'> = {
        type: 'line',
        data: {
          labels: chronological.map(entry =>
            new Date(`${entry.date}T00:00:00`)
              .toLocaleDateString([], {
                month: 'short',
                day: 'numeric'
              })
          ),
          datasets: [
            {
              label: 'Weight',
              data: chronological.map(
                entry => entry.weightKg
              ),
              borderColor: '#7566a8',
              backgroundColor:
                'rgba(117, 102, 168, 0.12)',
              pointBackgroundColor: '#7566a8',
              pointBorderColor: '#ffffff',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6,
              borderWidth: 3,
              fill: true,
              tension: 0.35
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            intersect: false,
            mode: 'index'
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: context =>
                  context.parsed.y === null
                    ? 'No weight'
                    : `${context.parsed.y.toFixed(2)} kg`
              }
            }
          },
          scales: {
            x: {
              grid: {
                display: false
              },
              ticks: {
                color: '#858196',
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 6
              }
            },
            y: {
              beginAtZero: false,
              grace: '12%',
              grid: {
                color: 'rgba(62, 57, 83, 0.08)'
              },
              ticks: {
                color: '#858196',
                callback: value => `${value} kg`
              }
            }
          }
        }
      };

    this.chart = new Chart(
      this.chartCanvas.nativeElement,
      configuration
    );
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(
      date.getMonth() + 1
    ).padStart(2, '0');
    const day = String(
      date.getDate()
    ).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private validDateValidator(): ValidatorFn {
    return (
      control: AbstractControl<string>
    ): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      const date =
        new Date(`${control.value}T00:00:00`);

      return Number.isNaN(date.getTime())
        ? { invalidDate: true }
        : null;
    };
  }

  private notFutureDateValidator(): ValidatorFn {
    return (
      control: AbstractControl<string>
    ): ValidationErrors | null => {
      if (
        !control.value ||
        control.value <= this.todayDate
      ) {
        return null;
      }

      return { futureDate: true };
    };
  }

  private notBeforeBirthDateValidator(): ValidatorFn {
    return (
      control: AbstractControl<string>
    ): ValidationErrors | null => {
      const birthDate =
        this.preferencesService.preferences.baby.birthDate;

      if (
        !birthDate ||
        !control.value ||
        control.value >= birthDate
      ) {
        return null;
      }

      return { beforeBirth: true };
    };
  }

  private weightPrecisionValidator(): ValidatorFn {
    return (
      control: AbstractControl<number | null>
    ): ValidationErrors | null => {
      if (
        control.value === null ||
        control.value === undefined
      ) {
        return null;
      }

      const numericValue = Number(control.value);

      if (!Number.isFinite(numericValue)) {
        return { weightPrecision: true };
      }

      const roundedToTwoDecimals =
        Math.round(numericValue * 100) / 100;

      return Math.abs(
        numericValue - roundedToTwoDecimals
      ) > 1e-9
        ? { weightPrecision: true }
        : null;
    };
  }
}
