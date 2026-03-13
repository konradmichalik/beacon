<script lang="ts">
  import { Sun, Moon, Monitor, Hash, Circle, Link, SlidersHorizontal, BellOff, Bell, BellDot } from '@lucide/svelte';
  import { settingsState, updateSettings } from '$lib/stores/settings.svelte';
  import type { BadgeMode, NotifyMode } from '$lib/stores/settings.svelte';
  import GitHubConnectionForm from '../connection/GitHubConnectionForm.svelte';
  import GitLabConnectionForm from '../connection/GitLabConnectionForm.svelte';

  type SettingsTab = 'connections' | 'notifications' | 'preferences';
  let activeTab: SettingsTab = $state('connections');

  const tabs: { value: SettingsTab; label: string; icon: typeof Link }[] = [
    { value: 'connections', label: 'Connections', icon: Link },
    { value: 'notifications', label: 'Notifications', icon: Bell },
    { value: 'preferences', label: 'Preferences', icon: SlidersHorizontal }
  ];

  const intervalOptions = [
    { value: 60, label: '1 min' },
    { value: 300, label: '5 min' },
    { value: 900, label: '15 min' },
    { value: 1800, label: '30 min' }
  ];

  const themeOptions = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor }
  ];

  const badgeOptions: { value: BadgeMode; label: string; icon: typeof Hash }[] = [
    { value: 'count', label: 'Count', icon: Hash },
    { value: 'dot', label: 'Dot', icon: Circle }
  ];

  const notifyOptions: { value: NotifyMode; label: string; icon: typeof Bell }[] = [
    { value: 'disabled', label: 'Off', icon: BellOff },
    { value: 'instant', label: 'Instant', icon: Bell },
    { value: 'summary', label: 'Summary', icon: BellDot }
  ];

  const summaryIntervalOptions = [
    { value: 5, label: '5 min' },
    { value: 15, label: '15 min' },
    { value: 30, label: '30 min' },
    { value: 60, label: '60 min' }
  ];
</script>

<!-- Tab bar -->
<div class="flex border-b border-border">
  {#each tabs as tab}
    {@const Icon = tab.icon}
    <button
      type="button"
      onclick={() => (activeTab = tab.value)}
      class="flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-medium transition-colors {activeTab === tab.value
        ? 'border-b-2 border-primary text-foreground'
        : 'text-muted-foreground hover:text-foreground'}"
    >
      <Icon size={12} />
      {tab.label}
    </button>
  {/each}
</div>

<div class="space-y-6 p-4">
  {#if activeTab === 'connections'}
    <div class="space-y-3">
      <GitHubConnectionForm />
      <GitLabConnectionForm />
    </div>
  {:else if activeTab === 'notifications'}
    <!-- Notification Mode -->
    <section>
      <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Desktop Notifications
      </h3>
      <div class="flex gap-1.5">
        {#each notifyOptions as option}
          {@const Icon = option.icon}
          <button
            type="button"
            onclick={() => updateSettings({ notifyMode: option.value })}
            class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors {settingsState.notifyMode === option.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}"
          >
            <Icon size={12} />
            {option.label}
          </button>
        {/each}
      </div>
      <p class="mt-1.5 text-[10px] text-muted-foreground">
        {#if settingsState.notifyMode === 'disabled'}
          Desktop notifications are turned off.
        {:else if settingsState.notifyMode === 'instant'}
          Get notified immediately when new notifications arrive.
        {:else}
          Receive a summary of new notifications at a regular interval.
        {/if}
      </p>
    </section>

    {#if settingsState.notifyMode === 'summary'}
      <!-- Summary Interval -->
      <section>
        <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Summary Interval
        </h3>
        <div class="flex gap-1.5">
          {#each summaryIntervalOptions as option}
            <button
              type="button"
              onclick={() => updateSettings({ notifySummaryMinutes: option.value })}
              class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors {settingsState.notifySummaryMinutes === option.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}"
            >
              {option.label}
            </button>
          {/each}
        </div>
      </section>
    {/if}
  {:else}
    <!-- Refresh Interval -->
    <section>
      <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Refresh Interval
      </h3>
      <div class="flex gap-1.5">
        {#each intervalOptions as option}
          <button
            type="button"
            onclick={() => updateSettings({ pollingInterval: option.value })}
            class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors {settingsState.pollingInterval === option.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}"
          >
            {option.label}
          </button>
        {/each}
      </div>
    </section>

    <!-- Menubar Icon -->
    <section>
      <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Menubar Icon
      </h3>
      <div class="flex gap-1.5">
        {#each badgeOptions as option}
          {@const Icon = option.icon}
          <button
            type="button"
            onclick={() => updateSettings({ badgeMode: option.value })}
            class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors {settingsState.badgeMode === option.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}"
          >
            <Icon size={12} />
            {option.label}
          </button>
        {/each}
      </div>
      <p class="mt-1.5 text-[10px] text-muted-foreground">
        {settingsState.badgeMode === 'count' ? 'Shows the number of notifications next to the icon.' : 'Shows a dot indicator when notifications are pending.'}
      </p>
    </section>

    <!-- Filtering -->
    <section>
      <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Filtering
      </h3>
      <label class="flex cursor-pointer items-center justify-between gap-3">
        <div>
          <span class="text-xs font-medium text-foreground">Hide closed &amp; merged</span>
          <p class="text-[10px] text-muted-foreground">Don't show notifications for closed or merged items.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settingsState.hideClosed}
          onclick={() => updateSettings({ hideClosed: !settingsState.hideClosed })}
          class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors {settingsState.hideClosed ? 'bg-primary' : 'bg-secondary'}"
        >
          <span class="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform {settingsState.hideClosed ? 'translate-x-4' : 'translate-x-0.5'}" />
        </button>
      </label>
    </section>

    <!-- Theme -->
    <section>
      <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Theme
      </h3>
      <div class="flex gap-1.5">
        {#each themeOptions as option}
          {@const Icon = option.icon}
          <button
            type="button"
            onclick={() => updateSettings({ theme: option.value })}
            class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors {settingsState.theme === option.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}"
          >
            <Icon size={12} />
            {option.label}
          </button>
        {/each}
      </div>
    </section>

    <!-- About -->
    <section class="text-center text-[10px] text-muted-foreground">
      <p>beacon v{__APP_VERSION__}</p>
    </section>
  {/if}
</div>
