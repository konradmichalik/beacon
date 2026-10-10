import { describe, it, expect, vi, afterEach } from 'vitest';
import { timeShort, formatRefreshTime, formatWakeTime } from './time';

afterEach(() => {
  vi.useRealTimers();
});

describe('timeShort', () => {
  it('returns "now" for timestamps less than 60 seconds ago', () => {
    expect(timeShort(new Date().toISOString())).toBe('now');
  });

  it('returns minutes, hours and days without a suffix word', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-17T12:00:00Z'));
    expect(timeShort('2026-03-17T11:45:00Z')).toBe('15m');
    expect(timeShort('2026-03-17T11:58:00Z')).toBe('2m');
    expect(timeShort('2026-03-17T09:00:00Z')).toBe('3h');
    expect(timeShort('2026-03-15T12:00:00Z')).toBe('2d');
  });

  it('returns an English short date for timestamps older than a week', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-17T12:00:00Z'));
    expect(timeShort(new Date(2026, 2, 1, 12).toISOString())).toBe('1 Mar');
  });

  it('includes the year for timestamps from a different year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-17T12:00:00Z'));
    expect(timeShort(new Date(2025, 5, 15, 12).toISOString())).toBe('15 Jun 2025');
  });
});

describe('formatWakeTime', () => {
  it('includes date and time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T12:00:00Z'));
    const result = formatWakeTime('2026-08-18T09:00:00Z');
    expect(result).toMatch(/18/);
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it('includes year for a wake time in a different year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T12:00:00Z'));
    const result = formatWakeTime('2027-01-04T09:00:00Z');
    expect(result).toMatch(/2027/);
  });
});

describe('formatRefreshTime', () => {
  it('returns "Never" for null input', () => {
    expect(formatRefreshTime(null)).toBe('Never');
  });

  it('returns formatted time for valid date string', () => {
    const result = formatRefreshTime('2026-03-17T14:30:00Z');
    // Should be in HH:MM format (de-DE locale)
    expect(result).toMatch(/\d{2}:\d{2}/);
  });
});
