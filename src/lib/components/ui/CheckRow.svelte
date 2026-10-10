<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    checked,
    onchange,
    label,
    count = 0,
    dimmed = false,
    leading
  }: {
    checked: boolean;
    onchange: () => void;
    label: string;
    count?: number;
    dimmed?: boolean;
    leading?: Snippet;
  } = $props();
</script>

<label
  class="flex h-7 cursor-pointer items-center gap-2 rounded-md px-1.5 text-xs transition-colors hover:bg-surface-hovered"
>
  <input
    type="checkbox"
    {checked}
    {onchange}
    class="h-3.5 w-3.5 shrink-0 rounded border-input accent-primary"
  />
  {@render leading?.()}
  <span
    class="min-w-0 flex-1 truncate {checked
      ? 'font-medium text-foreground'
      : dimmed
        ? 'text-subtlest'
        : 'text-foreground'}"
  >
    {label}
  </span>
  {#if count > 0}
    <span class="shrink-0 text-[11px] tabular-nums text-subtlest">{count}</span>
  {/if}
</label>
