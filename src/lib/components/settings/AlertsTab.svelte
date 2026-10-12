<script lang="ts">
  import { ChevronDown, Play } from '@lucide/svelte';
  import { settingsState, updateSettings, NOTIFY_SOUNDS } from '$lib/stores/settings.svelte';
  import type { NotifyMode, NotifySound } from '$lib/stores/settings.svelte';
  import { sendNotification } from '$lib/services/desktop-notifications';
  import { playNotificationSound } from '$lib/services/notification-sound';
  import IconButton from '$lib/components/ui/IconButton.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { seg } from '$lib/utils/segments';
  import SettingsGroup from './SettingsGroup.svelte';
  import SettingsRow from './SettingsRow.svelte';

  const notifyOptions = [
    seg<NotifyMode>('disabled', 'Off'),
    seg<NotifyMode>('instant', 'Instant'),
    seg<NotifyMode>('summary', 'Summary')
  ];
  const summaryOptions = [
    seg('5', '5 min'),
    seg('15', '15 min'),
    seg('30', '30 min'),
    seg('60', '60 min')
  ];
  const soundOptions = NOTIFY_SOUNDS.map((sound) => ({
    value: sound,
    label: sound === 'none' ? 'Off' : sound.charAt(0).toUpperCase() + sound.slice(1)
  }));

  const notifyHelp = {
    disabled: 'Beacon stays quiet. The menu bar badge still updates.',
    instant: 'One macOS notification for every new item.',
    summary: 'One digest notification per interval.'
  };

  async function setNotifyMode(mode: NotifyMode): Promise<void> {
    await updateSettings({ notifyMode: mode });
    if (mode !== 'disabled') {
      sendNotification('Beacon', `Notifications set to ${mode} mode.`);
      playNotificationSound(settingsState.notifySound);
    }
  }
</script>

<SettingsGroup title="Desktop notifications">
  <SettingsRow label="Delivery" help={notifyHelp[settingsState.notifyMode]}>
    <Segmented
      label="Delivery"
      options={notifyOptions}
      value={settingsState.notifyMode}
      onChange={setNotifyMode}
    />
  </SettingsRow>
  {#if settingsState.notifyMode === 'summary'}
    <SettingsRow label="Summary interval">
      <Segmented
        label="Summary interval"
        options={summaryOptions}
        value={String(settingsState.notifySummaryMinutes)}
        onChange={(value) => updateSettings({ notifySummaryMinutes: Number(value) })}
      />
    </SettingsRow>
  {/if}
  {#if settingsState.notifyMode !== 'disabled'}
    <SettingsRow label="Sound" help="Plays with each notification.">
      <div class="flex items-center gap-1.5">
        <div class="relative">
          <select
            aria-label="Notification sound"
            value={settingsState.notifySound}
            onchange={(e) => {
              const value = e.currentTarget.value as NotifySound;
              updateSettings({ notifySound: value });
              if (value !== 'none') playNotificationSound(value);
            }}
            class="h-[26px] w-28 cursor-pointer appearance-none rounded-[7px] border border-border-strong bg-card pl-2.5 pr-7 text-xs text-foreground outline-none focus:border-ring"
          >
            {#each soundOptions as option (option.value)}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
          <ChevronDown
            size={11}
            class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
        </div>
        {#if settingsState.notifySound !== 'none'}
          <IconButton
            label="Preview sound"
            onclick={() => playNotificationSound(settingsState.notifySound)}
            class="h-[26px] min-w-[26px] border border-border-strong bg-card"
          >
            <Play size={11} fill="currentColor" />
          </IconButton>
        {/if}
      </div>
    </SettingsRow>
  {/if}
</SettingsGroup>
