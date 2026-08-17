import { describe, it, expect, beforeEach } from 'vitest';
import { platformStatusState, updatePlatformStatusFromBackend } from './platform-status.svelte';

describe('platform status store', () => {
  beforeEach(() => {
    updatePlatformStatusFromBackend({ github: null, gitlab: null });
  });

  it('is null for both services before any update', () => {
    expect(platformStatusState.github).toBeNull();
    expect(platformStatusState.gitlab).toBeNull();
  });

  it('stores the status reported for each service', () => {
    updatePlatformStatusFromBackend({
      github: { indicator: 'down', description: 'Major outage' },
      gitlab: { indicator: 'ok', description: 'All systems operational' }
    });

    expect(platformStatusState.github).toEqual({
      indicator: 'down',
      description: 'Major outage'
    });
    expect(platformStatusState.gitlab).toEqual({
      indicator: 'ok',
      description: 'All systems operational'
    });
  });

  it('clears a service back to null once it is no longer connected', () => {
    updatePlatformStatusFromBackend({
      github: { indicator: 'degraded', description: 'Partial outage' },
      gitlab: null
    });
    updatePlatformStatusFromBackend({ github: null, gitlab: null });

    expect(platformStatusState.github).toBeNull();
  });
});
