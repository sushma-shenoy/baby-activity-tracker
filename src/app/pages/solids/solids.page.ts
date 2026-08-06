import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ActivityService } from '../../services/activity.service';
import {
  SolidFoodAmount,
  SolidFoodEntry,
  SolidFoodReaction,
  SolidFoodService
} from '../../services/solid-food.service';
import { formatTime24 } from '../../shared/date-time.utils';
import { Subscription } from 'rxjs';
import { PendingChangesPanelComponent } from '../../shared/pending-changes-panel/pending-changes-panel.component';

@Component({
  selector: 'app-solids',
  templateUrl: './solids.page.html',
  styleUrls: ['./solids.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PendingChangesPanelComponent
  ]
})
export class SolidsPage implements OnDestroy {
  entries: SolidFoodEntry[] = [];
  errorMessage = '';
  editingId = '';
  foods = '';
  selectedFoods: string[] = [];
  amount: SolidFoodAmount = 'some';
  reaction: SolidFoodReaction = 'neutral';
  notes = '';
  dateTime = this.toLocalDateTime(new Date());
  private entriesSubscription?: Subscription;

  readonly amounts: Array<{
    value: SolidFoodAmount;
    label: string;
  }> = [
    { value: 'taste', label: 'Taste' },
    { value: 'some', label: 'Some' },
    { value: 'most', label: 'Most' },
    { value: 'all', label: 'All' }
  ];

  readonly reactions: Array<{
    value: SolidFoodReaction;
    label: string;
    icon: string;
  }> = [
    { value: 'neutral', label: 'Neutral', icon: '😐' },
    { value: 'liked', label: 'Liked', icon: '😊' },
    { value: 'disliked', label: 'Disliked', icon: '🙁' },
    {
      value: 'possible-reaction',
      label: 'Reaction',
      icon: '⚠️'
    }
  ];

  readonly foodCategories: Array<{
    name: string;
    icon: string;
    foods: string[];
  }> = [
    {
      name: 'Fruits',
      icon: '🍓',
      foods: [
        'Banana',
        'Avocado',
        'Apple',
        'Pear',
        'Mango',
        'Berries'
      ]
    },
    {
      name: 'Vegetables',
      icon: '🥕',
      foods: [
        'Sweet potato',
        'Carrot',
        'Broccoli',
        'Peas',
        'Pumpkin',
        'Spinach'
      ]
    },
    {
      name: 'Grains',
      icon: '🌾',
      foods: [
        'Oatmeal',
        'Rice',
        'Pasta',
        'Bread',
        'Quinoa',
        'Cereal'
      ]
    },
    {
      name: 'Protein',
      icon: '🍗',
      foods: [
        'Chicken',
        'Beef',
        'Lentils',
        'Beans',
        'Tofu',
        'Fish'
      ]
    },
    {
      name: 'Dairy',
      icon: '🥛',
      foods: [
        'Yogurt',
        'Cheese',
        'Cottage cheese'
      ]
    },
    {
      name: 'Allergens',
      icon: '⚠️',
      foods: [
        'Egg',
        'Peanut',
        'Tree nuts',
        'Wheat',
        'Soy',
        'Sesame',
        'Shellfish'
      ]
    }
  ];

  constructor(
    private readonly solidFoodService:
      SolidFoodService,
    private readonly activityService:
      ActivityService
  ) {
    this.loadEntries();
    this.entriesSubscription = this.solidFoodService.entries$.subscribe(
      entries => (this.entries = [...entries])
    );
  }

  ngOnDestroy(): void {
    this.entriesSubscription?.unsubscribe();
  }

  ionViewWillEnter(): void {
    this.loadEntries();
  }

  save(): void {
    const eatenAt =
      new Date(this.dateTime).getTime();
    const entry: SolidFoodEntry = {
      id:
        this.editingId ||
        `solid-${Date.now()}`,
      foods: this.combinedFoods,
      amount: this.amount,
      reaction: this.reaction,
      notes: this.notes,
      eatenAt
    };

    if (!this.solidFoodService.save(entry)) {
      this.errorMessage =
        'Enter a food name, a valid past time, and notes up to 240 characters.';
      return;
    }

    this.activityService.upsertBySourceId(
      entry.id,
      {
        id: entry.id,
        type: 'solids',
        title: 'Solid food',
        value:
          `${entry.foods.trim()} · ` +
          `${this.amountLabel(entry.amount)} · ` +
          this.reactionLabel(entry.reaction),
        time: formatTime24(
          new Date(entry.eatenAt)
        ),
        createdAt: entry.eatenAt
      }
    );

    this.reset();
    this.loadEntries();
  }

  edit(entry: SolidFoodEntry): void {
    this.editingId = entry.id;
    const savedFoods =
      entry.foods
        .split(',')
        .map(food => food.trim())
        .filter(Boolean);
    const presetFoods =
      new Set(
        this.foodCategories.reduce<string[]>(
          (foods, category) => [
            ...foods,
            ...category.foods
          ],
          []
        )
      );

    this.selectedFoods =
      savedFoods.filter(food =>
        presetFoods.has(food)
      );
    this.foods =
      savedFoods.filter(food =>
        !presetFoods.has(food)
      ).join(', ');
    this.amount = entry.amount;
    this.reaction = entry.reaction;
    this.notes = entry.notes;
    this.dateTime =
      this.toLocalDateTime(
        new Date(entry.eatenAt)
      );
    this.errorMessage = '';
  }

  delete(entry: SolidFoodEntry): void {
    this.solidFoodService.delete(entry.id);
    this.activityService.delete(entry.id);
    if (this.editingId === entry.id) {
      this.reset();
    }
    this.loadEntries();
  }

  cancelEdit(): void {
    this.reset();
  }

  amountLabel(
    amount: SolidFoodAmount
  ): string {
    return this.amounts.find(
      option => option.value === amount
    )?.label ?? amount;
  }

  reactionLabel(
    reaction: SolidFoodReaction
  ): string {
    return this.reactions.find(
      option => option.value === reaction
    )?.label ?? reaction;
  }

  get combinedFoods(): string {
    const customFoods =
      this.foods
        .split(',')
        .map(food => food.trim())
        .filter(Boolean);

    return [
      ...new Set([
        ...this.selectedFoods,
        ...customFoods
      ])
    ].join(', ');
  }

  toggleFood(food: string): void {
    this.selectedFoods =
      this.selectedFoods.includes(food)
        ? this.selectedFoods.filter(
            selected => selected !== food
          )
        : [...this.selectedFoods, food];
  }

  isFoodSelected(food: string): boolean {
    return this.selectedFoods.includes(food);
  }

  trackById(
    _index: number,
    entry: SolidFoodEntry
  ): string {
    return entry.id;
  }

  private loadEntries(): void {
    this.entries = [
      ...this.solidFoodService.entries
    ];
  }

  private reset(): void {
    this.editingId = '';
    this.foods = '';
    this.selectedFoods = [];
    this.amount = 'some';
    this.reaction = 'neutral';
    this.notes = '';
    this.dateTime =
      this.toLocalDateTime(new Date());
    this.errorMessage = '';
  }

  private toLocalDateTime(
    date: Date
  ): string {
    const local = new Date(
      date.getTime() -
      date.getTimezoneOffset() * 60_000
    );
    return local.toISOString().slice(0, 16);
  }
}
