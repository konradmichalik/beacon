<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    variant = 'secondary',
    href,
    onclick,
    disabled = false,
    class: className = '',
    children
  }: {
    variant?: 'primary' | 'secondary' | 'danger';
    href?: string;
    onclick?: (event: MouseEvent) => void;
    disabled?: boolean;
    class?: string;
    children: Snippet;
  } = $props();

  const VARIANTS = {
    primary:
      'bg-primary font-semibold text-primary-foreground hover:bg-[var(--ds-background-brand-bold-hovered)]',
    secondary:
      'border border-border-strong bg-card font-medium text-foreground hover:bg-surface-hovered',
    danger:
      'border border-border-strong bg-card font-medium text-destructive hover:bg-destructive-bg'
  };
  const base =
    'inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5 text-[12.5px] transition-colors disabled:pointer-events-none disabled:opacity-40';
</script>

{#if href}
  <a
    {href}
    target="_blank"
    rel="noopener noreferrer"
    class="{base} {VARIANTS[variant]} {className}"
  >
    {@render children()}
  </a>
{:else}
  <button type="button" {onclick} {disabled} class="{base} {VARIANTS[variant]} {className}">
    {@render children()}
  </button>
{/if}
