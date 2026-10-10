import { describe, it, expect } from 'vitest';
import { repoShortName } from './repository';

describe('repoShortName', () => {
  it('keeps the last two path segments', () => {
    expect(repoShortName('group/sub/project')).toBe('sub/project');
    expect(repoShortName('owner/repo')).toBe('owner/repo');
  });

  it('leaves a single segment alone', () => {
    expect(repoShortName('project')).toBe('project');
  });
});
