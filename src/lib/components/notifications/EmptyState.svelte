<script lang="ts">
  import type { Component } from 'svelte';

  let {
    icon: Icon,
    title,
    description,
    iconSize = 24
  }: {
    icon: Component<{ size?: number; class?: string }>;
    title: string;
    description: string;
    iconSize?: number;
  } = $props();
</script>

<div class="flex min-h-full flex-col items-center justify-center py-8 text-center">
  <div class="mb-3 rounded-full bg-secondary p-4">
    <Icon size={iconSize} class="text-muted-foreground" />
  </div>
  <p class="text-sm font-medium text-foreground">{title}</p>
  <p class="mt-1 text-xs text-muted-foreground">{description}</p>
</div>
