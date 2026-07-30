import { TestBed } from '@angular/core/testing';
import { ActivityService } from './activity.service';

describe('ActivityService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('ignores malformed stored activities', () => {
    localStorage.setItem(
      'baby_activities',
      JSON.stringify([
        {
          id: 'bad',
          type: 'feeding',
          title: '',
          value: '120 mL',
          time: '09:00',
          createdAt: 'yesterday'
        }
      ])
    );

    const service = TestBed.inject(ActivityService);
    expect(service.getActivities()).toEqual([]);
  });

  it('rejects an invalid new activity', () => {
    const service = TestBed.inject(ActivityService);

    expect(() => service.add({
      id: '',
      type: 'feeding',
      title: '',
      value: '',
      time: '',
      createdAt: Number.NaN
    })).toThrowError(
      'The activity contains invalid or incomplete data.'
    );
  });
});
