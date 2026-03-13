<script lang="ts">
  import { Check, X, Loader2, ExternalLink } from '@lucide/svelte';
  import GitHubIcon from '$lib/components/icons/GitHubIcon.svelte';
  import {
    connectionsState,
    connectGitHubWithPAT,
    disconnectService
  } from '$lib/stores/connections.svelte';
  import { isTauri } from '$lib/utils/storage';

  let token = $state('');
  let isSubmitting = $state(false);

  let status = $derived(connectionsState.github.status);
  let error = $derived(connectionsState.github.error);

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
    const url = 'https://github.com/settings/tokens/new?description=Beacon&scopes=notifications,read:user';
    if (isTauri()) {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(url);
    } else {
      window.open(url, '_blank');
    }
  }

  async function handleDisconnect(): Promise<void> {
    await disconnectService('github');
  }
</script>

<div class="rounded-lg border border-border bg-card p-3">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      <GitHubIcon size={14} class="text-source-github-text" />
      <span class="text-xs font-medium">GitHub</span>
    </div>
    {#if status === 'connected'}
      <div class="flex items-center gap-1.5">
        <Check size={12} class="text-success-text" />
        <button
          type="button"
          onclick={handleDisconnect}
          class="text-[10px] text-muted-foreground hover:text-destructive"
        >
          Disconnect
        </button>
      </div>
    {/if}
  </div>

  {#if status === 'connected'}
    <!-- Connected, nothing to show -->
  {:else}
    <div class="mt-2 space-y-2">
      <input
        type="password"
        bind:value={token}
        placeholder="Personal Access Token"
        class="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
      />
      <p class="text-[10px] text-muted-foreground">
        <button
          type="button"
          onclick={openTokenPage}
          class="inline-flex items-center gap-0.5 text-primary underline underline-offset-2 hover:text-primary/80"
        >
          Create a token on GitHub
          <ExternalLink size={8} />
        </button>
        with <code class="rounded bg-secondary px-1">notifications</code> scope.
      </p>
      <button
        type="button"
        onclick={handleConnect}
        disabled={!token.trim() || isSubmitting}
        class="w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {#if isSubmitting}
          <Loader2 size={12} class="inline animate-spin" />
        {:else}
          Connect
        {/if}
      </button>

      {#if error}
        <p class="flex items-center gap-1 text-[10px] text-destructive">
          <X size={10} />
          {error}
        </p>
      {/if}
    </div>
  {/if}
</div>
