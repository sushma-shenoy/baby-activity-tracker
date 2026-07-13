import { Component, OnInit, OnDestroy } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { SleepService } from './../../services/sleep';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sleep',
  templateUrl: './sleep.page.html',
  styleUrls: ['./sleep.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class SleepPage implements OnInit, OnDestroy {

  timerDisplay = '00:00:00';
  private sub?: Subscription;

  constructor(public sleepService: SleepService) { }
  ionViewWillEnter() {
    const state = this.sleepService.getState();

    if (state.isRunning && state.startTime) {
      // continue running automatically
      return;
    }

    // paused session → just display frozen time
  }
  ngOnInit() {
    this.sub = interval(1000).subscribe(() => {
      const state = this.sleepService.getState();
      this.timerDisplay = this.formatTime(state);
    });
  }

  start() {
    this.sleepService.start();
  }
  stop() {
    this.sleepService.stop()
  }
  pause() {
    this.sleepService.pause();
  }

  formatTime(state: any): string {
    let total = state.elapsed;

    if (state.isRunning && state.startTime) {
      total += Date.now() - state.startTime;
    }

    const sec = Math.floor(total / 1000);
    const hh = Math.floor(sec / 3600);
    const mm = Math.floor((sec % 3600) / 60);
    const ss = sec % 60;

    return `${this.pad(hh)}:${this.pad(mm)}:${this.pad(ss)}`;
  }

  pad(n: number) {
    return n < 10 ? '0' + n : n;
  }

  ionViewWillLeave() {
  const state = this.sleepService.getState();

  // only reset if session exists but user left page after stopping
  if (!state.isRunning && state.elapsed > 0) {
    this.sleepService.reset();
  }
}
  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}