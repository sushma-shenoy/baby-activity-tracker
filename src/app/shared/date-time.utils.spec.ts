import {
  dateForTimeToday,
  formatTime24,
  isValidTime24
} from './date-time.utils';

describe('date-time utilities', () => {
  it('formats time without depending on the device locale', () => {
    const date = new Date(2026, 6, 30, 14, 5);

    expect(formatTime24(date)).toBe('14:05');
  });

  it('creates a local same-day date from a valid time', () => {
    const today = new Date(2026, 6, 30, 8, 0);
    const result = dateForTimeToday('14:35', today);

    expect(result?.getFullYear()).toBe(2026);
    expect(result?.getMonth()).toBe(6);
    expect(result?.getDate()).toBe(30);
    expect(result?.getHours()).toBe(14);
    expect(result?.getMinutes()).toBe(35);
  });

  it('rejects locale-formatted and invalid times', () => {
    expect(isValidTime24('2:35 PM')).toBeFalse();
    expect(dateForTimeToday('25:00')).toBeNull();
  });
});
