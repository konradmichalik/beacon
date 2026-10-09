<script lang="ts">
  import { clickOutside } from '$lib/actions/clickOutside';
  import { ArrowDownUp } from '@lucide/svelte';
  import IconButton from './IconButton.svelte';

  let {
    options,
    current,
    onSelect
  }: {
    options: { value: string; label: string }[];
    current: string;
    onSelect: (value: string) => void;
  } = $props();

  let open = $state(false);
  let btnEl: HTMLButtonElement | undefined = $state();

  function pick(value: string) {
    onSelect(value);
    open = false;
  }
</script>

<!-- Wrapper keeps the trigger "inside" the clickOutside node so clicking the
     button closes via its own toggle instead of the capturing pointerdown
     handler firing first (which would immediately reopen it). -->
<div class="contents" use:clickOutside={() => (open = false)}>
  <IconButton
    label="Sort"
    bind:el={btnEl}
    expanded={open}
    active={open}
    onclick={() => (open = !open)}
  >
    <ArrowDownUp size={15} />
  </IconButton>

  {#if open && btnEl}
    {@const rect = btnEl.getBoundingClientRect()}
    <div
      style="position:fixed;top:{rect.bottom + 4}px;right:{window.innerWidth - rect.right}px;"
      class="z-50 min-w-[140px] rounded-[10px] border border-border bg-popover p-1 shadow-lg"
    >
      {#each options as opt (opt.value)}
        <button
          type="button"
          onclick={() => pick(opt.value)}
          class="flex h-7 w-full items-center rounded-md px-2.5 text-xs transition-colors hover:bg-surface-hovered
            {current === opt.value
            ? 'font-semibold text-accent-foreground'
            : 'font-medium text-foreground'}"
        >
          {opt.label}
        </button>
      {/each}
    </div>
  {/if}
</div>
