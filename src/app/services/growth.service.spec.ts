import { TestBed } from '@angular/core/testing';
import { GrowthService } from './growth.service';

describe('GrowthService', () => {
  let service: GrowthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(GrowthService);
  });

  it('saves one weight per day', () => {
    service.saveDailyWeight('2026-07-27', 6.25);
    service.saveDailyWeight('2026-07-27', 6.3);

    expect(service.entries.length).toBe(1);
    expect(service.entries[0].weightKg).toBe(6.3);
  });

  it('sorts entries chronologically', () => {
    service.saveDailyWeight('2026-07-28', 6.4);
    service.saveDailyWeight('2026-07-26', 6.2);

    expect(service.entries.map(entry => entry.date))
      .toEqual(['2026-07-26', '2026-07-28']);
  });

  it('deletes a weight entry', () => {
    service.saveDailyWeight('2026-07-27', 6.25);
    service.delete(service.entries[0].id);

    expect(service.entries).toEqual([]);
  });

  it('rejects invalid calendar dates', () => {
    const wasSaved =
      service.saveDailyWeight('2026-02-31', 6.25);

    expect(wasSaved).toBeFalse();
    expect(service.entries).toEqual([]);
  });

  it('rejects weights outside the supported range', () => {
    expect(
      service.saveDailyWeight('2026-07-27', 0.2)
    ).toBeFalse();
    expect(
      service.saveDailyWeight('2026-07-27', 41)
    ).toBeFalse();
    expect(service.entries).toEqual([]);
  });
});
