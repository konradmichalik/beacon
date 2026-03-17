<script lang="ts">
  import { Gitlab, Check, X, Loader2, ExternalLink } from '@lucide/svelte';
  import {
    connectionsState,
    connectGitLabWithPAT,
    disconnectService
  } from '$lib/stores/connections.svelte';
  import { isTauri } from '$lib/utils/storage';

  let token = $state('');
  let baseUrl = $state('https://gitlab.com');
  let isSubmitting = $state(false);

  let status = $derived(connectionsState.gitlab.status);
  let error = $derived(connectionsState.gitlab.error);

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

  async function handleDisconnect(): Promise<void> {
    await disconnectService('gitlab');
  }
</script>

<div class="rounded-lg border border-border bg-card p-3">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      <Gitlab size={14} class="text-source-gitlab-text" />
      <span class="text-xs font-medium">GitLab</span>
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
        type="url"
        bind:value={baseUrl}
        placeholder="https://gitlab.com"
        class="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
      />
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
          Create a token on {tokenHost}
          <ExternalLink size={8} />
        </button>
        with <code class="rounded bg-secondary px-1">api</code> scope.
      </p>
      <button
        type="button"
        onclick={handleConnect}
        disabled={!token.trim() || !baseUrl.trim() || isSubmitting}
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
