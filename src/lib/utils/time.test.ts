import { describe, it, expect, vi, afterEach } from 'vitest';
import { timeAgo, formatRefreshTime, formatWakeTime } from './time';

afterEach(() => {
  vi.useRealTimers();
});

describe('timeAgo', () => {
  it('returns "just now" for timestamps less than 60 seconds ago', () => {
    const now = new Date().toISOString();
    expect(timeAgo(now)).toBe('just now');
  });

  it('returns minutes for timestamps less than an hour ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-17T12:00:00Z'));
    expect(timeAgo('2026-03-17T11:45:00Z')).toBe('15m ago');
    expect(timeAgo('2026-03-17T11:58:00Z')).toBe('2m ago');
  });

  it('returns hours for timestamps less than a day ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-17T12:00:00Z'));
    expect(timeAgo('2026-03-17T09:00:00Z')).toBe('3h ago');
  });

  it('returns days for timestamps less than a week ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-17T12:00:00Z'));
    expect(timeAgo('2026-03-15T12:00:00Z')).toBe('2d ago');
  });

  it('returns formatted date for timestamps older than a week', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-17T12:00:00Z'));
    const result = timeAgo('2026-03-01T12:00:00Z');
    // Should contain "1" and "März" or "Mar" depending on locale
    expect(result).toMatch(/1/);
  });

  it('includes year for timestamps from a different year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-17T12:00:00Z'));
    const result = timeAgo('2025-06-15T12:00:00Z');
    expect(result).toMatch(/2025/);
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
