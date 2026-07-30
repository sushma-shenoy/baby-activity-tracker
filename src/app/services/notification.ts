import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  LocalNotifications,
  PermissionStatus
} from '@capacitor/local-notifications';
import { PreferencesService } from './preferences.service';
import { VaccinationService } from './vaccination.service';

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

export interface CustomReminder {
  id: string;
  label: string;
  enabled: boolean;
  time: string;
}

export interface VaccinationReminderSettings {
  enabled: boolean;
  daysBefore: number;
  time: string;
}

const DEFAULT_VACCINATION_REMINDER: VaccinationReminderSettings = {
  enabled: false,
  daysBefore: 1,
  time: '09:00'
};

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
  private readonly customStorageKey = 'baby_custom_reminders';
  private readonly vaccinationStorageKey =
    'baby_vaccination_reminder';
  private readonly scheduledIdsKey = 'baby_scheduled_notification_ids';
  private readonly remindersSubject =
    new BehaviorSubject<ActivityReminder[]>(this.load());
  private readonly customRemindersSubject =
    new BehaviorSubject<CustomReminder[]>(this.loadCustomReminders());
  private readonly vaccinationReminderSubject =
    new BehaviorSubject<VaccinationReminderSettings>(
      this.loadVaccinationReminder()
    );

  readonly reminders$ = this.remindersSubject.asObservable();
  readonly customReminders$ = this.customRemindersSubject.asObservable();
  readonly vaccinationReminder$ =
    this.vaccinationReminderSubject.asObservable();

  constructor(
    private readonly preferencesService: PreferencesService,
    private readonly vaccinationService: VaccinationService
  ) {}

  get reminders(): ActivityReminder[] {
    return this.remindersSubject.value;
  }

  get customReminders(): CustomReminder[] {
    return this.customRemindersSubject.value;
  }

  get vaccinationReminder(): VaccinationReminderSettings {
    return this.vaccinationReminderSubject.value;
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

  async addCustomReminder(
    label: string,
    time: string
  ): Promise<{ success: boolean; message?: string }> {
    const normalizedLabel = label.trim();
    if (!normalizedLabel || normalizedLabel.length > 50) {
      return {
        success: false,
        message: 'Enter a reminder name up to 50 characters.'
      };
    }
    if (!this.isValidTime(time)) {
      return {
        success: false,
        message: 'Choose a valid reminder time.'
      };
    }

    const permission = await this.ensurePermission();
    if (permission.display !== 'granted') {
      return {
        success: false,
        message:
          'Notifications are disabled. Allow them in iPhone Settings first.'
      };
    }

    const reminder: CustomReminder = {
      id: this.createCustomId(),
      label: normalizedLabel,
      enabled: true,
      time
    };
    this.persistCustomReminders([
      ...this.customReminders,
      reminder
    ]);
    await this.reconcileNativeSchedule(false);
    return { success: true };
  }

  async updateCustomReminder(
    id: string,
    changes: Pick<CustomReminder, 'enabled' | 'time'>
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
          message: 'Allow notifications in iPhone Settings first.'
        };
      }
    }

    this.persistCustomReminders(
      this.customReminders.map(reminder =>
        reminder.id === id
          ? { ...reminder, ...changes }
          : reminder
      )
    );
    await this.reconcileNativeSchedule(false);
    return { success: true };
  }

  async deleteCustomReminder(id: string): Promise<void> {
    this.persistCustomReminders(
      this.customReminders.filter(reminder => reminder.id !== id)
    );
    await this.reconcileNativeSchedule(false);
  }

  async updateVaccinationReminder(
    changes: VaccinationReminderSettings
  ): Promise<{ success: boolean; message?: string }> {
    if (
      !this.isValidTime(changes.time) ||
      ![0, 1, 3, 7].includes(changes.daysBefore)
    ) {
      return {
        success: false,
        message: 'Choose a valid reminder time and notice period.'
      };
    }

    if (changes.enabled) {
      const permission = await this.ensurePermission();
      if (permission.display !== 'granted') {
        return {
          success: false,
          message:
            'Notifications are disabled. Allow them in iPhone Settings first.'
        };
      }
    }

    localStorage.setItem(
      this.vaccinationStorageKey,
      JSON.stringify(changes)
    );
    this.vaccinationReminderSubject.next(changes);
    await this.reconcileNativeSchedule(false);
    return { success: true };
  }

  async refreshSchedules(): Promise<void> {
    await this.reconcileNativeSchedule(false);
  }

  private async reconcileNativeSchedule(
    requestPermission: boolean
  ): Promise<void> {
    const previousIds = this.loadScheduledIds();
    await LocalNotifications.cancel({
      notifications: previousIds.map(id => ({ id }))
    });

    const enabled = this.reminders.filter(reminder => reminder.enabled);
    const enabledCustom = this.customReminders.filter(
      reminder => reminder.enabled
    );
    const vaccinationNotifications =
      this.buildVaccinationNotifications();
    if (
      enabled.length === 0 &&
      enabledCustom.length === 0 &&
      vaccinationNotifications.length === 0
    ) {
      this.persistScheduledIds([]);
      return;
    }

    const permission = requestPermission
      ? await this.ensurePermission()
      : await LocalNotifications.checkPermissions();

    if (permission.display !== 'granted') {
      this.persistScheduledIds([]);
      return;
    }

    const babyName = this.preferencesService.preferences.baby.name;
    const presetNotifications = enabled.map(reminder => {
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
    });
    const customNotifications = enabledCustom.map(reminder => {
      const [hour, minute] = reminder.time.split(':').map(Number);
      return {
        id: this.customNotificationId(reminder.id),
        title: `🔔 ${reminder.label}`,
        body: `${babyName}: ${reminder.label}`,
        schedule: {
          on: { hour, minute },
          repeats: true,
          allowWhileIdle: true
        },
        extra: {
          customReminderId: reminder.id
        }
      };
    });

    const notifications = [
      ...presetNotifications,
      ...customNotifications,
      ...vaccinationNotifications
    ];
    await LocalNotifications.schedule({ notifications });
    this.persistScheduledIds(
      notifications.map(notification => notification.id)
    );
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

  private loadCustomReminders(): CustomReminder[] {
    try {
      const reminders = JSON.parse(
        localStorage.getItem(this.customStorageKey) || '[]'
      ) as CustomReminder[];

      return Array.isArray(reminders)
        ? reminders.filter(
            reminder =>
              typeof reminder.id === 'string' &&
              typeof reminder.label === 'string' &&
              reminder.label.trim().length > 0 &&
              reminder.label.length <= 50 &&
              this.isValidTime(reminder.time)
          )
        : [];
    } catch {
      return [];
    }
  }

  private persistCustomReminders(reminders: CustomReminder[]): void {
    localStorage.setItem(
      this.customStorageKey,
      JSON.stringify(reminders)
    );
    this.customRemindersSubject.next(reminders);
  }

  private loadVaccinationReminder(): VaccinationReminderSettings {
    try {
      const saved = JSON.parse(
        localStorage.getItem(this.vaccinationStorageKey) || '{}'
      ) as Partial<VaccinationReminderSettings>;

      return {
        enabled: saved.enabled === true,
        daysBefore: [0, 1, 3, 7].includes(
          Number(saved.daysBefore)
        )
          ? Number(saved.daysBefore)
          : DEFAULT_VACCINATION_REMINDER.daysBefore,
        time:
          typeof saved.time === 'string' &&
          this.isValidTime(saved.time)
            ? saved.time
            : DEFAULT_VACCINATION_REMINDER.time
      };
    } catch {
      return { ...DEFAULT_VACCINATION_REMINDER };
    }
  }

  private buildVaccinationNotifications() {
    const settings = this.vaccinationReminder;
    if (!settings.enabled) {
      return [];
    }

    const [hour, minute] = settings.time.split(':').map(Number);
    const babyName = this.preferencesService.preferences.baby.name;
    const now = Date.now();

    return this.vaccinationService.entries
      .filter(entry => Boolean(entry.nextDueDate))
      .map(entry => {
        const notificationDate =
          new Date(`${entry.nextDueDate}T${settings.time}:00`);
        notificationDate.setDate(
          notificationDate.getDate() - settings.daysBefore
        );

        return {
          entry,
          notificationDate
        };
      })
      .filter(item => item.notificationDate.getTime() > now)
      .sort(
        (first, second) =>
          first.notificationDate.getTime() -
          second.notificationDate.getTime()
      )
      .slice(0, 32)
      .map(({ entry, notificationDate }) => ({
        id: this.vaccinationNotificationId(entry.id),
        title: `🩹 ${entry.vaccineName} reminder`,
        body:
          settings.daysBefore === 0
            ? `${babyName}’s vaccination is due today.`
            : `${babyName}’s vaccination is due in ${settings.daysBefore} ${
                settings.daysBefore === 1 ? 'day' : 'days'
              }.`,
        schedule: {
          at: new Date(
            notificationDate.getFullYear(),
            notificationDate.getMonth(),
            notificationDate.getDate(),
            hour,
            minute
          ),
          allowWhileIdle: true
        },
        extra: {
          vaccinationId: entry.id
        }
      }));
  }

  private loadScheduledIds(): number[] {
    try {
      const ids = JSON.parse(
        localStorage.getItem(this.scheduledIdsKey) || '[]'
      ) as number[];
      return Array.isArray(ids)
        ? ids.filter(id => Number.isSafeInteger(id))
        : [];
    } catch {
      return [];
    }
  }

  private persistScheduledIds(ids: number[]): void {
    localStorage.setItem(this.scheduledIdsKey, JSON.stringify(ids));
  }

  private isValidTime(value: string): boolean {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
  }

  private notificationId(type: ReminderType): number {
    return 4101 + DEFAULT_REMINDERS.findIndex(
      reminder => reminder.type === type
    );
  }

  private customNotificationId(id: string): number {
    let hash = 0;
    for (const character of id) {
      hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    }
    return 100_000 + (hash % 2_000_000_000);
  }

  private vaccinationNotificationId(id: string): number {
    let hash = 0;
    for (const character of id) {
      hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    }
    return 2_100_000_000 + (hash % 40_000_000);
  }

  private createCustomId(): string {
    return globalThis.crypto?.randomUUID?.() ??
      `reminder-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
