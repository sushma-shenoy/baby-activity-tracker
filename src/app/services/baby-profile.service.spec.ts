import { TestBed } from '@angular/core/testing';
import { BabyProfileService } from './baby-profile.service';

describe('BabyProfileService', () => {
  let service: BabyProfileService;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      'baby_preferences',
      JSON.stringify({
        baby: {
          name: 'Mia',
          birthDate: '2025-01-02',
          mood: 'Happy 😊'
        },
        goals: {
          feeds: 8,
          sleepSessions: 5,
          diapers: 7
        }
      })
    );
    localStorage.setItem(
      'baby_activities',
      JSON.stringify([{ id: 'mia-feed' }])
    );

    TestBed.configureTestingModule({});
    service = TestBed.inject(BabyProfileService);
  });

  it('migrates existing baby data into the first profile', () => {
    expect(service.profiles.length).toBe(1);
    expect(service.activeProfile?.name).toBe('Mia');

    const scopedKey =
      `baby_profile_data:${service.activeProfileId}:baby_activities`;
    expect(localStorage.getItem(scopedKey)).toContain('mia-feed');
  });

  it('keeps tracker records separate when switching babies', () => {
    const miaId = service.activeProfileId;
    const second = service.addProfile(
      {
        name: 'Noah',
        birthDate: '2026-02-03',
        mood: 'Sleepy 😴'
      },
      {
        feeds: 8,
        sleepSessions: 5,
        diapers: 7
      }
    );

    expect(localStorage.getItem('baby_activities')).toBeNull();
    localStorage.setItem(
      'baby_activities',
      JSON.stringify([{ id: 'noah-sleep' }])
    );

    expect(service.switchProfile(miaId)).toBeTrue();
    expect(localStorage.getItem('baby_activities')).toContain('mia-feed');

    expect(service.switchProfile(second.id)).toBeTrue();
    expect(localStorage.getItem('baby_activities')).toContain('noah-sleep');
  });

  it('keeps the selected baby after the service is recreated', () => {
    const firstBabyId = service.activeProfileId;
    service.addProfile(
      {
        name: 'Noah',
        birthDate: '2026-02-03',
        mood: 'Sleepy 😴'
      },
      {
        feeds: 8,
        sleepSessions: 5,
        diapers: 7
      }
    );

    expect(service.switchProfile(firstBabyId)).toBeTrue();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(BabyProfileService);

    expect(service.activeProfileId).toBe(firstBabyId);
    expect(service.activeProfile?.name).toBe('Mia');
  });
});
