<script lang="ts">
  import { Sparkles } from '@lucide/svelte';
  import type { ChipTone, RowChip } from '$lib/utils/row-chips';
  import { ROW_ICONS } from './row-icons';

  let { chip, onclick }: { chip: RowChip; onclick?: (event: MouseEvent) => void } = $props();

  const TONES: Record<ChipTone, string> = {
    success: 'bg-success-bg text-success-text',
    warning: 'bg-warning-bg text-warning',
    danger: 'bg-destructive-bg text-destructive',
    discovery: 'bg-discovery-bg text-discovery',
    brand: 'bg-brand-bg text-accent-foreground',
    neutral: 'bg-muted text-muted-foreground'
  };

  const base =
    'inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-[7px] text-[11px] font-semibold';

  let Icon = $derived(ROW_ICONS[chip.icon]);
  let clickable = $derived(chip.clickable === true && onclick !== undefined);
</script>

{#if clickable}
  <button
    type="button"
    title={chip.tip}
    {onclick}
    class="{base} {TONES[chip.tone]} underline decoration-dotted underline-offset-2"
  >
    <Icon size={12} />
    {chip.label}
  </button>
{:else}
  <span title={chip.tip ?? chip.label} class="{base} {TONES[chip.tone]}">
    <Icon size={12} />
    {chip.label}
    {#if chip.synthetic}
      <Sparkles size={11} class="ml-px opacity-75" aria-label="Detected by Beacon" />
    {/if}
  </span>
{/if}
