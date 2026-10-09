<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { Link, SlidersHorizontal, BellRing, Keyboard, Info } from '@lucide/svelte';
  import GitHubConnectionForm from '../connection/GitHubConnectionForm.svelte';
  import GitLabConnectionForm from '../connection/GitLabConnectionForm.svelte';
  import PreferencesTab from './PreferencesTab.svelte';
  import AlertsTab from './AlertsTab.svelte';
  import ShortcutsTab from './ShortcutsTab.svelte';
  import AboutTab from './AboutTab.svelte';

  type SettingsTab = 'connections' | 'preferences' | 'alerts' | 'shortcuts' | 'about';

  const tabs: { value: SettingsTab; label: string; icon: typeof Link }[] = [
    { value: 'connections', label: 'Connections', icon: Link },
    { value: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
    { value: 'alerts', label: 'Alerts', icon: BellRing },
    { value: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
    { value: 'about', label: 'About', icon: Info }
  ];

  function initialTab(): SettingsTab {
    const requested = new URLSearchParams(window.location.search).get('tab');
    return tabs.some((tab) => tab.value === requested) ? (requested as SettingsTab) : 'connections';
  }

  let activeTab: SettingsTab = $state(initialTab());

  onMount(() => {
    if (new URLSearchParams(window.location.search).get('tab') !== 'preferences') return;
    tick().then(() => {
      document.getElementById('mute-rules')?.scrollIntoView({ block: 'start' });
    });
  });

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const index = tabs.findIndex((tab) => tab.value === activeTab);
    const step = e.key === 'ArrowRight' ? 1 : -1;
    activeTab = tabs[(index + step + tabs.length) % tabs.length].value;
    requestAnimationFrame(() => {
      (e.currentTarget as HTMLElement)
        .querySelector<HTMLElement>('[aria-selected="true"]')
        ?.focus();
    });
  }
</script>

<!-- svelte-ignore a11y_interactive_supports_focus -->
<div
  role="tablist"
  aria-label="Settings sections"
  onkeydown={handleKeydown}
  class="sticky top-0 z-10 flex justify-center gap-1 border-b border-border bg-muted px-3 py-2"
>
  {#each tabs as tab (tab.value)}
    {@const Icon = tab.icon}
    {@const selected = activeTab === tab.value}
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      tabindex={selected ? 0 : -1}
      onclick={() => (activeTab = tab.value)}
      class="flex h-12 w-20 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] transition-colors {selected
        ? 'bg-card font-semibold text-accent-foreground shadow-sm'
        : 'font-medium text-muted-foreground hover:text-foreground'}"
    >
      <Icon size={18} />
      {tab.label}
    </button>
  {/each}
</div>

<div class="px-5 pb-5 pt-4">
  {#if activeTab === 'connections'}
    <div class="space-y-3">
      <GitHubConnectionForm />
      <GitLabConnectionForm />
    </div>
  {:else if activeTab === 'preferences'}
    <PreferencesTab />
  {:else if activeTab === 'alerts'}
    <AlertsTab />
  {:else if activeTab === 'shortcuts'}
    <ShortcutsTab />
  {:else}
    <AboutTab />
  {/if}
</div>
