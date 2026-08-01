import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ActivityService } from '../../services/activity.service';
import { GrowthService } from '../../services/growth.service';
import { MedicineService } from '../../services/medicine.service';
import { MilestoneService } from '../../services/milestone.service';
import { NursingService } from '../../services/nursing.service';
import { TemperatureService } from '../../services/temperature.service';
import { VaccinationService } from '../../services/vaccination.service';
import { Subscription } from 'rxjs';
import { DailyJournalService } from '../../services/daily-journal.service';

type CalendarType =
  | 'feeding' | 'solids' | 'sleep' | 'diaper' | 'medicine'
  | 'nursing' | 'growth' | 'vaccination' | 'temperature' | 'milestone'
  | 'journal';

interface CalendarEvent {
  id: string;
  type: CalendarType;
  title: string;
  detail: string;
  timestamp: number;
  route: string;
  createdByName?: string;
}

interface CalendarDay {
  date: Date;
  dateKey: string;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  eventCount: number;
  eventTypes: CalendarType[];
}

interface CalendarFilter {
  type: CalendarType;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.page.html',
  styleUrls: ['./calendar.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class CalendarPage implements OnInit, OnDestroy {
  readonly filters: CalendarFilter[] = [
    { type: 'feeding', label: 'Feeds', icon: '🍼' },
    { type: 'solids', label: 'Solids', icon: '🥣' },
    { type: 'sleep', label: 'Sleep', icon: '😴' },
    { type: 'diaper', label: 'Diapers', icon: '🧷' },
    { type: 'nursing', label: 'Nursing', icon: '🤱' },
    { type: 'medicine', label: 'Medicine', icon: '💊' },
    { type: 'growth', label: 'Growth', icon: '⚖️' },
    { type: 'vaccination', label: 'Vaccines', icon: '🩹' },
    { type: 'temperature', label: 'Temperature', icon: '🌡️' },
    { type: 'milestone', label: 'Milestones', icon: '🌟' },
    { type: 'journal', label: 'Journal', icon: '📔' }
  ];

  readonly weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  visibleMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  selectedDateKey = this.dateKey(new Date());
  selectedTypes = new Set<CalendarType>();
  days: CalendarDay[] = [];
  events: CalendarEvent[] = [];
  private activitySubscription?: Subscription;
  private readonly dataChangedListener = () => this.refresh();

  constructor(
    private readonly router: Router,
    private readonly activityService: ActivityService,
    private readonly growthService: GrowthService,
    private readonly medicineService: MedicineService,
    private readonly vaccinationService: VaccinationService,
    private readonly temperatureService: TemperatureService,
    private readonly milestoneService: MilestoneService,
    private readonly nursingService: NursingService,
    private readonly journalService: DailyJournalService
  ) {}

  ngOnInit(): void {
    this.activitySubscription = this.activityService.activities$.subscribe(
      () => this.refresh()
    );
    window.addEventListener('baby-tracker:data-changed', this.dataChangedListener);
  }

  ngOnDestroy(): void {
    this.activitySubscription?.unsubscribe();
    window.removeEventListener('baby-tracker:data-changed', this.dataChangedListener);
  }

  ionViewWillEnter(): void {
    this.refresh();
  }

  get monthLabel(): string {
    return this.visibleMonth.toLocaleDateString([], {
      month: 'long', year: 'numeric'
    });
  }

  get selectedDateLabel(): string {
    return this.parseDateKey(this.selectedDateKey).toLocaleDateString([], {
      weekday: 'long', month: 'long', day: 'numeric'
    });
  }

  get selectedEvents(): CalendarEvent[] {
    return this.filteredEvents.filter(
      event => this.dateKey(new Date(event.timestamp)) === this.selectedDateKey
    );
  }

  get hasFilters(): boolean {
    return this.selectedTypes.size > 0;
  }

  previousMonth(): void {
    this.changeMonth(-1);
  }

  nextMonth(): void {
    this.changeMonth(1);
  }

  goToToday(): void {
    const today = new Date();
    this.visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    this.selectedDateKey = this.dateKey(today);
    this.buildDays();
  }

  toggleFilter(type: CalendarType): void {
    if (this.selectedTypes.has(type)) {
      this.selectedTypes.delete(type);
    } else {
      this.selectedTypes.add(type);
    }
    this.selectedTypes = new Set(this.selectedTypes);
    this.buildDays();
  }

  clearFilters(): void {
    this.selectedTypes = new Set<CalendarType>();
    this.buildDays();
  }

  selectDay(day: CalendarDay): void {
    this.selectedDateKey = day.dateKey;
    if (!day.inMonth) {
      this.visibleMonth = new Date(day.date.getFullYear(), day.date.getMonth(), 1);
      this.buildDays();
    }
  }

  openEvent(event: CalendarEvent): void {
    void this.router.navigate([event.route]);
  }

  filterIcon(type: CalendarType): string {
    return this.filters.find(filter => filter.type === type)?.icon ?? '•';
  }

  eventTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: 'numeric', minute: '2-digit'
    });
  }

  trackDay(_index: number, day: CalendarDay): string {
    return day.dateKey;
  }

  trackEvent(_index: number, event: CalendarEvent): string {
    return `${event.type}:${event.id}`;
  }

  private get filteredEvents(): CalendarEvent[] {
    return this.hasFilters
      ? this.events.filter(event => this.selectedTypes.has(event.type))
      : this.events;
  }

  private refresh(): void {
    this.events = this.collectEvents().sort((a, b) => b.timestamp - a.timestamp);
    this.buildDays();
  }

  private collectEvents(): CalendarEvent[] {
    const activityEvents = this.activityService.getActivities().map(activity => ({
      id: activity.id,
      type: activity.type as CalendarType,
      title: activity.title,
      detail: activity.value,
      timestamp: activity.createdAt,
      route: `/${activity.type}`,
      createdByName: activity.createdByName
    }));
    const medicineEvents = this.medicineService.entries.map(entry => ({
      id: entry.id, type: 'medicine' as const, title: entry.name,
      detail: entry.dose, timestamp: entry.givenAt, route: '/medicine', createdByName: entry.createdByName
    }));
    const growthEvents = this.growthService.entries.map(entry => ({
      id: entry.id, type: 'growth' as const, title: 'Weight recorded',
      detail: `${entry.weightKg} kg`, timestamp: this.dateTimestamp(entry.date), route: '/growth', createdByName: entry.createdByName
    }));
    const vaccinationEvents = this.vaccinationService.entries.map(entry => ({
      id: entry.id, type: 'vaccination' as const, title: entry.vaccineName,
      detail: entry.provider || 'Vaccination',
      timestamp: this.dateTimestamp(entry.administeredDate), route: '/vaccination', createdByName: entry.createdByName
    }));
    const temperatureEvents = this.temperatureService.entries.map(entry => ({
      id: entry.id, type: 'temperature' as const, title: 'Temperature',
      detail: `${this.temperatureService.toDisplay(entry.celsius).toFixed(1)}°${this.temperatureService.unit === 'celsius' ? 'C' : 'F'} · ${entry.method}`,
      timestamp: entry.measuredAt, route: '/temperature', createdByName: entry.createdByName
    }));
    const milestoneEvents = this.milestoneService.milestones.map(entry => ({
      id: entry.id, type: 'milestone' as const, title: entry.title,
      detail: entry.category, timestamp: this.dateTimestamp(entry.achievedDate), route: '/milestones', createdByName: entry.createdByName
    }));
    const nursingEvents = this.nursingService.getSessions().map(entry => ({
      id: entry.id, type: 'nursing' as const, title: 'Nursing session',
      detail: `${Math.max(1, Math.round((entry.leftSeconds + entry.rightSeconds) / 60))} min`,
      timestamp: entry.startedAt, route: '/feeding', createdByName: entry.createdByName
    }));
    const journalEvents = this.journalService.entries.map(entry => ({
      id: entry.id,
      type: 'journal' as const,
      title: `${entry.mood.charAt(0).toUpperCase()}${entry.mood.slice(1)} mood`,
      detail: entry.symptoms.length ? entry.symptoms.join(' · ') : entry.notes || 'Daily journal',
      timestamp: entry.recordedAt,
      route: '/journal',
      createdByName: entry.createdByName
    }));
    return [
      ...activityEvents, ...medicineEvents, ...growthEvents,
      ...vaccinationEvents, ...temperatureEvents, ...milestoneEvents,
      ...nursingEvents, ...journalEvents
    ];
  }

  private buildDays(): void {
    const first = new Date(
      this.visibleMonth.getFullYear(), this.visibleMonth.getMonth(), 1
    );
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay());
    const todayKey = this.dateKey(new Date());
    const eventsByDay = new Map<string, CalendarEvent[]>();
    for (const event of this.filteredEvents) {
      const key = this.dateKey(new Date(event.timestamp));
      eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), event]);
    }
    this.days = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const dateKey = this.dateKey(date);
      const dayEvents = eventsByDay.get(dateKey) ?? [];
      return {
        date, dateKey, dayNumber: date.getDate(),
        inMonth: date.getMonth() === this.visibleMonth.getMonth(),
        isToday: dateKey === todayKey,
        eventCount: dayEvents.length,
        eventTypes: [...new Set(dayEvents.map(event => event.type))].slice(0, 3)
      };
    });
  }

  private changeMonth(offset: number): void {
    this.visibleMonth = new Date(
      this.visibleMonth.getFullYear(), this.visibleMonth.getMonth() + offset, 1
    );
    this.selectedDateKey = this.dateKey(this.visibleMonth);
    this.buildDays();
  }

  private dateTimestamp(value: string): number {
    return this.parseDateKey(value).getTime();
  }

  private parseDateKey(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private dateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
