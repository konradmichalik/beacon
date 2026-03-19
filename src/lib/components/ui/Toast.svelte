<script lang="ts">
  import { CheckCheck } from '@lucide/svelte';
  import { toastState, dismissToast } from '$lib/stores/toast.svelte';

  let visible = $derived(toastState.message !== null);
  let leaving = $derived(toastState.leaving);
</script>

{#if visible}
  <button
    type="button"
    onclick={dismissToast}
    class="fixed bottom-4 left-1/2 z-50 rounded-full border border-border bg-card px-3 py-1.5 shadow-lg"
    style="animation: {leaving ? 'toast-out' : 'toast-in'} 0.2s ease-out forwards;"
  >
    <span class="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
      <CheckCheck size={12} class="text-primary" />
      {toastState.message}
    </span>
  </button>
{/if}
