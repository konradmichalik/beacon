<script lang="ts">
  import type { Snippet } from 'svelte';

  let { label, help, children }: { label: string; help?: string; children?: Snippet } = $props();
</script>

<div class="flex min-h-11 items-center gap-4 px-3.5 py-2.5">
  <div class="min-w-0 flex-1">
    <div class="text-[13px] text-foreground">{label}</div>
    {#if help}
      <p class="mt-0.5 text-xs leading-4 text-subtlest">{help}</p>
    {/if}
  </div>
  {#if children}
    <div class="shrink-0">{@render children()}</div>
  {/if}
</div>
