// Unit tests for formatters
import { describe, it, expect } from 'vitest';
import {
  formatNumber,
  formatBytes,
  formatPercent,
  mibToGiB,
  mibToTiB,
  formatDate,
  formatDateTime,
  truncate,
  formatDuration,
  formatPowerState,
  formatHardwareVersion,
  getHardwareVersionNumber,
} from './formatters';

describe('formatNumber', () => {
  it('formats integers with commas', () => {
    expect(formatNumber(1000)).toBe('1,000');
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('handles zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('handles negative numbers', () => {
    expect(formatNumber(-1000)).toBe('-1,000');
  });
});

describe('formatBytes', () => {
  it('formats bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
    expect(formatBytes(1024)).toBe('1 KiB');
    expect(formatBytes(1048576)).toBe('1 MiB');
    expect(formatBytes(1073741824)).toBe('1 GiB');
  });

  it('respects decimals parameter', () => {
    expect(formatBytes(1536, 1)).toBe('1.5 KiB');
  });
});

describe('formatPercent', () => {
  it('formats percentages with default decimals', () => {
    expect(formatPercent(75.5)).toBe('75.5%');
  });

  it('respects decimal parameter', () => {
    expect(formatPercent(75.567, 2)).toBe('75.57%');
    expect(formatPercent(75, 0)).toBe('75%');
  });
});

describe('mibToGiB', () => {
  it('converts MiB to GiB correctly', () => {
    expect(mibToGiB(1024)).toBe(1);
    expect(mibToGiB(2048)).toBe(2);
    expect(mibToGiB(512)).toBe(0.5);
  });

  it('handles zero', () => {
    expect(mibToGiB(0)).toBe(0);
  });
});

describe('mibToTiB', () => {
  it('converts MiB to TiB correctly', () => {
    expect(mibToTiB(1048576)).toBe(1);
    expect(mibToTiB(2097152)).toBe(2);
  });

  it('handles zero', () => {
    expect(mibToTiB(0)).toBe(0);
  });
});

describe('formatDate', () => {
  it('formats dates correctly', () => {
    const date = new Date('2024-03-15');
    const formatted = formatDate(date);
    expect(formatted).toContain('2024');
    expect(formatted).toContain('Mar');
  });

  it('returns N/A for null', () => {
    expect(formatDate(null)).toBe('N/A');
  });
});

describe('formatDateTime', () => {
  it('formats datetime correctly', () => {
    const date = new Date('2024-03-15T14:30:00');
    const formatted = formatDateTime(date);
    expect(formatted).toContain('2024');
  });

  it('returns N/A for null', () => {
    expect(formatDateTime(null)).toBe('N/A');
  });
});

describe('truncate', () => {
  it('truncates long strings', () => {
    expect(truncate('This is a very long string', 15)).toBe('This is a ve...');
  });

  it('does not truncate short strings', () => {
    expect(truncate('Short', 10)).toBe('Short');
  });

  it('handles exact length', () => {
    expect(truncate('Exactly 10', 10)).toBe('Exactly 10');
  });
});

describe('formatDuration', () => {
  it('formats hours for less than a day', () => {
    expect(formatDuration(0.5)).toBe('12 hours');
    expect(formatDuration(0.04)).toBe('1 hour');
  });

  it('formats days correctly', () => {
    expect(formatDuration(1)).toBe('1 day');
    expect(formatDuration(5)).toBe('5 days');
  });

  it('formats months correctly', () => {
    expect(formatDuration(60)).toBe('2 months');
  });

  it('formats years correctly', () => {
    expect(formatDuration(365)).toBe('1.0 year');
    expect(formatDuration(730)).toBe('2.0 years');
  });
});

describe('formatPowerState', () => {
  it('formats power states correctly', () => {
    expect(formatPowerState('poweredon')).toBe('Powered On');
    expect(formatPowerState('poweredoff')).toBe('Powered Off');
    expect(formatPowerState('suspended')).toBe('Suspended');
    expect(formatPowerState('unknown')).toBe('unknown');
  });
});

describe('formatHardwareVersion', () => {
  it('extracts version number from vmx format', () => {
    expect(formatHardwareVersion('vmx-19')).toBe('v19');
    expect(formatHardwareVersion('vmx-21')).toBe('v21');
  });

  it('handles plain numbers', () => {
    expect(formatHardwareVersion('19')).toBe('v19');
  });

  it('returns original for non-matching strings', () => {
    expect(formatHardwareVersion('unknown')).toBe('unknown');
  });
});

describe('getHardwareVersionNumber', () => {
  it('extracts numeric version', () => {
    expect(getHardwareVersionNumber('vmx-19')).toBe(19);
    expect(getHardwareVersionNumber('21')).toBe(21);
  });

  it('returns 0 for non-matching strings', () => {
    expect(getHardwareVersionNumber('unknown')).toBe(0);
  });
});
