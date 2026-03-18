<script lang="ts">
  import {
    Sun,
    Moon,
    Monitor,
    Hash,
    Circle,
    Link,
    SlidersHorizontal,
    BellOff,
    Bell,
    BellDot,
    BellRing,
    Info,
    ExternalLink,
    BookOpen,
    Play,
    ChevronDown
  } from '@lucide/svelte';
  import { settingsState, updateSettings } from '$lib/stores/settings.svelte';
  import {
    NOTIFY_SOUNDS,
    type BadgeMode,
    type NotifyMode,
    type DotColor,
    type NotifySound
  } from '$lib/stores/settings.svelte';
  import GitHubConnectionForm from '../connection/GitHubConnectionForm.svelte';
  import GitLabConnectionForm from '../connection/GitLabConnectionForm.svelte';
  import BeaconLogo from '../icons/BeaconLogo.svelte';
  import { sendNotification } from '$lib/services/desktop-notifications';
  import { playNotificationSound } from '$lib/services/notification-sound';
  import {
    checkForUpdates,
    type UpdateStatus,
    type UpdateCheckResult
  } from '$lib/services/update-check';
  import { RefreshCw, ArrowUpCircle, CheckCircle, AlertCircle } from '@lucide/svelte';

  type SettingsTab = 'connections' | 'preferences' | 'alerts' | 'about';
  let activeTab: SettingsTab = $state('connections');
  let isPlayingPreview = $state(false);
  let updateStatus: UpdateStatus = $state('idle');
  let updateResult: UpdateCheckResult = $state({ status: 'idle' });

  async function handleCheckForUpdates(): Promise<void> {
    updateStatus = 'checking';
    updateResult = await checkForUpdates(version);
    updateStatus = updateResult.status;
  }

  async function setNotifyMode(mode: NotifyMode): Promise<void> {
    await updateSettings({ notifyMode: mode });
    if (mode !== 'disabled') {
      sendNotification('Beacon', `Notifications set to ${mode} mode.`);
      playNotificationSound(settingsState.notifySound);
    }
  }

  const version = __APP_VERSION__;
  const buildDate = new Date(__BUILD_DATE__).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const tabs: { value: SettingsTab; label: string; icon: typeof Link }[] = [
    { value: 'connections', label: 'Connections', icon: Link },
    { value: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
    { value: 'alerts', label: 'Alerts', icon: BellRing },
    { value: 'about', label: 'About', icon: Info }
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

  const dotColorOptions: { value: DotColor; label: string; color: string }[] = [
    { value: 'blue', label: 'Blue', color: '#5e81ac' },
    { value: 'red', label: 'Red', color: '#ff786e' }
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

  const soundOptions = NOTIFY_SOUNDS.map((s) => ({
    value: s,
    label: s === 'none' ? 'Off' : s.charAt(0).toUpperCase() + s.slice(1)
  }));
</script>

<!-- Tab bar -->
<div class="flex border-b border-border">
  {#each tabs as tab (tab.value)}
    {@const Icon = tab.icon}
    <button
      type="button"
      onclick={() => (activeTab = tab.value)}
      class="flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-medium transition-colors {activeTab ===
      tab.value
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
  {:else if activeTab === 'preferences'}
    <!-- ── General ── -->
    <div class="space-y-4">
      <h3 class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
        General
      </h3>

      <!-- Refresh Interval -->
      <section>
        <h4 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Refresh Interval
        </h4>
        <div class="flex gap-1.5">
          {#each intervalOptions as option (option.value)}
            <button
              type="button"
              onclick={() => updateSettings({ pollingInterval: option.value })}
              class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors {settingsState.pollingInterval ===
              option.value
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
        <h4 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Menubar Icon
        </h4>
        <div class="flex gap-1.5">
          {#each badgeOptions as option (option.value)}
            {@const Icon = option.icon}
            <button
              type="button"
              onclick={() => updateSettings({ badgeMode: option.value })}
              class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors {settingsState.badgeMode ===
              option.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}"
            >
              <Icon size={12} />
              {option.label}
            </button>
          {/each}
        </div>
        <p class="mt-1.5 text-[10px] text-muted-foreground">
          {settingsState.badgeMode === 'count'
            ? 'Shows unread notification count next to the menubar icon.'
            : 'Shows a colored dot when unread notifications are pending.'}
        </p>

        {#if settingsState.badgeMode === 'dot'}
          <div class="mt-3">
            <h5 class="mb-2 text-[11px] font-medium text-muted-foreground">Dot Color</h5>
            <div class="flex gap-1.5">
              {#each dotColorOptions as option (option.value)}
                <button
                  type="button"
                  onclick={() => updateSettings({ dotColor: option.value })}
                  class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors {settingsState.dotColor ===
                  option.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}"
                >
                  <span
                    class="inline-block h-2.5 w-2.5 rounded-full"
                    style="background-color: {option.color}"
                  ></span>
                  {option.label}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </section>

      <!-- Theme -->
      <section>
        <h4 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Theme
        </h4>
        <div class="flex gap-1.5">
          {#each themeOptions as option (option.value)}
            {@const Icon = option.icon}
            <button
              type="button"
              onclick={() => updateSettings({ theme: option.value })}
              class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors {settingsState.theme ===
              option.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}"
            >
              <Icon size={12} />
              {option.label}
            </button>
          {/each}
        </div>
      </section>
    </div>

    <hr class="border-border" />

    <!-- ── Inbox ── -->
    <div class="space-y-4">
      <h3 class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
        Inbox
      </h3>

      <section>
        <label class="flex cursor-pointer items-center justify-between gap-3">
          <div>
            <span class="text-xs font-medium text-foreground">Hide closed &amp; merged</span>
            <p class="text-[10px] text-muted-foreground">
              Don't show notifications for closed or merged items.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Toggle hide closed and merged"
            aria-checked={settingsState.hideClosed}
            onclick={() => updateSettings({ hideClosed: !settingsState.hideClosed })}
            class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors {settingsState.hideClosed
              ? 'bg-primary'
              : 'bg-secondary'}"
          >
            <span
              class="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform {settingsState.hideClosed
                ? 'translate-x-4'
                : 'translate-x-0.5'}"
            ></span>
          </button>
        </label>
      </section>
    </div>

    <hr class="border-border" />

    <!-- ── Pull Requests ── -->
    <div class="space-y-4">
      <h3 class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
        Pull Requests
      </h3>

      <section>
        <label class="flex cursor-pointer items-center justify-between gap-3">
          <div>
            <span class="text-xs font-medium text-foreground">Fetch CI & review status</span>
            <p class="text-[10px] text-muted-foreground">
              Fetches pipeline status and review decisions per PR. Disable for faster loading with
              many PRs.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Toggle fetch CI and review status"
            aria-checked={settingsState.enrichPullRequests}
            onclick={() => updateSettings({ enrichPullRequests: !settingsState.enrichPullRequests })}
            class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors {settingsState.enrichPullRequests
              ? 'bg-primary'
              : 'bg-secondary'}"
          >
            <span
              class="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform {settingsState.enrichPullRequests
                ? 'translate-x-4'
                : 'translate-x-0.5'}"
            ></span>
          </button>
        </label>
      </section>
    </div>
  {:else if activeTab === 'alerts'}
    <!-- Notification Mode -->
    <section>
      <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Desktop Notifications
      </h3>
      <div class="flex gap-1.5">
        {#each notifyOptions as option (option.value)}
          {@const Icon = option.icon}
          <button
            type="button"
            onclick={() => setNotifyMode(option.value)}
            class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors {settingsState.notifyMode ===
            option.value
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
          {#each summaryIntervalOptions as option (option.value)}
            <button
              type="button"
              onclick={() => updateSettings({ notifySummaryMinutes: option.value })}
              class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors {settingsState.notifySummaryMinutes ===
              option.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}"
            >
              {option.label}
            </button>
          {/each}
        </div>
      </section>
    {/if}

    {#if settingsState.notifyMode !== 'disabled'}
      <!-- Notification Sound -->
      <section>
        <h3
          id="notification-sound-heading"
          class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Notification Sound
        </h3>
        <div class="inline-flex items-center gap-1.5">
          <div class="relative">
            <select
              aria-labelledby="notification-sound-heading"
              value={settingsState.notifySound}
              onchange={(e) => {
                const value = e.currentTarget.value as NotifySound;
                updateSettings({ notifySound: value });
                if (value !== 'none') playNotificationSound(value);
              }}
              class="w-28 cursor-pointer appearance-none rounded-md border border-border bg-secondary py-1.5 pl-2.5 pr-7 text-xs font-medium text-foreground outline-none transition-colors focus:border-primary"
            >
              {#each soundOptions as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
            <ChevronDown
              size={12}
              class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
          </div>
          {#if settingsState.notifySound !== 'none'}
            <button
              type="button"
              onclick={() => {
                isPlayingPreview = true;
                playNotificationSound(settingsState.notifySound);
                setTimeout(() => (isPlayingPreview = false), 400);
              }}
              class="flex h-[30px] w-[30px] items-center justify-center rounded-md bg-secondary text-secondary-foreground transition-all hover:bg-secondary/80 {isPlayingPreview
                ? 'scale-90 bg-primary/20 text-primary'
                : ''}"
              aria-label="Preview sound"
            >
              <Play size={12} />
            </button>
          {/if}
        </div>
      </section>
    {/if}
  {:else if activeTab === 'about'}
    <div class="flex flex-col items-center gap-5 py-4">
      <BeaconLogo height={30} class="text-foreground" />
      <p class="text-center text-xs text-muted-foreground">GitHub & GitLab Notification Tracker</p>

      <div class="w-full rounded-xl border border-border bg-muted/30 divide-y divide-border">
        <div class="flex items-center justify-between px-4 py-2.5">
          <span class="text-xs text-muted-foreground">Version</span>
          <span class="text-xs font-mono font-medium text-foreground">v{version}</span>
        </div>
        <div class="flex items-center justify-between px-4 py-2.5">
          <span class="text-xs text-muted-foreground">Build</span>
          <span class="text-xs font-medium text-foreground">{buildDate}</span>
        </div>
        <div class="flex items-center justify-between px-4 py-2.5">
          <span class="text-xs text-muted-foreground">Updates</span>
          {#if updateStatus === 'idle'}
            <button
              type="button"
              onclick={handleCheckForUpdates}
              class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <RefreshCw size={11} />
              Check for updates
            </button>
          {:else if updateStatus === 'checking'}
            <span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <RefreshCw size={11} class="animate-spin" />
              Checking…
            </span>
          {:else if updateStatus === 'up-to-date'}
            <span class="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
              <CheckCircle size={11} />
              Up to date
            </span>
          {:else if updateStatus === 'update-available'}
            <a
              href={updateResult.releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <ArrowUpCircle size={11} />
              {updateResult.latestVersion} available
            </a>
          {:else if updateStatus === 'error'}
            <button
              type="button"
              onclick={handleCheckForUpdates}
              class="inline-flex items-center gap-1 text-xs font-medium text-destructive hover:text-destructive/80 transition-colors"
              title={updateResult.error}
            >
              <AlertCircle size={11} />
              Retry
            </button>
          {/if}
        </div>
      </div>

      <div class="flex items-center gap-2">
        <a
          href="https://github.com/konradmichalik/beacon"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
        >
          <ExternalLink size={12} />
          GitHub
        </a>
        <a
          href="https://github.com/konradmichalik/beacon#readme"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
        >
          <BookOpen size={12} />
          Documentation
        </a>
      </div>

      <p class="text-[10px] text-muted-foreground">
        &copy; {new Date().getFullYear()} Konrad Michalik
      </p>
    </div>
  {/if}
</div>
