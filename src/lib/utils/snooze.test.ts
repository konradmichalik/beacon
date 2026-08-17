import { describe, it, expect } from 'vitest';
import { presetUntil, shouldWake, type SnoozeEntry } from './snooze';

describe('presetUntil', () => {
  it('1h resolves to exactly one hour later', () => {
    const now = new Date('2026-08-17T10:00:00');
    expect(presetUntil('1h', now).toISOString()).toBe(
      new Date('2026-08-17T11:00:00').toISOString()
    );
  });

  it('tomorrow resolves to 9:00 the next day, regardless of current time', () => {
    const now = new Date('2026-08-17T23:30:00');
    const result = presetUntil('tomorrow', now);
    expect(result.getDate()).toBe(18);
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(0);
  });

  it('monday resolves to the next Monday when today is mid-week', () => {
    // 2026-08-17 is a Monday; Wednesday the 19th should roll to Monday the 24th.
    const wednesday = new Date('2026-08-19T12:00:00');
    const result = presetUntil('monday', wednesday);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(24);
    expect(result.getHours()).toBe(9);
  });

  it('monday always rolls to the *next* Monday when today already is one', () => {
    const monday = new Date('2026-08-17T08:00:00');
    const result = presetUntil('monday', monday);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(24);
  });

  it('monday resolves correctly from a Sunday', () => {
    const sunday = new Date('2026-08-16T12:00:00');
    const result = presetUntil('monday', sunday);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(17);
  });
});

function entry(overrides: Partial<SnoozeEntry> = {}): SnoozeEntry {
  return {
    until: '2026-08-18T09:00:00.000Z',
    snapshotUpdatedAt: '2026-08-17T10:00:00.000Z',
    wakeOnUpdate: true,
    ...overrides
  };
}

describe('shouldWake', () => {
  it('is false before the timer expires and nothing changed', () => {
    const now = new Date('2026-08-17T12:00:00Z').getTime();
    expect(shouldWake(entry(), '2026-08-17T10:00:00.000Z', now)).toBe(false);
  });

  it('is true once the timer expires', () => {
    const now = new Date('2026-08-18T09:00:01Z').getTime();
    expect(shouldWake(entry(), '2026-08-17T10:00:00.000Z', now)).toBe(true);
  });

  it('is true when updatedAt advances and wakeOnUpdate is enabled', () => {
    const now = new Date('2026-08-17T12:00:00Z').getTime();
    expect(shouldWake(entry({ wakeOnUpdate: true }), '2026-08-17T11:00:00.000Z', now)).toBe(true);
  });

  it('stays asleep on activity when wakeOnUpdate is disabled', () => {
    const now = new Date('2026-08-17T12:00:00Z').getTime();
    expect(shouldWake(entry({ wakeOnUpdate: false }), '2026-08-17T11:00:00.000Z', now)).toBe(false);
  });
});
