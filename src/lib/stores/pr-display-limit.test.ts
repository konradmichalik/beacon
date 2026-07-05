import { describe, it, expect, beforeEach } from 'vitest';
import { getPRDisplayLimit, loadMorePRs, resetPRDisplayLimit } from './pull-requests.svelte';

describe('PR display limit', () => {
  beforeEach(() => resetPRDisplayLimit());

  it('starts at 30', () => {
    expect(getPRDisplayLimit()).toBe(30);
  });

  it('adds 30 per load-more', () => {
    loadMorePRs();
    expect(getPRDisplayLimit()).toBe(60);
    loadMorePRs();
    expect(getPRDisplayLimit()).toBe(90);
  });

  it('resets back to the initial limit', () => {
    loadMorePRs();
    loadMorePRs();
    resetPRDisplayLimit();
    expect(getPRDisplayLimit()).toBe(30);
  });
});
