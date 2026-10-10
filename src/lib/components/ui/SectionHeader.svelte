<script lang="ts">
  import type { Component } from 'svelte';
  import { ChevronRight } from '@lucide/svelte';
  import { bump } from '$lib/actions/bump';

  let {
    label,
    count,
    icon,
    iconClass = '',
    expanded = true,
    onclick,
    sticky = 'top'
  }: {
    label: string;
    count: number;
    icon?: Component<{ size?: number; class?: string }>;
    iconClass?: string;
    expanded?: boolean;
    onclick?: () => void;
    sticky?: 'top' | 'bottom' | 'none';
  } = $props();

  const STICKY = { top: 'sticky top-0 z-10', bottom: 'sticky bottom-0 z-10', none: '' };
  const base =
    'flex h-8 w-full shrink-0 items-center gap-2 border-b border-border bg-background/90 px-4 text-left text-[11.5px] font-semibold text-muted-foreground backdrop-blur-sm';

  let Icon = $derived(icon);
</script>

{#snippet content()}
  {#if onclick}
    <ChevronRight
      size={12}
      class="shrink-0 transition-transform duration-[var(--dur-base)] {expanded ? 'rotate-90' : ''}"
    />
  {/if}
  {#if Icon}
    <Icon size={12} class="shrink-0 {iconClass}" />
  {/if}
  <span class="min-w-0 truncate">{label}</span>
  <span
    use:bump={count}
    class="ml-auto inline-flex h-4 min-w-[18px] shrink-0 items-center justify-center rounded-full bg-muted px-[5px] text-[10.5px] font-semibold tabular-nums"
  >
    {count}
  </span>
{/snippet}

{#if onclick}
  <button
    type="button"
    aria-expanded={expanded}
    {onclick}
    class="{base} {STICKY[sticky]} transition-colors hover:bg-surface-hovered"
  >
    {@render content()}
  </button>
{:else}
  <div class="{base} {STICKY[sticky]}">
    {@render content()}
  </div>
{/if}
