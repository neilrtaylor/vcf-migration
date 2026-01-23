// Formatting utilities for display

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Format MiB to appropriate unit
 */
export function formatMiB(mib: number, decimals = 2): string {
  if (mib < 1024) {
    return `${mib.toFixed(decimals)} MiB`;
  }
  if (mib < 1024 * 1024) {
    return `${(mib / 1024).toFixed(decimals)} GiB`;
  }
  return `${(mib / (1024 * 1024)).toFixed(decimals)} TiB`;
}

/**
 * Convert MiB to GiB
 */
export function mibToGiB(mib: number): number {
  return mib / 1024;
}

/**
 * Convert MiB to TiB
 */
export function mibToTiB(mib: number): number {
  return mib / (1024 * 1024);
}

/**
 * Format number with commas and optional decimal places
 */
export function formatNumber(num: number, decimals?: number): string {
  if (decimals !== undefined) {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  return num.toLocaleString();
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format date to localized string
 */
export function formatDate(date: Date | null): string {
  if (!date) return 'N/A';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format date with time
 */
export function formatDateTime(date: Date | null): string {
  if (!date) return 'N/A';
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format duration in days
 */
export function formatDuration(days: number): string {
  if (days < 1) {
    const hours = Math.round(days * 24);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  if (days < 30) {
    const roundedDays = Math.round(days);
    return `${roundedDays} day${roundedDays !== 1 ? 's' : ''}`;
  }
  if (days < 365) {
    const months = Math.round(days / 30);
    return `${months} month${months !== 1 ? 's' : ''}`;
  }
  const years = (days / 365).toFixed(1);
  return `${years} year${parseFloat(years) !== 1 ? 's' : ''}`;
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.substring(0, maxLength - 3)}...`;
}

/**
 * Format power state for display
 */
export function formatPowerState(state: string): string {
  switch (state.toLowerCase()) {
    case 'poweredon':
      return 'Powered On';
    case 'poweredoff':
      return 'Powered Off';
    case 'suspended':
      return 'Suspended';
    default:
      return state;
  }
}

/**
 * Get color for power state
 */
export function getPowerStateColor(state: string): string {
  switch (state.toLowerCase()) {
    case 'poweredon':
      return '#24a148'; // green
    case 'poweredoff':
      return '#6f6f6f'; // gray
    case 'suspended':
      return '#f1c21b'; // yellow
    default:
      return '#6f6f6f';
  }
}

/**
 * Format hardware version
 */
export function formatHardwareVersion(version: string): string {
  // Extract version number from strings like "vmx-19", "19", etc.
  const match = version.match(/(\d+)/);
  return match ? `v${match[1]}` : version;
}

/**
 * Get hardware version number
 */
export function getHardwareVersionNumber(version: string): number {
  const match = version.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}
