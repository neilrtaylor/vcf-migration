// Parser for vDatastore tab - datastore information
import type { VDatastoreInfo } from '@/types';
import type { WorkSheet } from 'xlsx';
import { parseSheet, getStringValue, getNumberValue, getBooleanValue } from './utils';

const COLUMN_MAP: Record<string, keyof VDatastoreInfo | null> = {
  'Name': 'name',
  'Datastore': 'name',
  'Datastore Name': 'name',
  'Config Status': 'configStatus',
  'Config status': 'configStatus',
  'Address': 'address',
  'Accessible': 'accessible',
  'Type': 'type',
  'Datastore Type': 'type',
  '# VM Total': 'vmTotalCount',
  'VM Total': 'vmTotalCount',
  '# VMs': 'vmCount',
  'VMs': 'vmCount',
  'VM Count': 'vmCount',
  'Capacity MB': 'capacityMiB',
  'Capacity MiB': 'capacityMiB',
  'Capacity': 'capacityMiB',
  'Provisioned MB': 'provisionedMiB',
  'Provisioned MiB': 'provisionedMiB',
  'Provisioned': 'provisionedMiB',
  'In Use MB': 'inUseMiB',
  'In Use MiB': 'inUseMiB',
  'In Use': 'inUseMiB',
  'Free MB': 'freeMiB',
  'Free MiB': 'freeMiB',
  'Free': 'freeMiB',
  'Free %': 'freePercent',
  'Free Percent': 'freePercent',
  'SIOC Enabled': 'siocEnabled',
  'Sioc Enabled': 'siocEnabled',
  'SIOC Threshold': 'siocThreshold',
  '# Hosts': 'hostCount',
  '#Hosts': 'hostCount',
  'Host Count': 'hostCount',
  'Number of Hosts': 'hostCount',
  'Num Hosts': 'hostCount',
  'Hosts': 'hosts',
  'Datacenter': 'datacenter',
  'Cluster': 'cluster',
};

// Calculate host count from comma-separated hosts string
function calculateHostCount(hostsStr: string | null): number {
  if (!hostsStr) return 0;
  // Split by comma and count non-empty entries
  return hostsStr.split(',').map(h => h.trim()).filter(h => h.length > 0).length;
}

// Check if a value is a number or can be parsed as a number
function isNumericValue(value: unknown): boolean {
  if (typeof value === 'number') return true;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed !== '' && !isNaN(Number(trimmed));
  }
  return false;
}

export function parseVDatastore(sheet: WorkSheet): VDatastoreInfo[] {
  const rows = parseSheet(sheet, COLUMN_MAP);

  // Debug: Log first few rows to check hosts parsing
  if (import.meta.env.DEV && rows.length > 0) {
    const sampleRows = rows.slice(0, 3);
    console.debug('[vDatastore Parser] Sample raw rows:', sampleRows.map(r => ({
      name: r.name,
      hostCount: r.hostCount,
      hosts: r.hosts,
      vmCount: r.vmCount,
    })));
  }

  return rows.map((row): VDatastoreInfo => {
    const hostsStr = getStringValue(row, 'hosts') || null;
    const hostCountRaw = row.hostCount;

    // hostCount can be either a number (from "# Hosts" column) or
    // calculated from comma-separated hosts string
    let hostCount: number;
    if (isNumericValue(hostCountRaw)) {
      hostCount = getNumberValue(row, 'hostCount');
    } else if (typeof hostCountRaw === 'string' && hostCountRaw.trim()) {
      // The "# Hosts" column contains host names (single or comma-separated)
      hostCount = calculateHostCount(hostCountRaw);
    } else if (hostsStr) {
      // Calculate from separate "Hosts" column
      hostCount = calculateHostCount(hostsStr);
    } else {
      hostCount = 0;
    }

    return {
      name: getStringValue(row, 'name'),
      configStatus: getStringValue(row, 'configStatus'),
      address: getStringValue(row, 'address') || null,
      accessible: getBooleanValue(row, 'accessible'),
      type: getStringValue(row, 'type'),
      vmTotalCount: getNumberValue(row, 'vmTotalCount'),
      vmCount: getNumberValue(row, 'vmCount'),
      capacityMiB: getNumberValue(row, 'capacityMiB'),
      provisionedMiB: getNumberValue(row, 'provisionedMiB'),
      inUseMiB: getNumberValue(row, 'inUseMiB'),
      freeMiB: getNumberValue(row, 'freeMiB'),
      freePercent: getNumberValue(row, 'freePercent'),
      siocEnabled: getBooleanValue(row, 'siocEnabled'),
      siocThreshold: getNumberValue(row, 'siocThreshold') || null,
      hosts: hostsStr,
      hostCount,
      datacenter: getStringValue(row, 'datacenter'),
      cluster: getStringValue(row, 'cluster') || null,
    };
  }).filter(ds => ds.name);
}
