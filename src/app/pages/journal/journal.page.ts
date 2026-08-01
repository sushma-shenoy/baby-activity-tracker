import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertController, IonicModule } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { DailyJournalService, JournalEntry, JournalMood } from '../../services/daily-journal.service';

@Component({
  selector: 'app-journal',
  templateUrl: './journal.page.html',
  styleUrls: ['./journal.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class JournalPage implements OnDestroy {
  readonly moods: Array<{ value: JournalMood; label: string; icon: string }> = [
    { value: 'happy', label: 'Happy', icon: '😊' },
    { value: 'calm', label: 'Calm', icon: '😌' },
    { value: 'fussy', label: 'Fussy', icon: '😣' },
    { value: 'tired', label: 'Tired', icon: '🥱' },
    { value: 'unwell', label: 'Unwell', icon: '🤒' }
  ];
  readonly symptomOptions = ['Fever', 'Cough', 'Congestion', 'Rash', 'Teething', 'Vomiting', 'Diarrhea', 'Low appetite'];
  entries: JournalEntry[] = [];
  mood: JournalMood = 'happy';
  notes = '';
  symptoms: string[] = [];
  recordedAt = this.localDateTime(new Date());
  editingId = '';
  errorMessage = '';
  private subscription: Subscription;

  constructor(
    private readonly journalService: DailyJournalService,
    private readonly alertController: AlertController
  ) {
    this.subscription = this.journalService.entries$.subscribe(entries => this.entries = entries);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  toggleSymptom(symptom: string): void {
    this.symptoms = this.symptoms.includes(symptom)
      ? this.symptoms.filter(item => item !== symptom)
      : [...this.symptoms, symptom];
  }

  save(): void {
    const timestamp = new Date(this.recordedAt).getTime();
    const success = this.journalService.save({
      id: this.editingId || `journal-${crypto.randomUUID()}`,
      recordedAt: timestamp,
      mood: this.mood,
      notes: this.notes,
      symptoms: this.symptoms
    });
    if (!success) {
      this.errorMessage = 'Choose a valid past time and keep notes under 500 characters.';
      return;
    }
    this.reset();
  }

  edit(entry: JournalEntry): void {
    this.editingId = entry.id;
    this.mood = entry.mood;
    this.notes = entry.notes;
    this.symptoms = [...entry.symptoms];
    this.recordedAt = this.localDateTime(new Date(entry.recordedAt));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async remove(entry: JournalEntry): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Delete journal entry?',
      message: 'This removes the mood, symptoms, and notes from the family journal.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Delete', role: 'destructive', handler: () => this.journalService.delete(entry.id) }
      ]
    });
    await alert.present();
  }

  moodInfo(mood: JournalMood) {
    return this.moods.find(item => item.value === mood) ?? this.moods[0];
  }

  private reset(): void {
    this.editingId = '';
    this.mood = 'happy';
    this.notes = '';
    this.symptoms = [];
    this.recordedAt = this.localDateTime(new Date());
    this.errorMessage = '';
  }

  private localDateTime(date: Date): string {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  }
}
