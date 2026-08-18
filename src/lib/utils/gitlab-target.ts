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
 *
 * `baseUrl` is the connection's configured GitLab origin, which may itself
 * include a path prefix (self-hosted instances mounted under a sub-path). That
 * prefix isn't part of the project namespace and must be stripped before the
 * `/-/` marker is located, or a namespaced instance resolves to a project path
 * that doesn't exist.
 */
export function parseGitLabTargetUrl(url: string, baseUrl: string): GitLabTarget | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  let pathname = parsed.pathname;
  try {
    const basePath = new URL(baseUrl).pathname.replace(/\/+$/, '');
    if (basePath && pathname.startsWith(basePath)) {
      pathname = pathname.slice(basePath.length);
    }
  } catch {
    // Unparseable baseUrl — fall back to the full pathname.
  }

  const [projectPart, afterMarker] = pathname.split('/-/');
  if (!afterMarker) return null;

  const match = afterMarker.match(TARGET_SEGMENT);
  if (!match) return null;

  // Decode once here so callers that re-encode (e.g. for a URL path segment)
  // don't double-encode a project path containing a percent-encoded character.
  const projectPath = decodeURIComponent(projectPart.replace(/^\/+/, '').replace(/\/+$/, ''));
  if (!projectPath) return null;

  return {
    projectPath,
    targetType: match[1] as 'merge_requests' | 'issues',
    iid: Number(match[2])
  };
}
