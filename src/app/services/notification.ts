import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  LocalNotifications,
  PermissionStatus
} from '@capacitor/local-notifications';
import { PreferencesService } from './preferences.service';

export type ReminderType =
  | 'feeding'
  | 'sleep'
  | 'diaper'
  | 'medicine'
  | 'temperature';

export interface ActivityReminder {
  type: ReminderType;
  label: string;
  icon: string;
  enabled: boolean;
  time: string;
}

const DEFAULT_REMINDERS: ActivityReminder[] = [
  {
    type: 'feeding',
    label: 'Feeding check-in',
    icon: '🍼',
    enabled: false,
    time: '09:00'
  },
  {
    type: 'sleep',
    label: 'Sleep routine',
    icon: '😴',
    enabled: false,
    time: '19:30'
  },
  {
    type: 'diaper',
    label: 'Diaper check',
    icon: '🧷',
    enabled: false,
    time: '12:00'
  },
  {
    type: 'medicine',
    label: 'Medicine reminder',
    icon: '💊',
    enabled: false,
    time: '08:00'
  },
  {
    type: 'temperature',
    label: 'Temperature check',
    icon: '🌡️',
    enabled: false,
    time: '18:00'
  }
];

@Injectable({ providedIn: 'root' })
export class ActivityReminderService {
  private readonly storageKey = 'baby_activity_reminders';
  private readonly remindersSubject =
    new BehaviorSubject<ActivityReminder[]>(this.load());

  readonly reminders$ = this.remindersSubject.asObservable();

  constructor(
    private readonly preferencesService: PreferencesService
  ) {}

  get reminders(): ActivityReminder[] {
    return this.remindersSubject.value;
  }

  async initialize(): Promise<void> {
    try {
      await this.reconcileNativeSchedule(false);
    } catch (error) {
      console.warn('Unable to initialize activity reminders:', error);
    }
  }

  async update(
    type: ReminderType,
    changes: Pick<ActivityReminder, 'enabled' | 'time'>
  ): Promise<{ success: boolean; message?: string }> {
    if (!this.isValidTime(changes.time)) {
      return {
        success: false,
        message: 'Choose a valid reminder time.'
      };
    }

    if (changes.enabled) {
      const permission = await this.ensurePermission();
      if (permission.display !== 'granted') {
        return {
          success: false,
          message:
            'Notifications are disabled. Allow them in iPhone Settings to enable reminders.'
        };
      }
    }

    const reminders = this.reminders.map(reminder =>
      reminder.type === type
        ? { ...reminder, ...changes }
        : reminder
    );

    localStorage.setItem(this.storageKey, JSON.stringify(reminders));
    this.remindersSubject.next(reminders);
    await this.reconcileNativeSchedule(false);
    return { success: true };
  }

  async sendTest(): Promise<{ success: boolean; message: string }> {
    const permission = await this.ensurePermission();
    if (permission.display !== 'granted') {
      return {
        success: false,
        message: 'Allow notifications in iPhone Settings first.'
      };
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          id: 4199,
          title: 'Little moments',
          body: 'Activity reminders are working.',
          schedule: {
            at: new Date(Date.now() + 3000)
          }
        }
      ]
    });

    return {
      success: true,
      message: 'Test reminder scheduled for a few seconds from now.'
    };
  }

  private async reconcileNativeSchedule(
    requestPermission: boolean
  ): Promise<void> {
    await LocalNotifications.cancel({
      notifications: DEFAULT_REMINDERS.map(
        reminder => ({ id: this.notificationId(reminder.type) })
      )
    });

    const enabled = this.reminders.filter(reminder => reminder.enabled);
    if (enabled.length === 0) return;

    const permission = requestPermission
      ? await this.ensurePermission()
      : await LocalNotifications.checkPermissions();

    if (permission.display !== 'granted') return;

    const babyName = this.preferencesService.preferences.baby.name;

    await LocalNotifications.schedule({
      notifications: enabled.map(reminder => {
        const [hour, minute] = reminder.time.split(':').map(Number);

        return {
          id: this.notificationId(reminder.type),
          title: `${reminder.icon} ${reminder.label}`,
          body: `Time for ${babyName}’s ${this.bodyLabel(reminder.type)}.`,
          schedule: {
            on: { hour, minute },
            repeats: true,
            allowWhileIdle: true
          },
          extra: {
            reminderType: reminder.type
          }
        };
      })
    });
  }

  private async ensurePermission(): Promise<PermissionStatus> {
    const current = await LocalNotifications.checkPermissions();
    return current.display === 'prompt'
      ? LocalNotifications.requestPermissions()
      : current;
  }

  private load(): ActivityReminder[] {
    try {
      const saved = JSON.parse(
        localStorage.getItem(this.storageKey) || '[]'
      ) as Partial<ActivityReminder>[];

      return DEFAULT_REMINDERS.map(defaultReminder => {
        const stored = saved.find(
          reminder => reminder.type === defaultReminder.type
        );

        return {
          ...defaultReminder,
          ...stored,
          time:
            stored?.time && this.isValidTime(stored.time)
              ? stored.time
              : defaultReminder.time,
          enabled: stored?.enabled === true
        };
      });
    } catch {
      return DEFAULT_REMINDERS.map(reminder => ({ ...reminder }));
    }
  }

  private isValidTime(value: string): boolean {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
  }

  private notificationId(type: ReminderType): number {
    return 4101 + DEFAULT_REMINDERS.findIndex(
      reminder => reminder.type === type
    );
  }

  private bodyLabel(type: ReminderType): string {
    const labels: Record<ReminderType, string> = {
      feeding: 'feeding check-in',
      sleep: 'sleep routine',
      diaper: 'diaper check',
      medicine: 'medicine',
      temperature: 'temperature check'
    };
    return labels[type];
  }
}
