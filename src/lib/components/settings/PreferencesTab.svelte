<script lang="ts">
  import { ExternalLink, FolderOpen, Trash2, X } from '@lucide/svelte';
  import { settingsState, updateSettings } from '$lib/stores/settings.svelte';
  import type { BadgeMode, IndicatorColor, IndicatorMode } from '$lib/stores/settings.svelte';
  import { getMuteRules, removeMuteRule } from '$lib/stores/mute-rules.svelte';
  import { NOTIFICATION_TYPE_LABELS } from '$lib/types';
  import { clearLog } from '$lib/utils/logger';
  import { repoShortName } from '$lib/utils/repository';
  import { isTauri } from '$lib/utils/storage';
  import Button from '$lib/components/ui/Button.svelte';
  import IconButton from '$lib/components/ui/IconButton.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { seg } from '$lib/utils/segments';
  import Switch from '$lib/components/ui/Switch.svelte';
  import SettingsGroup from './SettingsGroup.svelte';
  import SettingsRow from './SettingsRow.svelte';

  let activeMuteRules = $derived(getMuteRules());

  async function invokeNative(command: string): Promise<void> {
    if (!isTauri()) return;
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke(command);
  }

  const intervalOptions = [
    seg('60', '1 min'),
    seg('300', '5 min'),
    seg('900', '15 min'),
    seg('1800', '30 min')
  ];
  const badgeOptions = [seg<BadgeMode>('count', 'Count'), seg<BadgeMode>('hidden', 'Hidden')];
  const indicatorModeOptions = [
    seg<IndicatorMode>('none', 'None'),
    seg<IndicatorMode>('dot', 'Dot'),
    seg<IndicatorMode>('waves', 'Waves')
  ];
  const themeOptions = [
    seg<'light' | 'dark' | 'system'>('light', 'Light'),
    seg<'light' | 'dark' | 'system'>('dark', 'Dark'),
    seg<'light' | 'dark' | 'system'>('system', 'System')
  ];

  // The values the menu bar icon is tinted with, so these stay literal.
  const indicatorColors: { value: IndicatorColor; label: string; color: string }[] = [
    { value: 'blue', label: 'Blue', color: '#5e81ac' },
    { value: 'red', label: 'Red', color: '#ff786e' },
    { value: 'yellow', label: 'Yellow', color: '#ebcb8b' },
    { value: 'green', label: 'Green', color: '#a3be8c' }
  ];

  const indicatorHelp = {
    none: 'The menu bar icon stays monochrome.',
    dot: 'A colored dot appears on the menu bar icon while unread items exist.',
    waves: 'The icon waves are colored while unread items exist.'
  };

  const chipClass =
    'inline-flex h-5 items-center rounded-md bg-muted px-[7px] text-[11.5px] font-medium text-muted-foreground';
</script>

<SettingsGroup title="General">
  <SettingsRow label="Refresh interval">
    <Segmented
      label="Refresh interval"
      options={intervalOptions}
      value={String(settingsState.pollingInterval)}
      onChange={(value) => updateSettings({ pollingInterval: Number(value) })}
    />
  </SettingsRow>
  <SettingsRow label="Menu bar indicator" help={indicatorHelp[settingsState.indicatorMode]}>
    <Segmented
      label="Menu bar indicator"
      options={indicatorModeOptions}
      value={settingsState.indicatorMode}
      onChange={(indicatorMode) => updateSettings({ indicatorMode })}
    />
  </SettingsRow>
  <SettingsRow label="Indicator color">
    <div role="group" aria-label="Indicator color" class="flex gap-2">
      {#each indicatorColors as option (option.value)}
        {@const selected = settingsState.indicatorColor === option.value}
        <button
          type="button"
          aria-label={option.label}
          aria-pressed={selected}
          title={option.label}
          disabled={settingsState.indicatorMode === 'none'}
          onclick={() => updateSettings({ indicatorColor: option.value })}
          class="h-5 w-5 rounded-full transition-shadow disabled:opacity-35 {selected
            ? 'ring-2 ring-offset-2 ring-offset-card'
            : 'ring-1 ring-border-strong'}"
          style="background-color: {option.color}; {selected
            ? `--tw-ring-color: ${option.color}`
            : ''}"
        ></button>
      {/each}
    </div>
  </SettingsRow>
  <SettingsRow
    label="Badge count"
    help={settingsState.badgeMode === 'count'
      ? 'Shows the unread count next to the menu bar icon.'
      : 'Hides the count next to the menu bar icon.'}
  >
    <Segmented
      label="Badge count"
      options={badgeOptions}
      value={settingsState.badgeMode}
      onChange={(badgeMode) => updateSettings({ badgeMode })}
    />
  </SettingsRow>
  <SettingsRow label="Appearance">
    <Segmented
      label="Appearance"
      options={themeOptions}
      value={settingsState.theme}
      onChange={(theme) => updateSettings({ theme })}
    />
  </SettingsRow>
  <SettingsRow label="Launch at login" help="Add Beacon to your macOS login items.">
    <Button onclick={() => invokeNative('open_login_items_settings')}>
      <ExternalLink size={12} />
      Open…
    </Button>
  </SettingsRow>
