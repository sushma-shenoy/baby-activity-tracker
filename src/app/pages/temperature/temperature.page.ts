import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild
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
import {
  Chart,
  ChartConfiguration,
  registerables
} from 'chart.js';
import { Subscription } from 'rxjs';
import {
  TemperatureEntry,
  TemperatureMethod,
  TemperatureService,
  TemperatureUnit
} from '../../services/temperature.service';
import {
  notFutureDateTimeValidator,
  validDateTimeValidator
} from '../../shared/form-validators';

Chart.register(...registerables);

@Component({
  selector: 'app-temperature',
  templateUrl: './temperature.page.html',
  styleUrls: ['./temperature.page.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IonicModule]
})
export class TemperaturePage
  implements AfterViewInit, OnDestroy {
  @ViewChild('temperatureChart')
  private chartCanvas?: ElementRef<HTMLCanvasElement>;

  entries: TemperatureEntry[] = [];
  editingId = '';
  errorMessage = '';
  successMessage = '';
  readonly maximumDateTime = this.toLocalDateTime(new Date());
  unit: TemperatureUnit = this.service.unit;

  readonly form = this.formBuilder.nonNullable.group({
    celsius: [
      null as number | null,
      [
        Validators.required,
        Validators.min(30),
        Validators.max(45)
      ]
    ],
    measuredAt: [
      this.maximumDateTime,
      [
        Validators.required,
        validDateTimeValidator(),
        notFutureDateTimeValidator()
      ]
    ],
    method: [
      'axillary' as TemperatureMethod,
      Validators.required
    ],
    notes: ['', Validators.maxLength(240)]
  });

  private subscription?: Subscription;
  private unitSubscription?: Subscription;
  private chart?: Chart<'line'>;
  private viewReady = false;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly service: TemperatureService,
    private readonly alertController: AlertController
  ) {
    this.subscription = this.service.entries$.subscribe(
      entries => {
        this.entries = entries;
        if (this.viewReady) {
          this.renderChart();
        }
      }
    );
    this.unitSubscription = this.service.unit$.subscribe(unit => {
      this.unit = unit;
      if (this.viewReady) this.renderChart();
    });
  }

  fieldError(
    field: 'celsius' | 'measuredAt' | 'method' | 'notes'
  ): string {
    const control = this.form.controls[field];
    if (!control.touched || !control.errors) return '';
    if (control.hasError('required')) {
      if (field === 'celsius') return 'Enter the temperature.';
      if (field === 'measuredAt') return 'Choose when it was measured.';
      return 'Choose a measurement method.';
    }
    if (control.hasError('min') || control.hasError('max')) {
      return `Temperature must be between ${this.inputMinimum} and ${this.inputMaximum} ${this.unitSymbol}.`;
    }
    if (control.hasError('invalidDateTime')) return 'Enter a valid date and time.';
    if (control.hasError('futureDateTime')) {
      return 'The measurement time cannot be in the future.';
    }
    if (control.hasError('maxlength')) return 'Use 240 characters or fewer.';
    return 'Check this field.';
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderChart();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.unitSubscription?.unsubscribe();
    this.chart?.destroy();
  }

  get latest(): TemperatureEntry | undefined {
    return this.entries[0];
  }

  get unitSymbol(): string {
    return this.unit === 'fahrenheit' ? '°F' : '°C';
  }

  get inputMinimum(): number {
    return this.unit === 'fahrenheit' ? 86 : 30;
  }

  get inputMaximum(): number {
    return this.unit === 'fahrenheit' ? 113 : 45;
  }

  setUnit(unit: TemperatureUnit): void {
    if (unit === this.unit) return;
    const current = Number(this.form.controls.celsius.value);
    if (Number.isFinite(current) && this.form.controls.celsius.value !== null) {
      const celsius = this.service.toCelsius(current, this.unit);
      this.form.controls.celsius.setValue(
        Math.round(this.service.toDisplay(celsius, unit) * 10) / 10
      );
    }
    this.service.setUnit(unit);
    this.form.controls.celsius.setValidators([
      Validators.required,
      Validators.min(this.inputMinimum),
      Validators.max(this.inputMaximum)
    ]);
    this.form.controls.celsius.updateValueAndValidity();
  }

  displayTemperature(celsius: number): string {
    return `${this.service.toDisplay(celsius).toFixed(1)} ${this.unitSymbol}`;
  }

  save(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage =
        `Enter a temperature from ${this.inputMinimum}–${this.inputMaximum} ` +
        `${this.unitSymbol} and when it was measured.`;
      return;
    }

    const value = this.form.getRawValue();
    const measuredAt = new Date(value.measuredAt).getTime();
    const saved = this.service.save({
      id: this.editingId || `temperature-${Date.now()}`,
      celsius: this.service.toCelsius(Number(value.celsius)),
      measuredAt,
      method: value.method,
      notes: value.notes
    });

    if (!saved) {
      this.errorMessage =
        'The temperature could not be saved. Check the value and time.';
      return;
    }

    this.successMessage =
      this.editingId ? 'Temperature updated.' : 'Temperature saved.';
    this.reset(false);
  }

  edit(entry: TemperatureEntry): void {
    this.editingId = entry.id;
    this.form.setValue({
      celsius:
        Math.round(this.service.toDisplay(entry.celsius) * 10) / 10,
      measuredAt:
        this.toLocalDateTime(new Date(entry.measuredAt)),
      method: entry.method,
      notes: entry.notes
    });
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelEdit(): void {
    this.reset();
  }

  async confirmDelete(
    entry: TemperatureEntry
  ): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Delete temperature check?',
      message:
        `${this.displayTemperature(entry.celsius)} from ` +
        `${this.formatDate(entry.measuredAt)} will be removed.`,
      cssClass: 'activity-delete-alert',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => this.service.delete(entry.id)
        }
      ]
    });
    await alert.present();
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  methodLabel(method: TemperatureMethod): string {
    const labels: Record<TemperatureMethod, string> = {
      axillary: 'Underarm',
      oral: 'Oral',
      rectal: 'Rectal',
      ear: 'Ear',
      forehead: 'Forehead'
    };
    return labels[method];
  }

  private reset(clear = true): void {
    this.editingId = '';
    if (clear) {
      this.errorMessage = '';
      this.successMessage = '';
    }
    this.form.reset({
      celsius: null,
      measuredAt: this.toLocalDateTime(new Date()),
      method: 'axillary',
      notes: ''
    });
  }

  private renderChart(): void {
    if (!this.chartCanvas) {
      return;
    }

    const chronological = [...this.entries].reverse();
    this.chart?.destroy();
    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels: chronological.map(entry =>
          new Date(entry.measuredAt).toLocaleDateString([], {
            month: 'short',
            day: 'numeric'
          })
        ),
        datasets: [{
          data: chronological.map(entry =>
            this.service.toDisplay(entry.celsius)
          ),
          label: 'Temperature',
          borderColor: '#d56d73',
          backgroundColor: 'rgba(213, 109, 115, 0.1)',
          pointBackgroundColor: '#d56d73',
          borderWidth: 3,
          pointRadius: 4,
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: context =>
                context.parsed.y === null
                  ? 'No reading'
                  : `${context.parsed.y.toFixed(1)} ${this.unitSymbol}`
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: false,
            grace: '10%',
            ticks: {
              callback: value => `${value}°`
            }
          }
        }
      }
    };
    this.chart = new Chart(
      this.chartCanvas.nativeElement,
      config
    );
  }

  private toLocalDateTime(date: Date): string {
    return new Date(
      date.getTime() - date.getTimezoneOffset() * 60_000
    ).toISOString().slice(0, 16);
  }
}
