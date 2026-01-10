// Parser for vRP tab - Resource Pool information
import type { VResourcePoolInfo } from '@/types';
import type { WorkSheet } from 'xlsx';
import { parseSheet, getStringValue, getNumberValue, getBooleanValue } from './utils';

const COLUMN_MAP: Record<string, keyof VResourcePoolInfo | null> = {
  'Name': 'name',
  'Resource Pool': 'name',
  'Resource Pool Name': 'name',
  'Config Status': 'configStatus',
  'Config status': 'configStatus',
  'CPU Reservation': 'cpuReservation',
  'CPU Reservation MHz': 'cpuReservation',
  'CpuReservationMHz': 'cpuReservation',
  'CPU Limit': 'cpuLimit',
  'CPU Limit MHz': 'cpuLimit',
  'CpuLimitMHz': 'cpuLimit',
  'CPU Expandable': 'cpuExpandable',
  'CpuExpandableReservation': 'cpuExpandable',
  'CPU Shares': 'cpuShares',
  'NumCpuShares': 'cpuShares',
  'Num CPU Shares': 'cpuShares',
  'Memory Reservation': 'memoryReservation',
  'Memory Reservation MB': 'memoryReservation',
  'MemReservationMB': 'memoryReservation',
  'Mem Reservation MB': 'memoryReservation',
  'Memory Limit': 'memoryLimit',
  'Memory Limit MB': 'memoryLimit',
  'MemLimitMB': 'memoryLimit',
  'Mem Limit MB': 'memoryLimit',
  'Memory Expandable': 'memoryExpandable',
  'MemExpandableReservation': 'memoryExpandable',
  'Memory Shares': 'memoryShares',
  'NumMemShares': 'memoryShares',
  'Num Mem Shares': 'memoryShares',
  '# VMs': 'vmCount',
  'VMs': 'vmCount',
  'NumVMs': 'vmCount',
  'Num VMs': 'vmCount',
  'VM Count': 'vmCount',
  'Datacenter': 'datacenter',
  'Cluster': 'cluster',
  'Parent': 'parent',
  'Parent Pool': 'parent',
};

export function parseVRP(sheet: WorkSheet): VResourcePoolInfo[] {
  const rows = parseSheet(sheet, COLUMN_MAP);

  return rows.map((row): VResourcePoolInfo => ({
    name: getStringValue(row, 'name'),
    configStatus: getStringValue(row, 'configStatus'),
    cpuReservation: getNumberValue(row, 'cpuReservation'),
    cpuLimit: getNumberValue(row, 'cpuLimit'),
    cpuExpandable: getBooleanValue(row, 'cpuExpandable'),
    cpuShares: getNumberValue(row, 'cpuShares'),
    memoryReservation: getNumberValue(row, 'memoryReservation'),
    memoryLimit: getNumberValue(row, 'memoryLimit'),
    memoryExpandable: getBooleanValue(row, 'memoryExpandable'),
    memoryShares: getNumberValue(row, 'memoryShares'),
    vmCount: getNumberValue(row, 'vmCount'),
    datacenter: getStringValue(row, 'datacenter'),
    cluster: getStringValue(row, 'cluster'),
    parent: getStringValue(row, 'parent') || null,
  })).filter(rp => rp.name);
}
