<script lang="ts">
  import { CheckCheck } from '@lucide/svelte';
  import { toastState, dismissToast, runToastAction } from '$lib/stores/toast.svelte';

  let visible = $derived(toastState.message !== null);
  let leaving = $derived(toastState.leaving);
  let action = $derived(toastState.action);
</script>

{#if visible}
  <div
    role="status"
    class="fixed bottom-12 left-1/2 z-50 flex h-[34px] items-center gap-2.5 whitespace-nowrap rounded-full bg-toast py-0 pl-3 text-xs font-medium text-toast-foreground shadow-lg {action
      ? 'pr-[5px]'
      : 'pr-3'}"
    style="animation: {leaving
      ? 'toast-out var(--dur-base)'
      : 'toast-in var(--dur-slow)'} var(--ease-out) forwards;"
  >
    <CheckCheck size={14} class="shrink-0" />
    {#if action && !leaving}
      <span>{toastState.message}</span>
      <button
        type="button"
        onclick={runToastAction}
        class="h-6 rounded-xl bg-toast-foreground/15 px-2.5 text-xs font-semibold text-toast-accent transition-colors hover:bg-toast-foreground/25"
      >
        {action.label}
      </button>
    {:else}
      <button type="button" onclick={dismissToast} class="text-left" title="Dismiss">
        {toastState.message}
      </button>
    {/if}
  </div>
{/if}
