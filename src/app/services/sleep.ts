import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface SleepState {
  isRunning: boolean;
  startTime: number | null;
  elapsed: number;

  sessionActive: boolean;   // session exists
}

@Injectable({ providedIn: 'root' })
export class SleepService {

  private readonly initialState: SleepState = {
    isRunning: false,
    startTime: null,
    elapsed: 0,
    sessionActive: false
  };

  private stateKey = 'sleep_state';

  private sleepSubject = new BehaviorSubject<SleepState>(this.loadState());
  sleep$ = this.sleepSubject.asObservable();

  start(): void {
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
  reset() : void{
  const resetState = {
    isRunning: false,
    startTime: null,
    elapsed: 0,
    sessionActive: false
  };

  localStorage.removeItem('sleep_state'); // IMPORTANT
  this.sleepSubject.next(resetState);
}

  pause(): void {
  const state = this.getState();

  if (state.startTime) {
    state.elapsed += Date.now() - state.startTime;
  }

  state.isRunning = false;
  state.startTime = null;

  this.save(state);
}
  resume(): void {
  const state = this.getState();

  state.isRunning = true;
  state.startTime = Date.now();

  this.save(state);
}

  stop(): void {
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

  private save(state: SleepState) : void{
    localStorage.setItem(this.stateKey, JSON.stringify(state));
    this.sleepSubject.next(state);
  }

  private loadState(): SleepState {
    try {
      const data = localStorage.getItem(this.stateKey);
      if (!data) return { ...this.initialState };
      const value = JSON.parse(data) as Partial<SleepState>;
      const elapsed = Number(value.elapsed);
      const startTime =
        value.startTime === null ? null : Number(value.startTime);
      const validStartTime =
        startTime === null ||
        (
          Number.isFinite(startTime) &&
          startTime <= Date.now() + 60_000
        );

      if (
        typeof value.isRunning !== 'boolean' ||
        typeof value.sessionActive !== 'boolean' ||
        !Number.isFinite(elapsed) ||
        elapsed < 0 ||
        !validStartTime
      ) {
        return { ...this.initialState };
      }

      return {
        isRunning: value.isRunning && startTime !== null,
        sessionActive: value.sessionActive,
        elapsed,
        startTime
      };
    } catch {
      return { ...this.initialState };
    }
  }
}
