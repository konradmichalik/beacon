<script lang="ts">
  import type { Component } from 'svelte';

  let {
    icon: Icon,
    title,
    description
  }: {
    icon: Component<{ size?: number; class?: string }>;
    title: string;
    description: string;
  } = $props();
</script>

<div class="flex flex-col items-center justify-center py-16 text-center">
  <div class="mb-3 rounded-full bg-secondary p-3">
    <Icon size={24} class="text-muted-foreground" />
  </div>
  <p class="text-sm font-medium text-foreground">{title}</p>
  <p class="mt-1 text-xs text-muted-foreground">{description}</p>
</div>
