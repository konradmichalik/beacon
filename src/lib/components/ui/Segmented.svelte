<script lang="ts" generics="T extends string">
  import { bump } from '$lib/actions/bump';
  import CountSkeleton from './CountSkeleton.svelte';
  import type { Component } from 'svelte';

  interface SegmentOption {
    value: T;
    aria: string;
    label?: string;
    icon?: Component<{ size?: number }>;
    count?: number;
  }

  let {
    options,
    value,
    onChange,
    label,
    loading = false,
    fill = false,
    class: className = ''
  }: {
    options: readonly SegmentOption[];
    value: T;
    onChange: (value: T) => void;
    label: string;
    loading?: boolean;
    fill?: boolean;
    class?: string;
  } = $props();

  let index = $derived(options.findIndex((option) => option.value === value));
</script>

<div
  role="group"
  aria-label={label}
  class="relative grid-flow-col rounded-lg bg-muted p-0.5 {fill
    ? 'grid w-full auto-cols-[minmax(0,1fr)]'
    : 'inline-grid auto-cols-fr'} {className}"
>
  <span
    aria-hidden="true"
    class="absolute bottom-0.5 left-0.5 top-0.5 rounded-md bg-card shadow-sm"
    style="width: calc((100% - 4px) / {options.length}); opacity: {index < 0
      ? 0
      : 1}; transform: translateX({Math.max(index, 0) *
      100}%); transition: transform var(--dur-slow) var(--ease-out);"
  ></span>
  {#each options as option (option.value)}
    {@const selected = option.value === value}
    {@const Icon = option.icon}
    <button
      type="button"
      aria-pressed={selected}
      aria-label={option.aria}
      title={option.aria}
      onclick={() => onChange(option.value)}
      class="relative z-10 flex h-6 {fill
        ? 'min-w-0'
        : 'min-w-12'} items-center justify-center gap-1.5 rounded-md px-2.5 text-[11.5px] transition-colors {selected
        ? 'font-semibold text-foreground'
        : 'font-medium text-muted-foreground hover:text-foreground'}"
    >
      {#if Icon}
        <Icon size={12} />
      {/if}
      {#if option.label}
        <span class="truncate">{option.label}</span>
      {/if}
      {#if loading && option.count !== undefined}
        <CountSkeleton />
      {:else if option.count !== undefined}
        <span use:bump={option.count} class="tabular-nums text-subtlest">{option.count}</span>
      {/if}
    </button>
  {/each}
</div>
