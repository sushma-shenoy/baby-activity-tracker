import {
  ComponentFixture,
  TestBed
} from '@angular/core/testing';
import { AlertController } from '@ionic/angular';
import { BehaviorSubject } from 'rxjs';
import {
  MedicineEntry,
  MedicineService
} from '../../services/medicine.service';
import { MedicinePage } from './medicine.page';

describe('MedicinePage', () => {
  let component: MedicinePage;
  let fixture: ComponentFixture<MedicinePage>;
  let medicineService:
    jasmine.SpyObj<MedicineService>;
  let entriesSubject:
    BehaviorSubject<MedicineEntry[]>;

  beforeEach(async () => {
    entriesSubject =
      new BehaviorSubject<MedicineEntry[]>([]);
    medicineService =
      jasmine.createSpyObj<MedicineService>(
        'MedicineService',
        ['save', 'delete'],
        {
          entries$: entriesSubject.asObservable()
        }
      );
    medicineService.save.and.returnValue(true);

    await TestBed.configureTestingModule({
      imports: [MedicinePage],
      providers: [
        {
          provide: MedicineService,
          useValue: medicineService
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

    fixture = TestBed.createComponent(MedicinePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    entriesSubject.complete();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not save an incomplete entry', () => {
    component.saveMedicine();

    expect(medicineService.save)
      .not.toHaveBeenCalled();
    expect(component.errorMessage)
      .toContain('medicine name');
  });

  it('saves a complete medicine entry', () => {
    component.medicineForm.patchValue({
      name: 'Vitamin D',
      dose: '1 mL',
      givenAt: component.maximumDateTime
    });

    component.saveMedicine();

    expect(medicineService.save)
      .toHaveBeenCalled();
    expect(component.successMessage)
      .toBe('Medicine entry saved.');
  });
});
