import { describe, it, expect } from 'vitest';
import { parseGitLabTargetUrl } from './gitlab-target';

describe('parseGitLabTargetUrl', () => {
  const GITLAB_COM = 'https://gitlab.com';

  it('parses a merge request URL', () => {
    expect(
      parseGitLabTargetUrl('https://gitlab.com/acme/project/-/merge_requests/42', GITLAB_COM)
    ).toEqual({
      projectPath: 'acme/project',
      targetType: 'merge_requests',
      iid: 42
    });
  });

  it('parses an issue URL', () => {
    expect(parseGitLabTargetUrl('https://gitlab.com/acme/project/-/issues/7', GITLAB_COM)).toEqual(
      {
        projectPath: 'acme/project',
        targetType: 'issues',
        iid: 7
      }
    );
  });

  it('handles a subgroup path', () => {
    expect(
      parseGitLabTargetUrl(
        'https://gitlab.com/acme/team/sub/project/-/merge_requests/1',
        GITLAB_COM
      )
    ).toEqual({
      projectPath: 'acme/team/sub/project',
      targetType: 'merge_requests',
      iid: 1
    });
  });

  it('strips the instance path prefix for a self-hosted instance under a sub-path', () => {
    expect(
      parseGitLabTargetUrl(
        'https://example.com/gitlab/acme/project/-/issues/3',
        'https://example.com/gitlab'
      )
    ).toEqual({
      projectPath: 'acme/project',
      targetType: 'issues',
      iid: 3
    });
  });

  it('decodes a percent-encoded project path once', () => {
    expect(
      parseGitLabTargetUrl('https://gitlab.com/acme/pro%20ject/-/issues/3', GITLAB_COM)
    ).toEqual({
      projectPath: 'acme/pro ject',
      targetType: 'issues',
      iid: 3
    });
  });

  it('ignores a trailing note anchor', () => {
    expect(
      parseGitLabTargetUrl(
        'https://gitlab.com/acme/project/-/merge_requests/42#note_123',
        GITLAB_COM
      )
    ).toEqual({
      projectPath: 'acme/project',
      targetType: 'merge_requests',
      iid: 42
    });
  });

  it('returns null for a pipeline URL', () => {
    expect(
      parseGitLabTargetUrl('https://gitlab.com/acme/project/-/pipelines/99', GITLAB_COM)
    ).toBeNull();
  });

  it('returns null for a URL without a /-/ marker', () => {
    expect(parseGitLabTargetUrl('https://gitlab.com/acme/project', GITLAB_COM)).toBeNull();
  });

  it('returns null for a malformed URL', () => {
    expect(parseGitLabTargetUrl('not a url', GITLAB_COM)).toBeNull();
  });

  it('falls back to the full pathname when baseUrl is malformed', () => {
    expect(
      parseGitLabTargetUrl('https://gitlab.com/acme/project/-/issues/3', 'not a url')
    ).toEqual({
      projectPath: 'acme/project',
      targetType: 'issues',
      iid: 3
    });
  });
});
