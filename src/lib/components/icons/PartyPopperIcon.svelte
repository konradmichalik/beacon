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
  }

  .confetti-1 {
    animation: burst-1 0.35s 0.08s ease-out forwards;
  }
  .confetti-2 {
    animation: burst-2 0.35s 0.16s ease-out forwards;
  }
  .confetti-3 {
    animation: burst-3 0.35s 0.05s ease-out forwards;
  }
  .confetti-4 {
    animation: burst-4 0.35s 0.22s ease-out forwards;
  }
  .confetti-5 {
    animation: burst-5 0.35s 0.02s ease-out forwards;
  }
  .confetti-6 {
    animation: burst-6 0.35s 0.13s ease-out forwards;
  }
  .confetti-7 {
    animation: burst-7 0.35s 0.1s ease-out forwards;
  }

  @keyframes burst-1 {
    0% {
      opacity: 0;
      translate: 7px 9px;
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
  @keyframes burst-2 {
    0% {
      opacity: 0;
      translate: -11px 4px;
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
  @keyframes burst-3 {
    0% {
      opacity: 0;
      translate: -4px 10px;
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
  @keyframes burst-4 {
    0% {
      opacity: 0;
      translate: -11px -8px;
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
  @keyframes burst-5 {
    0% {
      opacity: 0;
      translate: -7px 6px;
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
  @keyframes burst-6 {
    0% {
      opacity: 0;
      translate: -9px 0;
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
  @keyframes burst-7 {
    0% {
      opacity: 0;
      translate: 1px 7px;
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
</style>
