<script lang="ts">
  import {
    AlertCircle,
    ArrowUpCircle,
    BookOpen,
    CheckCircle,
    ExternalLink,
    RefreshCw
  } from '@lucide/svelte';
  import BeaconLogo from '../icons/BeaconLogo.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import {
    checkForUpdates,
    type UpdateStatus,
    type UpdateCheckResult
  } from '$lib/services/update-check';
  import { isTauri } from '$lib/utils/storage';
  import SettingsGroup from './SettingsGroup.svelte';
  import SettingsRow from './SettingsRow.svelte';

  const version = __APP_VERSION__;
  const buildDate = new Date(__BUILD_DATE__).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  let updateStatus: UpdateStatus = $state('idle');
  let updateResult: UpdateCheckResult = $state({ status: 'idle' });

  async function handleCheckForUpdates(): Promise<void> {
    updateStatus = 'checking';
    updateResult = await checkForUpdates(version);
    updateStatus = updateResult.status;
  }

  async function quit(): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('quit_app');
  }
</script>

<div class="flex flex-col items-center gap-3 pb-5 pt-3 text-center">
  <img src="/beacon-icon.png" alt="" width="64" height="64" />
  <BeaconLogo height={26} class="text-foreground" />
  <p class="text-xs text-subtlest">Unified notifications and pull requests for GitHub and GitLab</p>
</div>

<SettingsGroup title="Beacon">
  <SettingsRow label="Version">
    <span class="font-mono text-xs text-subtlest">v{version}</span>
  </SettingsRow>
  <SettingsRow label="Build">
    <span class="text-xs text-subtlest">{buildDate}</span>
  </SettingsRow>
  <div aria-live="polite" aria-atomic="true">
    <SettingsRow label="Updates">
      <div class="flex items-center gap-2.5 text-xs">
        {#if updateStatus === 'checking'}
          <span class="inline-flex items-center gap-1.5 text-subtlest">
            <RefreshCw size={12} class="animate-spin" />
            Checking…
          </span>
        {:else if updateStatus === 'up-to-date'}
          <span class="inline-flex items-center gap-1.5 font-medium text-success-text">
            <CheckCircle size={12} />
            Up to date
          </span>
        {:else if updateStatus === 'update-available'}
          <a
            href={updateResult.releaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 font-medium text-accent-foreground"
          >
            <ArrowUpCircle size={12} />
            {updateResult.latestVersion} available
          </a>
        {:else if updateStatus === 'error'}
          <span class="inline-flex items-center gap-1.5 font-medium text-destructive">
            <AlertCircle size={12} />
            Check failed
            <span class="sr-only">{updateResult.error}</span>
          </span>
        {/if}
        {#if updateStatus !== 'checking'}
          <Button onclick={handleCheckForUpdates}>
            {updateStatus === 'idle' ? 'Check for updates' : 'Check again'}
          </Button>
        {/if}
      </div>
    </SettingsRow>
  </div>
</SettingsGroup>

<div class="mt-4 flex flex-wrap justify-center gap-2">
  <Button href="https://github.com/konradmichalik/beacon">
    <ExternalLink size={12} />
    GitHub
  </Button>
  <Button href="https://konradmichalik.github.io/beacon/">
    <BookOpen size={12} />
    Documentation
  </Button>
  {#if isTauri()}
    <Button variant="danger" onclick={quit}>Quit Beacon</Button>
  {/if}
</div>

<p class="mt-4 text-center text-[11px] text-subtlest">
  &copy; {new Date().getFullYear()} Konrad Michalik
</p>
