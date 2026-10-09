<script lang="ts">
  import { Star } from '@lucide/svelte';
  import type { NotificationAuthor, NotificationSource } from '$lib/types';
  import type { RowChip, RowMeta, MetaTone } from '$lib/utils/row-chips';
  import Avatar from './Avatar.svelte';
  import Chip from './Chip.svelte';
  import { ROW_ICONS } from './row-icons';

  let {
    author,
    source,
    repoLine,
    title,
    time,
    weight = 'medium',
    isNew = false,
    starred = false,
    chips = [],
    metas = [],
    labels = [],
    extraLabels = 0,
    pending = false,
    onChipClick
  }: {
    author: NotificationAuthor | null;
    source: NotificationSource;
    repoLine: string;
    title: string;
    time: string;
    weight?: 'semibold' | 'medium' | 'normal';
    isNew?: boolean;
    starred?: boolean;
    chips?: readonly RowChip[];
    metas?: readonly RowMeta[];
    labels?: readonly string[];
    extraLabels?: number;
    pending?: boolean;
    onChipClick?: (chip: RowChip, event: MouseEvent) => void;
  } = $props();

  const WEIGHTS = { semibold: 'font-semibold', medium: 'font-medium', normal: 'font-normal' };
  const META_TONES: Record<MetaTone, string> = {
    success: 'text-success-text',
    warning: 'text-warning',
    danger: 'text-destructive',
    subtle: 'text-subtlest'
  };

  let hasLine3 = $derived(
    chips.length > 0 || metas.length > 0 || labels.length > 0 || extraLabels > 0 || pending
  );
</script>

<div class="flex w-full items-start gap-2 py-3 pl-1.5 pr-4 text-left">
  <span class="flex h-8 w-2.5 shrink-0 items-center justify-center">
    {#if isNew}
      <span title="New since last open" class="h-[7px] w-[7px] rounded-full bg-primary"></span>
    {/if}
  </span>

  <div class="mr-1 shrink-0">
    <Avatar {author} {source} />
  </div>

  <div class="flex min-w-0 flex-1 flex-col gap-0.5">
    <div class="flex items-center gap-2 text-[11.5px] leading-4 text-subtlest">
      <span class="min-w-0 flex-1 truncate">{repoLine}</span>
      {#if starred}
        <Star size={11} class="shrink-0 fill-warning text-warning" aria-label="Starred" />
      {/if}
      <span class="shrink-0 tabular-nums">{time}</span>
    </div>

    <p class="line-clamp-2 text-[13px] leading-[18px] text-foreground {WEIGHTS[weight]}">
      {title}
    </p>

    {#if hasLine3}
      <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {#each chips as chip (chip.label)}
          <Chip {chip} onclick={onChipClick ? (event) => onChipClick(chip, event) : undefined} />
        {/each}
        {#if pending}
          <span class="h-3 w-14 animate-pulse rounded-full bg-muted"></span>
        {/if}
        {#each metas as meta (meta.tip)}
          {@const MetaIcon = ROW_ICONS[meta.icon]}
          <span
            title={meta.tip}
            class="inline-flex max-w-[140px] items-center gap-1 text-[11px] leading-5 text-subtlest"
          >
            <MetaIcon size={12} class="shrink-0 {META_TONES[meta.tone]}" />
            {#if meta.text}
              <span class="truncate">{meta.text}</span>
            {/if}
          </span>
        {/each}
        {#each labels as label (label)}
          <span
            title={label}
            class="inline-flex h-[18px] max-w-[110px] items-center rounded-full border border-border-strong px-[7px] text-[10.5px] font-medium text-muted-foreground"
          >
            <span class="truncate">{label}</span>
          </span>
        {/each}
        {#if extraLabels > 0}
          <span class="text-[10.5px] font-medium text-subtlest">+{extraLabels}</span>
        {/if}
      </div>
    {/if}
  </div>
</div>
