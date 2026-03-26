<script lang="ts">
  import { settingsState, updateSettings } from '$lib/stores/settings.svelte';

  const sections = [
    {
      title: 'Global',
      shortcuts: [
        { keys: ['1'], action: 'Switch to Notifications' },
        { keys: ['2'], action: 'Switch to Pull Requests' },
        { keys: ['\u2190'], action: 'Previous tab' },
        { keys: ['\u2192'], action: 'Next tab' },
        { keys: ['R'], action: 'Refresh' },
        { keys: ['/'], action: 'Focus filter bar' },
        { keys: ['Esc'], action: 'Close popup' }
      ]
    },
    {
      title: 'Lists',
      shortcuts: [
        { keys: ['\u2191'], action: 'Previous item' },
        { keys: ['\u2193'], action: 'Next item' },
        { keys: ['Home'], action: 'First item' },
        { keys: ['End'], action: 'Last item' }
      ]
    },
    {
      title: 'Cards',
      shortcuts: [
        { keys: ['Enter'], action: 'Open in browser' },
        { keys: ['Shift', 'F10'], action: 'Open context menu' },
        { keys: ['M'], action: 'Mark as read (Notifications)' },
        { keys: ['S'], action: 'Star / Unstar (Pull Requests)' }
      ]
    }
  ];
</script>

<div class="space-y-5">
  <!-- Global Shortcut Toggle -->
  <section>
    <label class="flex cursor-pointer items-center justify-between gap-3">
      <div>
        <span class="text-xs font-medium text-foreground">Global Shortcut</span>
        <p class="text-[10px] text-muted-foreground">
          Toggle Beacon with
          <kbd class="rounded border border-border bg-secondary px-1 py-0.5 font-mono text-[9px]"
            >&#8984;</kbd
          >
          <kbd class="rounded border border-border bg-secondary px-1 py-0.5 font-mono text-[9px]"
            >&#8679;</kbd
          >
          <kbd class="rounded border border-border bg-secondary px-1 py-0.5 font-mono text-[9px]"
            >B</kbd
          >
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-label="Toggle global keyboard shortcut"
        aria-checked={settingsState.globalShortcut}
        onclick={() => updateSettings({ globalShortcut: !settingsState.globalShortcut })}
        class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors {settingsState.globalShortcut
          ? 'bg-primary'
          : 'bg-secondary'}"
      >
        <span
          class="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform {settingsState.globalShortcut
            ? 'translate-x-4'
            : 'translate-x-0.5'}"
        ></span>
      </button>
    </label>
  </section>

  <hr class="border-border" />

  <!-- Shortcut Reference -->
  {#each sections as section (section.title)}
    <div>
      <h3
        class="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60"
      >
        {section.title}
      </h3>
      <div class="space-y-1">
        {#each section.shortcuts as shortcut (shortcut.action)}
          <div class="flex items-center justify-between rounded-md px-2 py-1.5">
            <span class="text-xs text-foreground">{shortcut.action}</span>
            <div class="flex items-center gap-0.5">
              {#each shortcut.keys as key (key)}
                <kbd
                  class="min-w-[22px] rounded border border-border bg-secondary px-1.5 py-0.5 text-center font-mono text-[10px] text-muted-foreground"
                >
                  {key}
                </kbd>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/each}
</div>
