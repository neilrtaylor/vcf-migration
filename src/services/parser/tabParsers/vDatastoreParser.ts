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
  'Hosts': 'hostCount',
  'Host Count': 'hostCount',
  'Datacenter': 'datacenter',
  'Cluster': 'cluster',
};

export function parseVDatastore(sheet: WorkSheet): VDatastoreInfo[] {
  const rows = parseSheet(sheet, COLUMN_MAP);

  return rows.map((row): VDatastoreInfo => ({
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
    hostCount: getNumberValue(row, 'hostCount'),
    datacenter: getStringValue(row, 'datacenter'),
    cluster: getStringValue(row, 'cluster') || null,
  })).filter(ds => ds.name);
}
