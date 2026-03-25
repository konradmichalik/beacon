<script lang="ts">
  import { onMount } from 'svelte';
  import TrayPopup from '$lib/components/layout/TrayPopup.svelte';
  import Toast from '$lib/components/ui/Toast.svelte';
  import BeaconLogo from '$lib/components/icons/BeaconLogo.svelte';
  import { initializeConnections } from '$lib/stores/connections.svelte';
  import { settingsState, initializeSettings, updateSettings } from '$lib/stores/settings.svelte';
  import { initializeMuteRules } from '$lib/stores/mute-rules.svelte';
  import { loadStarredPRs } from '$lib/stores/starred-prs.svelte';
  import { loadDemoData } from '$lib/stores/notifications.svelte';
  import { loadDemoPRs } from '$lib/stores/pull-requests.svelte';
  import { Sun, Moon, Github, Copy, Check } from '@lucide/svelte';

  let isInitializing = $state(true);
  let isDark = $state(true);
  let demoClosed = $state(false);
  let copiedCommand = $state<string | null>(null);

  const version = __APP_VERSION__;

  function toggleTheme(): void {
    isDark = !isDark;
    const mode = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-color-mode', mode);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    updateSettings({ theme: mode });
  }

  async function copyCommand(cmd: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(cmd);
      copiedCommand = cmd;
      setTimeout(() => (copiedCommand = null), 2000);
    } catch {
      // Clipboard access denied or unavailable
    }
  }

  let installTab: 'homebrew' | 'dmg' = $state('homebrew');

  onMount(() => {
    async function initialize(): Promise<void> {
      try {
        await initializeSettings();
        // Sync local state from loaded/overridden settings
        const resolved =
          settingsState.theme === 'system'
            ? window.matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light'
            : settingsState.theme;
        isDark = resolved === 'dark';
        document.documentElement.setAttribute('data-color-mode', resolved);
        document.documentElement.classList.toggle('dark', isDark);

        await initializeMuteRules();
        await loadStarredPRs();
        await initializeConnections();
        loadDemoData();
        loadDemoPRs();
      } finally {
        isInitializing = false;
      }
    }

    initialize();
  });
</script>

