export interface GitLabTarget {
  readonly projectPath: string;
  readonly targetType: 'merge_requests' | 'issues';
  readonly iid: number;
}

const TARGET_SEGMENT = /^(merge_requests|issues)\/(\d+)/;

/**
 * Extracts the project path, target type, and iid from a GitLab todo's
 * target_url (e.g. `.../group/subgroup/project/-/merge_requests/42`).
 * `UnifiedNotification` carries neither the iid nor the raw target_type, so
 * this is the only way to recover them for actions that need them (like
 * unsubscribe). Returns null for target types this can't act on (pipelines,
 * unrecognized URLs) so callers can disable the action instead of failing.
 */
export function parseGitLabTargetUrl(url: string): GitLabTarget | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const [projectPart, afterMarker] = parsed.pathname.split('/-/');
  if (!afterMarker) return null;

  const match = afterMarker.match(TARGET_SEGMENT);
  if (!match) return null;

  const projectPath = projectPart.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!projectPath) return null;

  return {
    projectPath,
    targetType: match[1] as 'merge_requests' | 'issues',
    iid: Number(match[2])
  };
}
