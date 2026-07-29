import {
  ComponentFixture,
  TestBed
} from '@angular/core/testing';
import { AlertController } from '@ionic/angular';
import { BehaviorSubject } from 'rxjs';
import {
  VaccinationEntry,
  VaccinationService
} from '../../services/vaccination.service';
import {
  VaccinationPage
} from './vaccination.page';

describe('VaccinationPage', () => {
  let component: VaccinationPage;
  let fixture: ComponentFixture<VaccinationPage>;
  let vaccinationService:
    jasmine.SpyObj<VaccinationService>;
  let entriesSubject:
    BehaviorSubject<VaccinationEntry[]>;

  beforeEach(async () => {
    entriesSubject =
      new BehaviorSubject<VaccinationEntry[]>([]);
    vaccinationService =
      jasmine.createSpyObj<VaccinationService>(
        'VaccinationService',
        ['save', 'delete'],
        {
          entries$: entriesSubject.asObservable()
        }
      );
    vaccinationService.save.and.returnValue(true);

    await TestBed.configureTestingModule({
      imports: [VaccinationPage],
      providers: [
        {
          provide: VaccinationService,
          useValue: vaccinationService
        },
        {
          provide: AlertController,
          useValue:
            jasmine.createSpyObj<AlertController>(
              'AlertController',
              ['create']
            )
        }
      ]
    }).compileComponents();

    fixture =
      TestBed.createComponent(VaccinationPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    entriesSubject.complete();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('requires a vaccine name', () => {
    component.saveVaccination();

    expect(vaccinationService.save)
      .not.toHaveBeenCalled();
  });

  it('rejects a future administered date', () => {
    component.vaccinationForm.patchValue({
      vaccineName: 'Recorded vaccine',
      administeredDate: '2999-01-01'
    });

    component.saveVaccination();

    expect(component.errorMessage)
      .toContain('cannot be in the future');
  });

  it('saves a complete vaccination record', () => {
    component.vaccinationForm.patchValue({
      vaccineName: 'Recorded vaccine'
    });

    component.saveVaccination();

    expect(vaccinationService.save)
      .toHaveBeenCalled();
    expect(component.successMessage)
      .toBe('Vaccination record saved.');
  });
});
