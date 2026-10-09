<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    label,
    onclick,
    disabled = false,
    active = false,
    expanded,
    el = $bindable(),
    class: className = '',
    children
  }: {
    label: string;
    onclick: (event: MouseEvent) => void;
    disabled?: boolean;
    active?: boolean;
    expanded?: boolean;
    el?: HTMLButtonElement;
    class?: string;
    children: Snippet;
  } = $props();
</script>

<button
  type="button"
  bind:this={el}
  {onclick}
  {disabled}
  aria-label={label}
  aria-expanded={expanded}
  title={label}
  class="relative flex h-7 min-w-7 items-center justify-center gap-0.5 rounded-md px-1.5 transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35 {active
    ? 'bg-muted text-foreground'
    : 'text-muted-foreground'} {className}"
>
  {@render children()}
</button>
