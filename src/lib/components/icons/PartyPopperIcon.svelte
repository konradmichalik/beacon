<script lang="ts">
  let { size = 24, class: className = '' }: { size?: number; class?: string } = $props();
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
  <!-- Popper body -->
  <path d="M5.8 11.3 2 22l10.7-3.79" />
  <path
    d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"
  />

  <!-- Confetti -->
  <g stroke="var(--color-primary)">
    <path class="confetti confetti-1" d="M4 3h.01" />
    <path class="confetti confetti-2" d="M22 8h.01" />
    <path class="confetti confetti-3" d="M15 2h.01" />
    <path class="confetti confetti-4" d="M22 20h.01" />
    <path
      class="confetti confetti-5"
      d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"
    />
    <path
      class="confetti confetti-6"
      d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17"
    />
    <path
      class="confetti confetti-7"
      d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7"
    />
  </g>
</svg>

<style>
  .confetti {
    opacity: 0;
    transform-box: view-box;
    transform-origin: 11px 12px;
    animation: burst 0.35s ease-out forwards;
  }

  .confetti-1 {
    --tx: 7px;
    --ty: 9px;
    animation-delay: 0.08s;
  }
  .confetti-2 {
    --tx: -11px;
    --ty: 4px;
    animation-delay: 0.16s;
  }
  .confetti-3 {
    --tx: -4px;
    --ty: 10px;
    animation-delay: 0.05s;
  }
  .confetti-4 {
    --tx: -11px;
    --ty: -8px;
    animation-delay: 0.22s;
  }
  .confetti-5 {
    --tx: -7px;
    --ty: 6px;
    animation-delay: 0.02s;
  }
  .confetti-6 {
    --tx: -9px;
    --ty: 0;
    animation-delay: 0.13s;
  }
  .confetti-7 {
    --tx: 1px;
    --ty: 7px;
    animation-delay: 0.1s;
  }

  @keyframes burst {
    0% {
      opacity: 0;
      translate: var(--tx) var(--ty);
      scale: 0;
    }
    30% {
      opacity: 1;
    }
    100% {
      opacity: 1;
      translate: 0 0;
      scale: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .confetti {
      opacity: 1;
      animation: none;
    }
  }
</style>
