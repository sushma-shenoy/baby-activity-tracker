import {
  ComponentFixture,
  TestBed
} from '@angular/core/testing';
import { AlertController } from '@ionic/angular';
import { BehaviorSubject } from 'rxjs';
import {
  GrowthService,
  WeightEntry
} from '../../services/growth.service';
import {
  PreferencesService
} from '../../services/preferences.service';
import { GrowthPage } from './growth.page';

describe('GrowthPage', () => {
  let component: GrowthPage;
  let fixture: ComponentFixture<GrowthPage>;
  let growthService:
    jasmine.SpyObj<GrowthService>;
  let entriesSubject:
    BehaviorSubject<WeightEntry[]>;

  beforeEach(async () => {
    entriesSubject =
      new BehaviorSubject<WeightEntry[]>([]);

    growthService =
      jasmine.createSpyObj<GrowthService>(
        'GrowthService',
        ['saveDailyWeight', 'delete'],
        {
          entries$: entriesSubject.asObservable()
        }
      );
    growthService.saveDailyWeight
      .and.returnValue(true);

    const preferencesService = {
      preferences: {
        baby: {
          name: 'Mia',
          birthDate: '2026-01-01',
          mood: 'Happy 😊'
        },
        goals: {
          feeds: 8,
          sleepSessions: 5,
          diapers: 7
        }
      }
    };

    const alertController =
      jasmine.createSpyObj<AlertController>(
        'AlertController',
        ['create']
      );

    await TestBed.configureTestingModule({
      imports: [GrowthPage],
      providers: [
        {
          provide: GrowthService,
          useValue: growthService
        },
        {
          provide: PreferencesService,
          useValue: preferencesService
        },
        {
          provide: AlertController,
          useValue: alertController
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GrowthPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    entriesSubject.complete();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('rejects a date before the baby was born', () => {
    component.weightForm.setValue({
      date: '2025-12-31',
      weightKg: 6.25
    });

    expect(
      component.weightForm.controls.date
        .hasError('beforeBirth')
    ).toBeTrue();
  });

  it('rejects a future date', () => {
    component.weightForm.setValue({
      date: '2999-01-01',
      weightKg: 6.25
    });

    expect(
      component.weightForm.controls.date
        .hasError('futureDate')
    ).toBeTrue();
  });

  it('rejects weight with more than two decimals', () => {
    component.weightForm.setValue({
      date: component.todayDate,
      weightKg: 6.125
    });

    expect(
      component.weightForm.controls.weightKg
        .hasError('weightPrecision')
    ).toBeTrue();
  });

  it('accepts a weight with one decimal place', () => {
    component.weightForm.setValue({
      date: component.todayDate,
      weightKg: 8.7
    });

    expect(
      component.weightForm.controls.weightKg
        .hasError('weightPrecision')
    ).toBeFalse();
  });

  it('saves a valid daily weight', () => {
    component.weightForm.setValue({
      date: component.todayDate,
      weightKg: 6.25
    });

    component.saveWeight();

    expect(
      growthService.saveDailyWeight
    ).toHaveBeenCalledWith(
      component.todayDate,
      6.25
    );
    expect(component.savedMessage)
      .toContain('Daily weight saved');
  });

  it('shows a service-level save failure', () => {
    growthService.saveDailyWeight
      .and.returnValue(false);
    component.weightForm.setValue({
      date: component.todayDate,
      weightKg: 6.25
    });

    component.saveWeight();

    expect(component.errorMessage)
      .toContain('could not be saved');
  });
});
