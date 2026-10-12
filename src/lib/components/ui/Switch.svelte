<script lang="ts">
  let {
    checked,
    onchange,
    label
  }: { checked: boolean; onchange: (next: boolean) => void; label: string } = $props();
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={label}
  onclick={() => onchange(!checked)}
  class="relative h-5 w-[34px] shrink-0 rounded-full transition-colors duration-[var(--dur-base)] {checked
    ? 'bg-primary'
    : 'bg-border-strong'}"
>
  <span
    class="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-[var(--dur-slow)] ease-[var(--ease-out)] {checked
      ? 'translate-x-3.5'
      : ''}"
  ></span>
</button>
