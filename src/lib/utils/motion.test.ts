import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  motionMs,
  staggerDelay,
  swipeStyle,
  riseStyle,
  popStyle,
  setTabDirection,
  currentTabDirection
} from './motion';

function mockReducedMotion(reduce: boolean): void {
  vi.stubGlobal('window', {
    matchMedia: (query: string) => ({ matches: reduce && query.includes('reduce') })
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('motionMs', () => {
  it('keeps the duration when motion is allowed', () => {
    mockReducedMotion(false);
    expect(motionMs(280)).toBe(280);
  });

  it('is zero under Reduce Motion', () => {
    mockReducedMotion(true);
    expect(motionMs(280)).toBe(0);
  });

  it('keeps the duration where matchMedia does not exist', () => {
    vi.stubGlobal('window', {});
    expect(motionMs(200)).toBe(200);
  });
});

describe('staggerDelay', () => {
  it('delays each row by 30ms', () => {
    mockReducedMotion(false);
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(1)).toBe(30);
    expect(staggerDelay(4)).toBe(120);
  });

  it('staggers at most seven rows', () => {
    mockReducedMotion(false);
    expect(staggerDelay(7)).toBe(210);
    expect(staggerDelay(40)).toBe(210);
  });

  it('has no delay under Reduce Motion', () => {
    mockReducedMotion(true);
    expect(staggerDelay(5)).toBe(0);
  });
});

describe('swipeStyle', () => {
  it('starts untouched', () => {
    expect(swipeStyle(0, 80)).toContain('translateX(0px)');
    expect(swipeStyle(0, 80)).toContain('height: 80px');
    expect(swipeStyle(0, 80)).toContain('opacity: 1');
  });

  it('has moved away and faded before the height is gone', () => {
    const style = swipeStyle(0.55, 80);
    expect(style).toContain('translateX(36px)');
    expect(style).toContain('opacity: 0');
    expect(style).not.toContain('height: 0px');
  });

  it('ends fully collapsed', () => {
    const style = swipeStyle(1, 80);
    expect(style).toContain('height: 0px');
    expect(style).toContain('opacity: 0');
  });

  it('hides overflow so the height can collapse', () => {
    expect(swipeStyle(0.5, 80)).toContain('overflow: hidden');
  });
});

describe('riseStyle', () => {
  it('starts offset and transparent, ends in place', () => {
    expect(riseStyle(1, 0, 6)).toContain('opacity: 0');
    expect(riseStyle(1, 0, 6)).toContain('translate(0px, 6px)');
    expect(riseStyle(0, 0, 6)).toContain('opacity: 1');
    expect(riseStyle(0, 0, 6)).toContain('translate(0px, 0px)');
  });

  it('enters from the side of a tab change', () => {
    expect(riseStyle(1, 16, 0)).toContain('translate(16px, 0px)');
  });
});

describe('popStyle', () => {
  it('scales up from 0.96 and fades in', () => {
    expect(popStyle(1)).toContain('opacity: 0');
    expect(popStyle(1)).toContain('scale(0.96)');
    expect(popStyle(0)).toContain('opacity: 1');
    expect(popStyle(0)).toContain('scale(1)');
  });
});

describe('tab direction', () => {
  it('is remembered for a moment and then reset', () => {
    vi.useFakeTimers();
    setTabDirection(1);
    expect(currentTabDirection()).toBe(1);
    vi.advanceTimersByTime(700);
    expect(currentTabDirection()).toBe(0);
  });
});
