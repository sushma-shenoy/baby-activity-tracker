import { TestBed } from '@angular/core/testing';

import { SleepService } from './sleep';

describe('SleepService', () => {
  let service: SleepService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(SleepService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('recovers from a malformed saved state', () => {
    localStorage.setItem('sleep_state', JSON.stringify({
      isRunning: true,
      startTime: 'tomorrow',
      elapsed: -10,
      sessionActive: true
    }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(SleepService);

    expect(service.getState()).toEqual({
      isRunning: false,
      startTime: null,
      elapsed: 0,
      sessionActive: false
    });
  });
});
