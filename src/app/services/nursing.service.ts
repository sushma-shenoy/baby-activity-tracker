import { Injectable } from '@angular/core';

export type NursingSide = 'left' | 'right';

export interface NursingSession {
  id: string;
  startedAt: number;
  endedAt: number;
  leftSeconds: number;
  rightSeconds: number;
  lastSide: NursingSide;
  notes: string;
}

export interface ActiveNursingSession {
  startedAt: number;
  activeSide: NursingSide | null;
  lastSide: NursingSide;
  leftSeconds: number;
  rightSeconds: number;
  activeSince: number | null;
}

@Injectable({ providedIn: 'root' })
export class NursingService {
  private readonly sessionsKey = 'nursing_sessions';
  private readonly activeKey = 'active_nursing_session';

  getSessions(): NursingSession[] {
    try {
      const value = JSON.parse(localStorage.getItem(this.sessionsKey) || '[]');
      return Array.isArray(value)
        ? value.map(session => ({ notes: '', ...session }))
        : [];
    } catch {
      return [];
    }
  }

  getActive(): ActiveNursingSession | null {
    try {
      const value = localStorage.getItem(this.activeKey);
      return value ? JSON.parse(value) as ActiveNursingSession : null;
    } catch {
      return null;
    }
  }

  startOrSwitch(side: NursingSide): ActiveNursingSession {
    const now = Date.now();
    const current = this.snapshot(now) ?? {
      startedAt: now,
      activeSide: null,
      lastSide: side,
      leftSeconds: 0,
      rightSeconds: 0,
      activeSince: null
    };
    const next: ActiveNursingSession = {
      ...current,
      activeSide: side,
      lastSide: side,
      activeSince: now
    };
    this.saveActive(next);
    return next;
  }

  pause(): ActiveNursingSession | null {
    const current = this.snapshot();
    if (!current) return null;
    const paused = { ...current, activeSide: null, activeSince: null };
    this.saveActive(paused);
    return paused;
  }

  finish(): NursingSession | null {
    const current = this.snapshot();
    if (!current || current.leftSeconds + current.rightSeconds < 1) return null;
    const session: NursingSession = {
      id: crypto.randomUUID(),
      startedAt: current.startedAt,
      endedAt: Date.now(),
      leftSeconds: current.leftSeconds,
      rightSeconds: current.rightSeconds,
      lastSide: current.lastSide,
      notes: ''
    };
    this.saveSession(session);
    localStorage.removeItem(this.activeKey);
    return session;
  }

  saveSession(session: NursingSession): void {
    if (
      !Number.isFinite(session.startedAt) ||
      session.startedAt > Date.now() + 60_000 ||
      session.leftSeconds < 0 ||
      session.rightSeconds < 0 ||
      session.leftSeconds + session.rightSeconds < 1 ||
      session.notes.trim().length > 240
    ) {
      throw new Error('Check the nursing duration, date, and notes.');
    }

    const normalized = {
      ...session,
      leftSeconds: Math.round(session.leftSeconds),
      rightSeconds: Math.round(session.rightSeconds),
      notes: session.notes.trim()
    };
    const sessions = this.getSessions();
    const updated = sessions.some(item => item.id === session.id)
      ? sessions.map(item => item.id === session.id ? normalized : item)
      : [normalized, ...sessions];
    localStorage.setItem(
      this.sessionsKey,
      JSON.stringify(updated.sort((a, b) => b.endedAt - a.endedAt))
    );
  }

  delete(id: string): void {
    localStorage.setItem(
      this.sessionsKey,
      JSON.stringify(this.getSessions().filter(session => session.id !== id))
    );
  }

  snapshot(now = Date.now()): ActiveNursingSession | null {
    const current = this.getActive();
    if (!current || !current.activeSide || !current.activeSince) return current;
    const elapsed = Math.max(0, Math.floor((now - current.activeSince) / 1000));
    return {
      ...current,
      leftSeconds:
        current.leftSeconds + (current.activeSide === 'left' ? elapsed : 0),
      rightSeconds:
        current.rightSeconds + (current.activeSide === 'right' ? elapsed : 0),
      activeSince: now
    };
  }

  private saveActive(session: ActiveNursingSession): void {
    localStorage.setItem(this.activeKey, JSON.stringify(session));
  }
}
