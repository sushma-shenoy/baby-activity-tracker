import { TestBed } from '@angular/core/testing';
import { MedicineService } from './medicine.service';

describe('MedicineService', () => {
  let service: MedicineService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(MedicineService);
  });

  it('saves a medicine entry', () => {
    const wasSaved = service.save({
      id: 'medicine-1',
      name: 'Vitamin D',
      dose: '1 mL',
      givenAt: Date.now(),
      notes: ''
    });

    expect(wasSaved).toBeTrue();
    expect(service.entries.length).toBe(1);
  });

  it('updates an existing entry', () => {
    const givenAt = Date.now();
    service.save({
      id: 'medicine-1',
      name: 'Vitamin D',
      dose: '1 mL',
      givenAt,
      notes: ''
    });
    service.save({
      id: 'medicine-1',
      name: 'Vitamin D',
      dose: '1.5 mL',
      givenAt,
      notes: 'Updated'
    });

    expect(service.entries.length).toBe(1);
    expect(service.entries[0].dose).toBe('1.5 mL');
  });

  it('rejects future medicine entries', () => {
    const wasSaved = service.save({
      id: 'medicine-1',
      name: 'Vitamin D',
      dose: '1 mL',
      givenAt: Date.now() + 3_600_000,
      notes: ''
    });

    expect(wasSaved).toBeFalse();
    expect(service.entries).toEqual([]);
  });
});
