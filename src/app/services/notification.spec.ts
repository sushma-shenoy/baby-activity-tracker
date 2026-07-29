import { TestBed } from '@angular/core/testing';

import { ActivityReminderService } from './notification';

describe('ActivityReminderService', () => {
  let service: ActivityReminderService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ActivityReminderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('provides disabled reminder defaults', () => {
    expect(service.reminders.length).toBe(5);
    expect(service.reminders.every(reminder => !reminder.enabled)).toBeTrue();
  });
});
