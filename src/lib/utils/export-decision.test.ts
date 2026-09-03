import { describe, it, expect } from 'vitest';
import { decideExport } from './export-decision';
import type { ExportDecisionInput } from './export-decision';

function makeInput(overrides: Partial<ExportDecisionInput> = {}): ExportDecisionInput {
  return {
    exportEnabled: true,
    displayName: 'Beacon',
    ttlSeconds: 300,
    notificationsLoaded: true,
    filteredNotifications: [],
    prsLoaded: true,
    filteredPRs: [],
    issuesEnabled: false,
    issuesLoaded: false,
    filteredIssues: [],
    now: new Date('2026-09-02T12:00:00Z'),
    ...overrides
  };
}

describe('decideExport', () => {
  it('skips with a specific reason when the export toggle is off', () => {
    expect(decideExport(makeInput({ exportEnabled: false }))).toEqual({
      action: 'skip',
      reason: 'export disabled'
    });
  });

  it('skips with a specific reason when notifications have not loaded yet', () => {
    expect(decideExport(makeInput({ notificationsLoaded: false }))).toEqual({
      action: 'skip',
      reason: 'notifications not loaded yet'
    });
  });

  it('skips with a specific reason when pull requests have not loaded yet', () => {
    expect(decideExport(makeInput({ prsLoaded: false }))).toEqual({
      action: 'skip',
      reason: 'pull requests not loaded yet'
    });
  });

  it('skips with a specific reason when issues are enabled but not yet loaded', () => {
    expect(decideExport(makeInput({ issuesEnabled: true, issuesLoaded: false }))).toEqual({
      action: 'skip',
      reason: 'issues not loaded yet'
    });
  });

  it('does not require issues to be loaded when the issues feature is disabled', () => {
    const decision = decideExport(makeInput({ issuesEnabled: false, issuesLoaded: false }));
    expect(decision.action).toBe('write');
  });

  it('decides to write with the built snapshot when every guard passes', () => {
    const decision = decideExport(makeInput());
    expect(decision).toMatchObject({
      action: 'write',
      snapshot: { schemaVersion: 1, app: 'beacon' }
    });
  });

  it('reports export-toggle-off ahead of the loaded-state checks', () => {
    // Enabled/disabled is checked first: a user who disabled export shouldn't
    // see a "not loaded yet" reason that has nothing to do with why nothing
    // is written.
    const decision = decideExport(
      makeInput({ exportEnabled: false, notificationsLoaded: false, prsLoaded: false })
    );
    expect(decision).toEqual({ action: 'skip', reason: 'export disabled' });
  });
});
