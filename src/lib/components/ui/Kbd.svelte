<script lang="ts">
  let { size = 'sm', children }: { size?: 'sm' | 'md'; children: import('svelte').Snippet } =
    $props();
</script>

<kbd
  class="inline-flex items-center justify-center rounded font-sans {size === 'sm'
    ? 'h-[18px] min-w-[18px] border border-border-strong px-1 text-[10.5px] text-subtlest'
    : 'h-5 min-w-5 border border-b-2 border-border-strong bg-card px-1.5 text-[11px] font-medium text-muted-foreground'}"
>
  {@render children()}
</kbd>