</SettingsGroup>

<SettingsGroup title="Inbox" id="mute-rules">
  <SettingsRow
    label="Mute rules"
    help="Notifications matching a rule are hidden from your inbox. Add rules from the context menu of a notification."
  />
  {#if activeMuteRules.length === 0}
    <p class="px-3.5 py-2.5 text-xs text-subtlest">No mute rules configured.</p>
  {:else}
    {#each activeMuteRules as rule (rule.id)}
      <div class="flex items-center gap-2 px-3.5 py-2">
        <div class="flex min-w-0 flex-1 flex-wrap gap-1">
          {#if rule.project}<span class={chipClass}>{repoShortName(rule.project)}</span>{/if}
          {#if rule.type}
            <span class={chipClass}>{NOTIFICATION_TYPE_LABELS[rule.type] ?? rule.type}</span>
          {/if}
          {#if rule.status}
            <span class={chipClass}>
              {rule.status.charAt(0).toUpperCase() + rule.status.slice(1)}
            </span>
          {/if}
          {#if rule.author}<span class={chipClass}>@{rule.author}</span>{/if}
        </div>
        <IconButton label="Remove mute rule" onclick={() => removeMuteRule(rule.id)}>
          <X size={14} />
        </IconButton>
      </div>
    {/each}
  {/if}
</SettingsGroup>

<SettingsGroup title="Pull requests and issues">
  <SettingsRow label="Group by role" help="Created by me, To review and Reviewed sections.">
    <Switch
      label="Group pull requests by role"
      checked={settingsState.groupPullRequests}
      onchange={(groupPullRequests) => updateSettings({ groupPullRequests })}
    />
  </SettingsRow>
  <SettingsRow
    label="Fetch CI and review status"
    help="Fetches pipeline status and review decisions per pull request. Turn it off for faster loading. GitHub only learns the merge status this way, so Ready to merge needs it."
  >
    <Switch
      label="Fetch CI and review status"
      checked={settingsState.enrichPullRequests}
      onchange={(enrichPullRequests) => updateSettings({ enrichPullRequests })}
    />
  </SettingsRow>
  <SettingsRow label="Show issues tab" help="Open issues you created or are assigned to.">
    <Switch
      label="Show issues tab"
      checked={settingsState.enableIssues}
      onchange={(enableIssues) => updateSettings({ enableIssues })}
    />
  </SettingsRow>
</SettingsGroup>

<SettingsGroup title="Advanced">
  <SettingsRow
    label="Debug log"
    help="Logs API requests, responses and errors to a file for troubleshooting."
  >
    <Switch
      label="Debug log"
      checked={settingsState.debugLog}
      onchange={(debugLog) => updateSettings({ debugLog })}
    />
  </SettingsRow>
  {#if settingsState.debugLog}
    <div class="flex gap-2 px-3.5 py-2.5">
      <Button onclick={() => invokeNative('reveal_log_in_finder')}>
        <FolderOpen size={12} />
        Show in Finder
      </Button>
      <Button onclick={() => clearLog()}>
        <Trash2 size={12} />
        Clear log
      </Button>
    </div>
  {/if}
  <SettingsRow
    label="Export data for external apps"
    help="Writes a small JSON snapshot after every refresh, for tools like a Stream Deck plugin."
  >
    <Switch
      label="Export data for external apps"
      checked={settingsState.exportData}
      onchange={(exportData) => updateSettings({ exportData })}
    />
  </SettingsRow>
</SettingsGroup>
