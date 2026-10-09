<script lang="ts">
  import { ExternalLink } from '@lucide/svelte';
  import GitHubIcon from '$lib/components/icons/GitHubIcon.svelte';
  import TextField from '$lib/components/ui/TextField.svelte';
  import ConnectionCard from './ConnectionCard.svelte';
  import {
    connectionsState,
    connectGitHubWithPAT,
    disconnectService,
    getGitHubConfig
  } from '$lib/stores/connections.svelte';
  import { platformStatusState } from '$lib/stores/platform-status.svelte';
  import { isTauri } from '$lib/utils/storage';

  let token = $state('');
  let isSubmitting = $state(false);
  const helpId = $props.id();

  let status = $derived(connectionsState.github.status);

  async function handleConnect(): Promise<void> {
    if (!token.trim()) return;
    isSubmitting = true;
    await connectGitHubWithPAT(token.trim());
    isSubmitting = false;
    if (connectionsState.github.status === 'connected') {
      token = '';
    }
  }

  async function openTokenPage(): Promise<void> {
    const url =
      'https://github.com/settings/tokens/new?description=Beacon&scopes=notifications,read:user';
    if (isTauri()) {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(url);
    } else {
      window.open(url, '_blank');
    }
  }
</script>

<ConnectionCard
  name="GitHub"
  icon={GitHubIcon}
  username={getGitHubConfig()?.username}
  connected={status === 'connected'}
  error={connectionsState.github.error}
  platformStatus={platformStatusState.github}
  {isSubmitting}
  canSubmit={token.trim() !== ''}
  onConnect={handleConnect}
  onDisconnect={() => disconnectService('github')}
>
  <TextField
    label="Personal access token"
    type="password"
    bind:value={token}
    placeholder="ghp_…"
    describedBy={helpId}
  />
  <p id={helpId} class="-mt-1 text-xs text-subtlest">
    <button
      type="button"
      onclick={openTokenPage}
      class="inline-flex items-center gap-0.5 font-medium text-accent-foreground underline underline-offset-2"
    >
      Create a token on GitHub
      <ExternalLink size={10} />
    </button>
    with the <code class="rounded bg-muted px-1">notifications</code> scope.
  </p>
</ConnectionCard>
