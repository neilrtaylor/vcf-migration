// Parser for vCluster tab - cluster information
import type { VClusterInfo } from '@/types';
import type { WorkSheet } from 'xlsx';
import { parseSheet, getStringValue, getNumberValue, getBooleanValue } from './utils';

const COLUMN_MAP: Record<string, keyof VClusterInfo | null> = {
  'Name': 'name',
  'Cluster': 'name',
  'Cluster Name': 'name',
  'Config Status': 'configStatus',
  'Config status': 'configStatus',
  'Overall Status': 'overallStatus',
  'Overall status': 'overallStatus',
  '# VMs': 'vmCount',
  'VMs': 'vmCount',
  'VM Count': 'vmCount',
  '# Hosts': 'hostCount',
  'Hosts': 'hostCount',
  'Host Count': 'hostCount',
  'Total CPU': 'totalCpuMHz',
  'Total CPU MHz': 'totalCpuMHz',
  'Effective CPU': 'effectiveCpuMHz',
  'Effective CPU MHz': 'effectiveCpuMHz',
  'Total Memory': 'totalMemoryMiB',
  'Total Memory MiB': 'totalMemoryMiB',
  'Total Memory MB': 'totalMemoryMiB',
  'Effective Memory': 'effectiveMemoryMiB',
  'Effective Memory MiB': 'effectiveMemoryMiB',
  'Effective Memory MB': 'effectiveMemoryMiB',
  'HA Enabled': 'haEnabled',
  'HA enabled': 'haEnabled',
  'HA Failover Level': 'haFailoverLevel',
  'DRS Enabled': 'drsEnabled',
  'DRS enabled': 'drsEnabled',
  'DRS Behavior': 'drsBehavior',
  'DRS behaviour': 'drsBehavior',
  'EVC Mode': 'evcMode',
  'EVC': 'evcMode',
  'Datacenter': 'datacenter',
};

export function parseVCluster(sheet: WorkSheet): VClusterInfo[] {
  const rows = parseSheet(sheet, COLUMN_MAP);

  return rows.map((row): VClusterInfo => ({
    name: getStringValue(row, 'name'),
    configStatus: getStringValue(row, 'configStatus'),
    overallStatus: getStringValue(row, 'overallStatus'),
    vmCount: getNumberValue(row, 'vmCount'),
    hostCount: getNumberValue(row, 'hostCount'),
    totalCpuMHz: getNumberValue(row, 'totalCpuMHz'),
    effectiveCpuMHz: getNumberValue(row, 'effectiveCpuMHz'),
    totalMemoryMiB: getNumberValue(row, 'totalMemoryMiB'),
    effectiveMemoryMiB: getNumberValue(row, 'effectiveMemoryMiB'),
    haEnabled: getBooleanValue(row, 'haEnabled'),
    haFailoverLevel: getNumberValue(row, 'haFailoverLevel'),
    drsEnabled: getBooleanValue(row, 'drsEnabled'),
    drsBehavior: getStringValue(row, 'drsBehavior'),
    evcMode: getStringValue(row, 'evcMode') || null,
    datacenter: getStringValue(row, 'datacenter'),
  })).filter(cluster => cluster.name);
}
