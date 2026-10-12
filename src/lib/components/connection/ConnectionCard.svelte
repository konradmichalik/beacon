<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  import { X, Loader2 } from '@lucide/svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import type { PlatformStatus } from '$lib/types';

  let {
    name,
    icon,
    username,
    connected,
    error,
    platformStatus,
    isSubmitting,
    canSubmit,
    onConnect,
    onDisconnect,
    children
  }: {
    name: string;
    icon: Component<{ size?: number }>;
    username?: string;
    connected: boolean;
    error: string | null;
    platformStatus: PlatformStatus | null;
    isSubmitting: boolean;
    canSubmit: boolean;
    onConnect: () => void;
    onDisconnect: () => void;
    children: Snippet;
  } = $props();

  let Icon = $derived(icon);

  const TONE: Record<PlatformStatus['indicator'], { text: string; dot: string }> = {
    ok: { text: 'text-subtlest', dot: 'bg-success-text' },
    degraded: { text: 'text-warning', dot: 'bg-warning' },
    down: { text: 'text-destructive', dot: 'bg-destructive' }
  };
</script>

<div class="rounded-[10px] border border-border bg-card p-3.5">
  <div class="flex items-center gap-3">
    <div
      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-muted text-foreground"
    >
      <Icon size={18} />
    </div>
    <div class="min-w-0 flex-1">
      <div class="text-[13px] font-semibold text-foreground">{name}</div>
      <p class="text-xs text-subtlest">
        {connected ? (username ? `Signed in as @${username}` : 'Connected') : 'Not connected'}
      </p>
    </div>
    {#if connected}
      <Button variant="danger" onclick={onDisconnect}>Disconnect</Button>
    {/if}
  </div>

  {#if connected}
    {#if error}
      <p class="mt-3 flex items-center gap-1.5 text-xs text-warning">
        <X size={12} class="shrink-0" />
        {error}
      </p>
    {/if}
    {#if platformStatus}
      <div
        class="mt-3 flex items-center gap-1.5 border-t border-border pt-2.5 text-xs {TONE[
          platformStatus.indicator
        ].text}"
      >
        <span class="h-[7px] w-[7px] shrink-0 rounded-full {TONE[platformStatus.indicator].dot}"
        ></span>
        {platformStatus.indicator === 'ok' ? 'All systems operational' : platformStatus.description}
      </div>
    {/if}
  {:else}
    <div class="mt-3 flex flex-col gap-2.5">
      {@render children()}
      {#if error}
        <p role="alert" class="flex items-center gap-1.5 text-xs text-destructive">
          <X size={12} class="shrink-0" />
          {error}
        </p>
      {/if}
      <div class="flex justify-end">
        <Button variant="primary" onclick={onConnect} disabled={!canSubmit || isSubmitting}>
          {#if isSubmitting}
            <Loader2 size={12} class="animate-spin" aria-hidden="true" />
            <span class="sr-only">Connecting</span>
          {:else}
            Connect
          {/if}
        </Button>
      </div>
    </div>
  {/if}
</div>
