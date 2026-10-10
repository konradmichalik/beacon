<script lang="ts">
  import { ExternalLink, Gitlab } from '@lucide/svelte';
  import TextField from '$lib/components/ui/TextField.svelte';
  import ConnectionCard from './ConnectionCard.svelte';
  import {
    connectionsState,
    connectGitLabWithPAT,
    disconnectService,
    getGitLabConfig
  } from '$lib/stores/connections.svelte';
  import { platformStatusState } from '$lib/stores/platform-status.svelte';
  import { isTauri } from '$lib/utils/storage';

  let token = $state('');
  let baseUrl = $state('https://gitlab.com');
  let isSubmitting = $state(false);
  const helpId = $props.id();

  let status = $derived(connectionsState.gitlab.status);

  // The polled status is always for gitlab.com's public status page — showing
  // it for a self-hosted instance would misattribute an unrelated incident.
  let isGitLabCom = $derived.by(() => {
    if (status !== 'connected') return false;
    try {
      return new URL(getGitLabConfig()?.baseUrl ?? '').hostname === 'gitlab.com';
    } catch {
      return false;
    }
  });

  let tokenHost = $derived.by(() => {
    try {
      return new URL(baseUrl).hostname;
    } catch {
      return 'GitLab';
    }
  });

  async function handleConnect(): Promise<void> {
    if (!token.trim() || !baseUrl.trim()) return;
    isSubmitting = true;
    await connectGitLabWithPAT(token.trim(), baseUrl.trim());
    isSubmitting = false;
    if (connectionsState.gitlab.status === 'connected') {
      token = '';
    }
  }

  async function openTokenPage(): Promise<void> {
    const base = baseUrl.trim().replace(/\/$/, '');
    const url = `${base}/-/user_settings/personal_access_tokens?name=Beacon&scopes=api`;
    if (isTauri()) {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(url);
    } else {
      window.open(url, '_blank');
    }
  }
</script>

<ConnectionCard
  name="GitLab"
  icon={Gitlab}
  username={getGitLabConfig()?.username}
  connected={status === 'connected'}
  error={connectionsState.gitlab.error}
  platformStatus={isGitLabCom ? platformStatusState.gitlab : null}
  {isSubmitting}
  canSubmit={token.trim() !== '' && baseUrl.trim() !== ''}
  onConnect={handleConnect}
  onDisconnect={() => disconnectService('gitlab')}
>
  <TextField
    label="Instance URL"
    type="url"
    bind:value={baseUrl}
    placeholder="https://gitlab.com"
  />
  <TextField
    label="Personal access token"
    type="password"
    bind:value={token}
    placeholder="glpat-…"
    describedBy={helpId}
  />
  <p id={helpId} class="-mt-1 text-xs text-subtlest">
    <button
      type="button"
      onclick={openTokenPage}
      class="inline-flex items-center gap-0.5 font-medium text-accent-foreground underline underline-offset-2"
    >
      Create a token on {tokenHost}
      <ExternalLink size={10} />
    </button>
    with the <code class="rounded bg-muted px-1">api</code> scope.
  </p>
</ConnectionCard>