{#snippet codeBlock(cmd: string)}
  <div class="code-block">
    <code>{cmd}</code>
    <button
      type="button"
      class="code-copy"
      onclick={() => copyCommand(cmd)}
      title="Copy to clipboard"
    >
      {#if copiedCommand === cmd}
        <Check size={14} />
      {:else}
        <Copy size={14} />
      {/if}
    </button>
  </div>
{/snippet}

<div class="landing" class:landing-dark={isDark} class:landing-light={!isDark}>
  <!-- Header -->
  <header class="landing-header">
    <div class="landing-header-inner">
      <a href="#top" class="landing-header-logo">
        <BeaconLogo height={26} class="header-logo-svg" />
      </a>
      <div class="landing-header-right">
        <span class="version-badge">v{version}</span>
        <a
          href="https://github.com/konradmichalik/beacon"
          class="landing-header-link"
          target="_blank"
          rel="noopener noreferrer"
          title="View on GitHub"
        >
          <Github size={16} />
        </a>
        <button
          type="button"
          class="landing-header-link"
          onclick={toggleTheme}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {#if isDark}
            <Sun size={16} />
          {:else}
            <Moon size={16} />
          {/if}
        </button>
      </div>
    </div>
  </header>

  <!-- Hero -->
  <section class="hero">
    <div class="hero-inner">
      <h1>All your notifications.<br /><span class="gradient-text">One menu bar.</span></h1>
      <p class="hero-subtitle">
        Beacon is a free, open-source macOS app that unifies GitHub and GitLab notifications in a
        single, fast menu bar popup.
      </p>

      <div class="hero-actions">
        <a
          href="https://github.com/konradmichalik/beacon"
          class="btn btn-primary"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Github size={16} />
          View on GitHub
        </a>
        <a href="#get-started" class="btn btn-secondary">Get Started</a>
      </div>

      <!-- Embedded Demo -->
      <div class="demo-wrapper">
        {#if demoClosed}
          <div class="demo-closed">
            <p>Beacon closed.</p>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              onclick={() => (demoClosed = false)}
            >
              Reopen Demo
            </button>
          </div>
        {:else}
          <div class="demo-frame">
            {#if isInitializing}
              <div
                class="flex h-full items-center justify-center bg-background"
                style="border-radius: 12px;"
              >
                <div
                  class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
                ></div>
              </div>
            {:else}
              <TrayPopup onQuit={() => (demoClosed = true)} />
              <Toast />
            {/if}
          </div>
        {/if}
        <p class="demo-hint">Interactive demo with sample data</p>
      </div>
    </div>
  </section>

  <!-- Features -->
  <section class="features" id="features">
    <h2>Built for developers who ship</h2>
    <p class="section-subtitle">
      Stop switching between browser tabs. Beacon brings everything to your fingertips.
    </p>

    <div class="feature-grid">
      <div class="feature-card">
        <div class="feature-icon" style="background: rgba(94,129,172,0.18)">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#5e81ac"
            stroke-width="2"
            ><path
              d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
            /><polyline points="22,6 12,13 2,6" /></svg
          >
        </div>
        <h3>Unified Inbox</h3>
        <p>
          GitHub and GitLab notifications side by side. Filter by source, type, project, or read
          status.
        </p>
      </div>

      <div class="feature-card">
        <div class="feature-icon" style="background: rgba(163,190,140,0.18)">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#a3be8c"
            stroke-width="2"
            ><circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path
              d="M13 6h3a2 2 0 0 1 2 2v7"
            /><path d="M6 9v12" /></svg
          >
        </div>
        <h3>Pull Request Overview</h3>
        <p>
          See open PRs you authored or need to review, with CI pipeline status and review decisions
          at a glance.
        </p>
      </div>

      <div class="feature-card">
        <div class="feature-icon" style="background: rgba(208,135,112,0.18)">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#d08770"
            stroke-width="2"
            ><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path
              d="M13.73 21a2 2 0 0 1-3.46 0"
            /></svg
          >
        </div>
        <h3>Desktop Alerts</h3>
        <p>
          Get notified instantly or receive batched summaries. Choose from 15 notification sounds or
          stay silent.
        </p>
      </div>

      <div class="feature-card">
        <div class="feature-icon" style="background: rgba(180,142,173,0.18)">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#b48ead"
            stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg
          >
        </div>
        <h3>Private by Design</h3>
        <p>
          Tokens stored locally in an encrypted store. Nothing is sent anywhere except GitHub and
          GitLab.
        </p>
      </div>

      <div class="feature-card">
        <div class="feature-icon" style="background: rgba(235,203,139,0.18)">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ebcb8b"
            stroke-width="2"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg
          >
        </div>
        <h3>Lightweight &amp; Fast</h3>
        <p>
          Built with Tauri and Svelte. Tiny binary, minimal memory footprint, instant startup from
          your menu bar.
        </p>
      </div>

      <div class="feature-card">
        <div class="feature-icon" style="background: rgba(136,192,208,0.18)">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#88c0d0"
            stroke-width="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg
          >
        </div>
        <h3>Smart Filtering</h3>
        <p>
          Mute noisy repos, filter by type or author, and focus on what matters. Your rules persist
          across sessions.
        </p>
      </div>
    </div>
  </section>

  <!-- Get Started -->
  <section class="get-started" id="get-started">
    <h2>Get started in 60 seconds</h2>

    <div class="install-tabs">
      <button
        type="button"
        class="install-tab"
        class:active={installTab === 'homebrew'}
        onclick={() => (installTab = 'homebrew')}>Homebrew</button
      >
      <button
        type="button"
        class="install-tab"
        class:active={installTab === 'dmg'}
        onclick={() => (installTab = 'dmg')}>Direct Download</button
      >
    </div>

    {#if installTab === 'homebrew'}
      <div class="install-content">
        <div class="step">
          <div class="step-number">1</div>
          <div class="step-body">
            <h3>Install via Homebrew</h3>
            <p>One command, no dependencies.</p>
            {@render codeBlock('brew install konradmichalik/tap/beacon')}
          </div>
        </div>
        <div class="step">
          <div class="step-number">2</div>
          <div class="step-body">
            <h3>Add your tokens</h3>
            <p>
              Open Settings and paste your GitHub or GitLab personal access token. GitHub needs the <code
                >notifications</code
              >
              scope, GitLab needs <code>api</code>.
            </p>
          </div>
        </div>
        <div class="step">
          <div class="step-number">3</div>
          <div class="step-body">
            <h3>You're done</h3>
            <p>
              Beacon polls for notifications in the background. Click the menu bar icon to see what
              needs your attention.
            </p>
          </div>
        </div>

        <div class="update-hint">
          <h4>Update to the latest version</h4>
          {@render codeBlock('brew update && brew upgrade beacon')}
        </div>
      </div>
    {:else}
      <div class="install-content">
        <div class="step">
          <div class="step-number">1</div>
          <div class="step-body">
            <h3>Download the DMG</h3>
            <p>Grab the latest release from GitHub.</p>
            <a
              href="https://github.com/konradmichalik/beacon/releases/latest"
              class="btn btn-primary btn-sm"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download Latest Release
            </a>
          </div>
        </div>
        <div class="step">
          <div class="step-number">2</div>
          <div class="step-body">
            <h3>Install & allow execution</h3>
            <p>
              Drag Beacon to Applications. Since the app is not notarized yet, macOS will block it.
              Run this command to allow it:
            </p>
            {@render codeBlock('xattr -cr /Applications/Beacon.app')}
          </div>
        </div>
        <div class="step">
          <div class="step-number">3</div>
          <div class="step-body">
            <h3>Add your tokens</h3>
            <p>
              Open Settings and paste your GitHub or GitLab personal access token. GitHub needs the <code
                >notifications</code
              >
              scope, GitLab needs <code>api</code>.
            </p>
          </div>
        </div>
        <div class="step">
          <div class="step-number">4</div>
          <div class="step-body">
            <h3>You're done</h3>
            <p>
              Beacon polls for notifications in the background. Click the menu bar icon to see what
              needs your attention.
            </p>
          </div>
        </div>
      </div>
    {/if}
  </section>

  <!-- Footer -->
  <footer class="landing-footer">
    <p>
      <a href="https://github.com/konradmichalik/beacon" target="_blank" rel="noopener noreferrer"
        >GitHub</a
      >
      <span class="footer-dot">&middot;</span>
      <a
        href="https://github.com/konradmichalik/beacon/releases"
        target="_blank"
        rel="noopener noreferrer">Releases</a
      >
      <span class="footer-dot">&middot;</span>
      MIT License
    </p>
    <p class="footer-copy">&copy; {new Date().getFullYear()} Konrad Michalik</p>
  </footer>
</div>
