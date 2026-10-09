import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logoMotion, playLogo } from './logo-motion.svelte';

describe('logo motion', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts without an animation', () => {
    expect(logoMotion.kind).toBeNull();
  });

  it('plays the requested animation after a short restart gap', () => {
    playLogo('open');
    expect(logoMotion.kind).toBeNull();
    vi.advanceTimersByTime(40);
    expect(logoMotion.kind).toBe('open');
  });

  it('clears a running animation first so the same one can replay', () => {
    playLogo('pulse');
    vi.advanceTimersByTime(40);
    expect(logoMotion.kind).toBe('pulse');

    playLogo('pulse');
    expect(logoMotion.kind).toBeNull();
    vi.advanceTimersByTime(40);
    expect(logoMotion.kind).toBe('pulse');
  });

  it('lets the latest request win when two arrive quickly', () => {
    playLogo('open');
    playLogo('pulse');
    vi.advanceTimersByTime(40);
    expect(logoMotion.kind).toBe('pulse');
  });
});
