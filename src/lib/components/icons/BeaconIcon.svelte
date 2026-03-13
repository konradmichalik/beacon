<script lang="ts">
  let { size = 16, class: className = '' }: { size?: number; class?: string } = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  class={className}
>
  <!-- Signal waves -->
  <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
  <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.4" />
  <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1" />
  <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.4" />
  <!-- Center dot -->
  <circle cx="12" cy="12" r="2" fill="currentColor" />
</svg>
