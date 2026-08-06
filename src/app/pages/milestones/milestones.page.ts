import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AlertController, IonicModule } from '@ionic/angular';
import { Subscription } from 'rxjs';
import {
  Milestone,
  MilestoneCategory,
  MilestoneService
} from '../../services/milestone.service';
import { PreferencesService } from '../../services/preferences.service';
import {
  calendarDateValidator,
  trimmedRequiredValidator
} from '../../shared/form-validators';
import { PendingChangesPanelComponent } from '../../shared/pending-changes-panel/pending-changes-panel.component';

@Component({
  selector: 'app-milestones',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IonicModule, PendingChangesPanelComponent],
  templateUrl: './milestones.page.html',
  styleUrls: ['./milestones.page.scss']
})
export class MilestonesPage implements OnInit, OnDestroy {
  milestones: Milestone[] = [];
  editingId = '';
  errorMessage = '';
  successMessage = '';
  searchTerm = '';
  categoryFilter: MilestoneCategory | 'all' = 'all';
  readonly today = this.toDateInput(new Date());
  readonly categories: { value: MilestoneCategory; label: string; icon: string }[] = [
    { value: 'motor', label: 'Movement', icon: '🧸' },
    { value: 'communication', label: 'Communication', icon: '💬' },
    { value: 'social', label: 'Social', icon: '😊' },
    { value: 'cognitive', label: 'Learning', icon: '💡' },
    { value: 'firsts', label: 'Special first', icon: '✨' },
    { value: 'other', label: 'Other', icon: '🌟' }
  ];

  readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        trimmedRequiredValidator(),
        Validators.maxLength(80)
      ]
    }),
    category: new FormControl<MilestoneCategory>('firsts', { nonNullable: true }),
    achievedDate: new FormControl(this.today, {
      nonNullable: true,
      validators: [Validators.required, calendarDateValidator()]
    }),
    notes: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(240)]
    })
  });

  private subscription?: Subscription;

  constructor(
    private readonly milestoneService: MilestoneService,
    private readonly preferencesService: PreferencesService,
    private readonly alertController: AlertController
  ) {}

  fieldError(
    field: 'title' | 'achievedDate' | 'notes'
  ): string {
    const control = this.form.controls[field];
    if (!control.touched || !control.errors) return '';
    if (control.hasError('required')) {
      return field === 'title'
        ? 'Enter what happened.'
        : 'Choose the date achieved.';
    }
    if (control.hasError('invalidDate')) return 'Enter a valid calendar date.';
    if (control.hasError('maxlength')) {
      return field === 'title'
        ? 'Use 80 characters or fewer.'
        : 'Use 240 characters or fewer.';
    }
    return 'Check this field.';
  }

  ngOnInit(): void {
    this.subscription = this.milestoneService.milestones$.subscribe(
      milestones => (this.milestones = milestones)
    );
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  save(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.errorMessage = 'Check the highlighted fields and try again.';
      return;
    }

    const value = this.form.getRawValue();
    const birthDate = this.preferencesService.preferences.baby.birthDate;
    if (value.achievedDate > this.today) {
      this.errorMessage = 'The milestone date cannot be in the future.';
      return;
    }
    if (birthDate && value.achievedDate < birthDate) {
      this.errorMessage = 'The milestone date cannot be before the baby’s birth date.';
      return;
    }

    try {
      this.milestoneService.save({
        id: this.editingId || crypto.randomUUID(),
        ...value,
        createdAt:
          this.milestones.find(item => item.id === this.editingId)?.createdAt ??
          Date.now()
      });
      this.successMessage = this.editingId ? 'Milestone updated.' : 'Milestone saved.';
      this.reset(false);
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Could not save the milestone.';
    }
  }

  edit(milestone: Milestone): void {
    this.editingId = milestone.id;
    this.errorMessage = '';
    this.successMessage = '';
    this.form.setValue({
      title: milestone.title,
      category: milestone.category,
      achievedDate: milestone.achievedDate,
      notes: milestone.notes
    });
  }

  reset(clearMessage = true): void {
    this.editingId = '';
    this.form.reset({
      title: '',
      category: 'firsts',
      achievedDate: this.today,
      notes: ''
    });
    if (clearMessage) {
      this.errorMessage = '';
      this.successMessage = '';
    }
  }

  async confirmDelete(milestone: Milestone): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Delete milestone?',
      message: `“${milestone.title}” will be permanently removed.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            this.milestoneService.delete(milestone.id);
            if (this.editingId === milestone.id) this.reset();
          }
        }
      ]
    });
    await alert.present();
  }

  categoryLabel(category: MilestoneCategory): string {
    return this.categories.find(item => item.value === category)?.label ?? 'Other';
  }

  categoryIcon(category: MilestoneCategory): string {
    return this.categories.find(item => item.value === category)?.icon ?? '🌟';
  }

  get filteredMilestones(): Milestone[] {
    const query = this.searchTerm.trim().toLocaleLowerCase();
    return this.milestones.filter(milestone => {
      const matchesCategory =
        this.categoryFilter === 'all' ||
        milestone.category === this.categoryFilter;
      const matchesSearch =
        !query ||
        milestone.title.toLocaleLowerCase().includes(query) ||
        milestone.notes.toLocaleLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }

  ageWhenAchieved(milestone: Milestone): string {
    const birthDate = this.preferencesService.preferences.baby.birthDate;
    if (!birthDate) return 'Set birth date in Settings to show age';

    const birth = new Date(`${birthDate}T00:00:00`);
    const achieved = new Date(`${milestone.achievedDate}T00:00:00`);
    if (
      Number.isNaN(birth.getTime()) ||
      Number.isNaN(achieved.getTime()) ||
      achieved < birth
    ) {
      return 'Age unavailable';
    }

    const days = Math.floor(
      (achieved.getTime() - birth.getTime()) / 86_400_000
    );
    if (days < 14) return `${days} ${days === 1 ? 'day' : 'days'} old`;

    let months =
      (achieved.getFullYear() - birth.getFullYear()) * 12 +
      achieved.getMonth() - birth.getMonth();
    if (achieved.getDate() < birth.getDate()) months -= 1;
    if (months < 24) {
      const safeMonths = Math.max(0, months);
      return `${safeMonths} ${safeMonths === 1 ? 'month' : 'months'} old`;
    }

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    return remainingMonths
      ? `${years}y ${remainingMonths}m old`
      : `${years} ${years === 1 ? 'year' : 'years'} old`;
  }

  private toDateInput(date: Date): string {
    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return offsetDate.toISOString().slice(0, 10);
  }
}
