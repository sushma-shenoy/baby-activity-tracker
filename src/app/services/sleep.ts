import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

interface SleepState {
  isRunning: boolean;
  startTime: number | null;
  elapsed: number;

  sessionActive: boolean;   // session exists
}

@Injectable({ providedIn: 'root' })
export class SleepService {

  private initialState: SleepState = {
    isRunning: false,
    startTime: null,
    elapsed: 0,
    sessionActive: false
  };

  private stateKey = 'sleep_state';

  private sleepSubject = new BehaviorSubject<SleepState>(this.loadState());
  sleep$ = this.sleepSubject.asObservable();

  start() {
  const state = this.getState();

  state.sessionActive = true;
  state.isRunning = true;
  state.startTime = Date.now();

  this.save(state);
}
getTime(state: SleepState): number {
  let total = state.elapsed;

  if (state.isRunning && state.startTime) {
    total += Date.now() - state.startTime;
  }

  return total;
}
  reset() {
  const resetState = {
    isRunning: false,
    startTime: null,
    elapsed: 0,
    sessionActive: false
  };

  localStorage.removeItem('sleep_state'); // IMPORTANT
  this.sleepSubject.next(resetState);
}

  pause() {
  const state = this.getState();

  if (state.startTime) {
    state.elapsed += Date.now() - state.startTime;
  }

  state.isRunning = false;
  state.startTime = null;

  this.save(state);
}
  resume() {
  const state = this.getState();

  state.isRunning = true;
  state.startTime = Date.now();

  this.save(state);
}

  stop() {
  const state = this.getState();

  // freeze current time first
  if (state.isRunning && state.startTime) {
    state.elapsed += Date.now() - state.startTime;
  }

  state.isRunning = false;
  state.startTime = null;

  // IMPORTANT: DO NOT reset elapsed
  this.save(state);
}

  getState(): SleepState {
    return this.sleepSubject.value;
  }

  private save(state: SleepState) {
    localStorage.setItem(this.stateKey, JSON.stringify(state));
    this.sleepSubject.next(state);
  }

  private loadState(): SleepState {
    const data = localStorage.getItem(this.stateKey);
    return data ? JSON.parse(data) : this.initialState;
  }
}
