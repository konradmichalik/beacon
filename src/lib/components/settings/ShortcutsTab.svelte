<script lang="ts">
  import { settingsState, updateSettings } from '$lib/stores/settings.svelte';
  import Kbd from '$lib/components/ui/Kbd.svelte';
  import Switch from '$lib/components/ui/Switch.svelte';
  import SettingsGroup from './SettingsGroup.svelte';
  import SettingsRow from './SettingsRow.svelte';

  const groups = [
    {
      title: 'Popup',
      shortcuts: [
        { keys: ['1'], action: 'Inbox' },
        { keys: ['2'], action: 'My PRs' },
        { keys: ['3'], action: 'Issues, when enabled' },
        { keys: ['←', '→'], action: 'Previous or next tab' },
        { keys: ['R'], action: 'Refresh' },
        { keys: ['/'], action: 'Focus the filter bar' },
        { keys: ['Esc'], action: 'Close popup' }
      ]
    },
    {
      title: 'Lists and items',
      shortcuts: [
        { keys: ['↑', '↓'], action: 'Move selection' },
        { keys: ['Home', 'End'], action: 'First or last item' },
        { keys: ['↵'], action: 'Open in browser' },
        { keys: ['⇧', 'F10'], action: 'Context menu' },
        { keys: ['M'], action: 'Mark as read (Inbox)' },
        { keys: ['Z'], action: 'Snooze until tomorrow (Inbox)' },
        { keys: ['S'], action: 'Star or unstar (My PRs)' }
      ]
    }
  ];
</script>

<SettingsGroup title="Global">
  <SettingsRow label="Global shortcut" help="Toggle Beacon from any app.">
    <div class="flex items-center gap-3">
      <span class="flex gap-0.5">
        <Kbd size="md">&#8984;</Kbd>
        <Kbd size="md">&#8679;</Kbd>
        <Kbd size="md">B</Kbd>
      </span>
      <Switch
        label="Global shortcut"
        checked={settingsState.globalShortcut}
        onchange={(globalShortcut) => updateSettings({ globalShortcut })}
      />
    </div>
  </SettingsRow>
</SettingsGroup>

{#each groups as group (group.title)}
  <SettingsGroup title={group.title}>
    {#each group.shortcuts as shortcut (shortcut.action)}
      <SettingsRow label={shortcut.action}>
        <span class="flex gap-0.5">
          {#each shortcut.keys as key (key)}
            <Kbd size="md">{key}</Kbd>
          {/each}
        </span>
      </SettingsRow>
    {/each}
  </SettingsGroup>
{/each}
