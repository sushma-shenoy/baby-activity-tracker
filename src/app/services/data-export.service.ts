import { Injectable } from '@angular/core';

export interface BabyTrackerBackup {
  app: 'baby-activity-tracker';
  version: 1;
  exportedAt: string;
  data: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class DataExportService {
  private readonly allowedKeys = [
    'baby_preferences',
    'baby_activities',
    'feeds',
    'sleep_state',
    'baby_weight_entries',
    'baby_medicine_entries',
    'baby_vaccination_entries',
    'baby_temperature_entries',
    'baby_temperature_unit',
    'baby_milestones',
    'nursing_sessions',
    'active_nursing_session'
  ] as const;

  createBackup(): BabyTrackerBackup {
    const data: Record<string, unknown> = {};

    for (const key of this.allowedKeys) {
      const rawValue = localStorage.getItem(key);
      if (rawValue === null) continue;

      try {
        data[key] = JSON.parse(rawValue);
      } catch {
        data[key] = rawValue;
      }
    }

    return {
      app: 'baby-activity-tracker',
      version: 1,
      exportedAt: new Date().toISOString(),
      data
    };
  }

  download(): string {
    const backup = this.createBackup();
    const blob = new Blob(
      [JSON.stringify(backup, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = backup.exportedAt.slice(0, 10);
    link.href = url;
    link.download = `baby-tracker-backup-${date}.json`;
    link.click();
    URL.revokeObjectURL(url);
    return link.download;
  }

  parseBackup(contents: string): BabyTrackerBackup {
    let parsed: unknown;
    try {
      parsed = JSON.parse(contents);
    } catch {
      throw new Error('This is not a valid JSON backup file.');
    }

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      (parsed as BabyTrackerBackup).app !== 'baby-activity-tracker' ||
      (parsed as BabyTrackerBackup).version !== 1 ||
      !(parsed as BabyTrackerBackup).data ||
      typeof (parsed as BabyTrackerBackup).data !== 'object'
    ) {
      throw new Error('This file is not a supported Baby Tracker backup.');
    }

    const backup = parsed as BabyTrackerBackup;
    for (const [key, value] of Object.entries(backup.data)) {
      if (!this.isAllowedKey(key) || !this.isValidValue(key, value)) {
        throw new Error(`The backup contains invalid data for “${key}”.`);
      }
    }
    return backup;
  }

  restore(backup: BabyTrackerBackup): number {
    const safeEntries = Object.entries(backup.data).filter(
      ([key, value]) => this.isAllowedKey(key) && this.isValidValue(key, value)
    );

    for (const key of this.allowedKeys) {
      localStorage.removeItem(key);
    }
    for (const [key, value] of safeEntries) {
      localStorage.setItem(
        key,
        typeof value === 'string' ? value : JSON.stringify(value)
      );
    }
    return safeEntries.length;
  }

  private isAllowedKey(key: string): boolean {
    return (this.allowedKeys as readonly string[]).includes(key);
  }

  private isValidValue(key: string, value: unknown): boolean {
    const arrayKeys = [
      'baby_activities',
      'feeds',
      'baby_weight_entries',
      'baby_medicine_entries',
      'baby_vaccination_entries',
      'baby_temperature_entries',
      'baby_milestones',
      'nursing_sessions'
    ];
    if (arrayKeys.includes(key)) return Array.isArray(value);
    if (key === 'baby_temperature_unit') {
      return value === 'celsius' || value === 'fahrenheit';
    }
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
}
