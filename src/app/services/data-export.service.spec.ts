import { TestBed } from '@angular/core/testing';
import { DataExportService } from './data-export.service';

describe('DataExportService', () => {
  let service: DataExportService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(DataExportService);
  });

  it('exports tracker data but excludes unrelated browser storage', () => {
    localStorage.setItem('baby_milestones', JSON.stringify([{ id: 'one' }]));
    localStorage.setItem('firebase:authUser:token', 'must-not-export');
    localStorage.setItem('unrelated_key', 'private');

    const backup = service.createBackup();

    expect(backup.data['baby_milestones']).toEqual([{ id: 'one' }]);
    expect(backup.data['firebase:authUser:token']).toBeUndefined();
    expect(backup.data['unrelated_key']).toBeUndefined();
  });

  it('includes backup metadata', () => {
    const backup = service.createBackup();

    expect(backup.app).toBe('baby-activity-tracker');
    expect(backup.version).toBe(1);
    expect(new Date(backup.exportedAt).getTime()).not.toBeNaN();
  });

  it('rejects unsupported or malformed backups', () => {
    expect(() => service.parseBackup('not-json')).toThrow();
    expect(() =>
      service.parseBackup(JSON.stringify({
        app: 'another-app',
        version: 1,
        data: {}
      }))
    ).toThrow();
  });

  it('restores only validated tracker keys', () => {
    const backup = service.parseBackup(JSON.stringify({
      app: 'baby-activity-tracker',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        baby_milestones: [{ id: 'restored' }],
        baby_temperature_unit: 'fahrenheit'
      }
    }));

    expect(service.restore(backup)).toBe(2);
    expect(JSON.parse(localStorage.getItem('baby_milestones') || '[]'))
      .toEqual([{ id: 'restored' }]);
    expect(localStorage.getItem('baby_temperature_unit')).toBe('fahrenheit');
  });
});
