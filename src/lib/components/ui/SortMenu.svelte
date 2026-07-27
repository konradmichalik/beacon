<script lang="ts">
  import { clickOutside } from '$lib/actions/clickOutside';
  import { ArrowDownUp, ChevronDown } from '@lucide/svelte';

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
  <button
    type="button"
    bind:this={btnEl}
    onclick={() => (open = !open)}
    title="Sort"
    class="flex items-center gap-0.5 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-1 text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
  >
    <ArrowDownUp size={11} />
    <ChevronDown size={9} />
  </button>

  {#if open && btnEl}
    {@const rect = btnEl.getBoundingClientRect()}
    <div
      style="position:fixed;top:{rect.bottom + 4}px;right:{window.innerWidth - rect.right}px;"
      class="z-50 min-w-[120px] rounded-lg border border-border bg-card py-1 shadow-lg"
    >
      {#each options as opt (opt.value)}
        <button
          type="button"
          onclick={() => pick(opt.value)}
          class="flex w-full items-center px-3 py-1.5 text-[11px] font-medium transition-colors
            {current === opt.value
            ? 'text-primary'
            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}"
        >
          {opt.label}
        </button>
      {/each}
    </div>
  {/if}
</div>
