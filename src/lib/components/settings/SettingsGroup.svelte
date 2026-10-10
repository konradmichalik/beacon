<script lang="ts">
  import type { Snippet } from 'svelte';

  let { title, id, children }: { title: string; id?: string; children: Snippet } = $props();
</script>

<section {id} class="mt-4 first:mt-0">
  <h3 class="mb-1.5 ml-1 text-[10.5px] font-bold uppercase tracking-wider text-subtlest">
    {title}
  </h3>
  <div class="divide-y divide-border overflow-hidden rounded-[10px] border border-border bg-card">
    {@render children()}
  </div>
</section>
