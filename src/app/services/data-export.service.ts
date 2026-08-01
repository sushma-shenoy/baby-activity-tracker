import { Injectable } from '@angular/core';
import { trackerStorage } from '../firebase/tracker-storage';

export interface BabyTrackerBackup {
  app: 'baby-activity-tracker';
  version: 1;
  exportedAt: string;
  data: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class DataExportService {
  private readonly allowedKeys = [
    'baby_profiles_v2',
    'active_baby_profile_id',
    'baby_preferences',
    'baby_activities',
    'feeds',
    'baby_solid_food_entries',
    'sleep_state',
    'baby_weight_entries',
    'baby_medicine_entries',
    'baby_vaccination_entries',
    'baby_temperature_entries',
    'baby_temperature_unit',
    'baby_milestones',
    'nursing_sessions',
    'active_nursing_session',
    'baby_activity_reminders',
    'baby_custom_reminders',
    'baby_vaccination_reminder'
  ] as const;

  createBackup(): BabyTrackerBackup {
    const data: Record<string, unknown> = {};

    for (const key of this.allowedKeys) {
      const rawValue = trackerStorage.getItem(key);
      if (rawValue === null) continue;

      try {
        data[key] = JSON.parse(rawValue);
      } catch {
        data[key] = rawValue;
      }
    }

    for (let index = 0; index < trackerStorage.length; index += 1) {
      const key = trackerStorage.key(index);
      if (!key?.startsWith('baby_profile_data:')) continue;

      const rawValue = trackerStorage.getItem(key);
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
      trackerStorage.removeItem(key);
    }
    const scopedKeys = Array.from(
      { length: trackerStorage.length },
      (_, index) => trackerStorage.key(index)
    ).filter(
      (key): key is string => Boolean(key?.startsWith('baby_profile_data:'))
    );
    for (const key of scopedKeys) {
      trackerStorage.removeItem(key);
    }
    for (const [key, value] of safeEntries) {
      trackerStorage.setItem(
        key,
        typeof value === 'string' ? value : JSON.stringify(value)
      );
    }
    return safeEntries.length;
  }

  private isAllowedKey(key: string): boolean {
    return (
      (this.allowedKeys as readonly string[]).includes(key) ||
      key.startsWith('baby_profile_data:')
    );
  }

  private isValidValue(key: string, value: unknown): boolean {
    if (key.startsWith('baby_profile_data:')) {
      const keyParts = key.split(':');
      const baseKey = keyParts[keyParts.length - 1];
      return Boolean(baseKey) && this.isValidValue(baseKey, value);
    }

    const arrayKeys = [
      'baby_activities',
      'feeds',
      'baby_solid_food_entries',
      'baby_weight_entries',
      'baby_medicine_entries',
      'baby_vaccination_entries',
      'baby_temperature_entries',
      'baby_milestones',
      'nursing_sessions',
      'baby_activity_reminders',
      'baby_custom_reminders'
    ];
    if (arrayKeys.includes(key)) return Array.isArray(value);
    if (key === 'baby_profiles_v2') return Array.isArray(value);
    if (key === 'active_baby_profile_id') {
      return typeof value === 'string' && value.length > 0;
    }
    if (key === 'baby_temperature_unit') {
      return value === 'celsius' || value === 'fahrenheit';
    }
    if (key === 'baby_vaccination_reminder') {
      return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
}
