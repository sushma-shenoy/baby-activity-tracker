import { TestBed } from '@angular/core/testing';
import {
  AppPreferences,
  PreferencesService
} from './preferences.service';

describe('PreferencesService', () => {
  let service: PreferencesService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(PreferencesService);
  });

  it('provides safe default preferences', () => {
    expect(service.preferences.baby.name).toBe('Baby');
    expect(service.preferences.goals.feeds).toBe(8);
  });

  it('normalizes and persists preferences', () => {
    const preferences: AppPreferences = {
      baby: {
        name: '  Mia  ',
        birthDate: '2026-01-15',
        mood: 'Playful 🧸'
      },
      goals: {
        feeds: 0,
        sleepSessions: 6.4,
        diapers: 30
      }
    };

    service.save(preferences);

    expect(service.preferences).toEqual({
      baby: {
        name: 'Mia',
        birthDate: '2026-01-15',
        mood: 'Playful 🧸'
      },
      goals: {
        feeds: 1,
        sleepSessions: 6,
        diapers: 24
      }
    });
    expect(localStorage.getItem('baby_preferences'))
      .toContain('"name":"Mia"');
  });
});
