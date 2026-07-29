import { TestBed } from '@angular/core/testing';
import {
  VaccinationService
} from './vaccination.service';

describe('VaccinationService', () => {
  let service: VaccinationService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(VaccinationService);
  });

  it('saves a vaccination record', () => {
    const saved = service.save({
      id: 'vaccine-1',
      vaccineName: 'Recorded vaccine',
      administeredDate: '2026-07-28',
      provider: 'Clinic',
      nextDueDate: '',
      notes: ''
    });

    expect(saved).toBeTrue();
    expect(service.entries.length).toBe(1);
  });

  it('rejects a next due date before administration', () => {
    const saved = service.save({
      id: 'vaccine-1',
      vaccineName: 'Recorded vaccine',
      administeredDate: '2026-07-28',
      provider: '',
      nextDueDate: '2026-07-27',
      notes: ''
    });

    expect(saved).toBeFalse();
  });

  it('updates an existing record', () => {
    service.save({
      id: 'vaccine-1',
      vaccineName: 'Recorded vaccine',
      administeredDate: '2026-07-28',
      provider: '',
      nextDueDate: '',
      notes: ''
    });
    service.save({
      id: 'vaccine-1',
      vaccineName: 'Updated record',
      administeredDate: '2026-07-28',
      provider: '',
      nextDueDate: '',
      notes: ''
    });

    expect(service.entries.length).toBe(1);
    expect(service.entries[0].vaccineName)
      .toBe('Updated record');
  });
});
