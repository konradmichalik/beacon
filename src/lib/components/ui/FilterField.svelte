<script lang="ts">
  import type { Snippet } from 'svelte';

  let { title, action, children }: { title: string; action?: Snippet; children: Snippet } =
    $props();
</script>

<div class="px-3.5 pb-3">
  <div class="mb-1.5 flex items-center justify-between">
    <span class="text-[10.5px] font-bold uppercase tracking-wider text-subtlest">{title}</span>
    {@render action?.()}
  </div>
  {@render children()}
</div>
