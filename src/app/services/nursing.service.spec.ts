import { TestBed } from '@angular/core/testing';
import { NursingService } from './nursing.service';

describe('NursingService', () => {
  let service: NursingService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(NursingService);
  });

  it('tracks time independently when switching sides', () => {
    const started = service.startOrSwitch('left');
    const leftSnapshot = service.snapshot(started.startedAt + 65_000)!;
    localStorage.setItem('active_nursing_session', JSON.stringify(leftSnapshot));
    const switched = service.startOrSwitch('right');

    expect(switched.leftSeconds).toBe(65);
    expect(switched.activeSide).toBe('right');
  });

  it('persists a completed nursing session', () => {
    const active = service.startOrSwitch('left');
    localStorage.setItem(
      'active_nursing_session',
      JSON.stringify({
        ...active,
        leftSeconds: 60,
        activeSide: null,
        activeSince: null
      })
    );
    const session = service.finish();

    expect(session?.leftSeconds).toBe(60);
    expect(service.getSessions().length).toBe(1);
    expect(service.getActive()).toBeNull();
  });
});
