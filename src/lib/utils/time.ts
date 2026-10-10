export function timeShort(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);

  if (seconds < 60) return 'now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  const d = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== new Date().getFullYear()) {
    options.year = 'numeric';
  }
  return d.toLocaleDateString('en-GB', options);
}

export function formatWakeTime(dateString: string): string {
  const d = new Date(dateString);
  const dateOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== new Date().getFullYear()) {
    dateOptions.year = 'numeric';
  }
  const datePart = d.toLocaleDateString('de-DE', dateOptions);
  const timePart = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${datePart}, ${timePart}`;
}

export function formatRefreshTime(dateString: string | null): string {
  if (!dateString) return 'Never';
  return new Date(dateString).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit'
  });
}
