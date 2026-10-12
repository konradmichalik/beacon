import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toastState, showToast, dismissToast, runToastAction } from './toast.svelte';

describe('toast store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    dismissToast();
    vi.advanceTimersByTime(300);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a message and hides it after the default duration', () => {
    showToast('Marked as read');
    expect(toastState.message).toBe('Marked as read');
    vi.advanceTimersByTime(3600);
    expect(toastState.leaving).toBe(true);
    vi.advanceTimersByTime(250);
    expect(toastState.message).toBeNull();
  });

  it('honours a custom duration', () => {
    showToast('Quick', { duration: 1000 });
    vi.advanceTimersByTime(999);
    expect(toastState.leaving).toBe(false);
    vi.advanceTimersByTime(2);
    expect(toastState.leaving).toBe(true);
  });

  it('exposes the action while the toast is shown', () => {
    const onAction = vi.fn();
    showToast('3 marked as read', { action: { label: 'Undo', onAction } });
    expect(toastState.action?.label).toBe('Undo');
  });

  it('runs the action once and dismisses the toast', () => {
    const onAction = vi.fn();
    showToast('3 marked as read', { action: { label: 'Undo', onAction } });
    runToastAction();
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(toastState.leaving).toBe(true);
    vi.advanceTimersByTime(250);
    expect(toastState.message).toBeNull();
    expect(toastState.action).toBeNull();
  });

  it('does nothing when the toast has no action', () => {
    showToast('Plain');
    runToastAction();
    expect(toastState.message).toBe('Plain');
  });

  it('replaces a running toast and its timers', () => {
    showToast('First', { duration: 1000 });
    vi.advanceTimersByTime(900);
    showToast('Second', { duration: 1000 });
    vi.advanceTimersByTime(900);
    expect(toastState.message).toBe('Second');
    expect(toastState.leaving).toBe(false);
  });
});
