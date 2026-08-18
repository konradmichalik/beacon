import { describe, it, expect } from 'vitest';
import { parseGitLabTargetUrl } from './gitlab-target';

describe('parseGitLabTargetUrl', () => {
  it('parses a merge request URL', () => {
    expect(parseGitLabTargetUrl('https://gitlab.com/acme/project/-/merge_requests/42')).toEqual({
      projectPath: 'acme/project',
      targetType: 'merge_requests',
      iid: 42
    });
  });

  it('parses an issue URL', () => {
    expect(parseGitLabTargetUrl('https://gitlab.com/acme/project/-/issues/7')).toEqual({
      projectPath: 'acme/project',
      targetType: 'issues',
      iid: 7
    });
  });

  it('handles a subgroup path', () => {
    expect(
      parseGitLabTargetUrl('https://gitlab.com/acme/team/sub/project/-/merge_requests/1')
    ).toEqual({
      projectPath: 'acme/team/sub/project',
      targetType: 'merge_requests',
      iid: 1
    });
  });

  it('handles a self-hosted instance with a sub-path', () => {
    expect(parseGitLabTargetUrl('https://example.com/gitlab/acme/project/-/issues/3')).toEqual({
      projectPath: 'gitlab/acme/project',
      targetType: 'issues',
      iid: 3
    });
  });

  it('ignores a trailing note anchor', () => {
    expect(
      parseGitLabTargetUrl('https://gitlab.com/acme/project/-/merge_requests/42#note_123')
    ).toEqual({
      projectPath: 'acme/project',
      targetType: 'merge_requests',
      iid: 42
    });
  });

  it('returns null for a pipeline URL', () => {
    expect(parseGitLabTargetUrl('https://gitlab.com/acme/project/-/pipelines/99')).toBeNull();
  });

  it('returns null for a URL without a /-/ marker', () => {
    expect(parseGitLabTargetUrl('https://gitlab.com/acme/project')).toBeNull();
  });

  it('returns null for a malformed URL', () => {
    expect(parseGitLabTargetUrl('not a url')).toBeNull();
  });
});
