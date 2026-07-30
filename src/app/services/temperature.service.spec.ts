import { TestBed } from '@angular/core/testing';
import { TemperatureService } from './temperature.service';

describe('TemperatureService', () => {
  let service: TemperatureService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(TemperatureService);
  });

  it('saves and rounds a valid reading', () => {
    expect(service.save({
      id: 'temp-1',
      celsius: 37.04,
      measuredAt: Date.now(),
      method: 'axillary',
      notes: ''
    })).toBeTrue();
    expect(service.entries[0].celsius).toBe(37);
  });

  it('rejects readings outside the supported range', () => {
    expect(service.save({
      id: 'temp-1',
      celsius: 46,
      measuredAt: Date.now(),
      method: 'forehead',
      notes: ''
    })).toBeFalse();
  });

  it('persists the preferred unit and converts values', () => {
    service.setUnit('fahrenheit');
    expect(service.unit).toBe('fahrenheit');
    expect(service.toDisplay(37)).toBeCloseTo(98.6, 1);
    expect(service.toCelsius(98.6)).toBeCloseTo(37, 1);
  });

  it('ignores malformed stored readings', () => {
    localStorage.setItem(
      'baby_temperature_entries',
      JSON.stringify([{ id: 'bad', celsius: 99 }])
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(TemperatureService);

    expect(service.entries).toEqual([]);
  });
});
