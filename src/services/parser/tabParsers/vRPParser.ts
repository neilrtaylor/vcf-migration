// Parser for vRP tab - Resource Pool information
import type { VResourcePoolInfo } from '@/types';
import type { WorkSheet } from 'xlsx';
import { parseSheet, getStringValue, getNumberValue, getBooleanValue } from './utils';

const COLUMN_MAP: Record<string, keyof VResourcePoolInfo | null> = {
  // Name variations - RVTools uses "Resource Pool name"
  'Name': 'name',
  'Resource Pool': 'name',
  'Resource Pool Name': 'name',
  'Resource Pool name': 'name',
  'ResourcePool': 'name',
  'RP': 'name',
  'RP Name': 'name',
  // Config status
  'Config Status': 'configStatus',
  'Config status': 'configStatus',
  'ConfigStatus': 'configStatus',
  'Status': 'configStatus',
  // CPU Reservation - RVTools uses "CPU reservation"
  'CPU Reservation': 'cpuReservation',
  'CPU reservation': 'cpuReservation',
  'CPU Reservation MHz': 'cpuReservation',
  'CpuReservationMHz': 'cpuReservation',
  // CPU Limit - RVTools uses "CPU limit"
  'CPU Limit': 'cpuLimit',
  'CPU limit': 'cpuLimit',
  'CPU Limit MHz': 'cpuLimit',
  'CpuLimitMHz': 'cpuLimit',
  // CPU Expandable - RVTools uses "CPU expandableReservation"
  'CPU Expandable': 'cpuExpandable',
  'CPU expandableReservation': 'cpuExpandable',
  'CpuExpandableReservation': 'cpuExpandable',
  // CPU Shares - RVTools uses "CPU shares"
  'CPU Shares': 'cpuShares',
  'CPU shares': 'cpuShares',
  'NumCpuShares': 'cpuShares',
  'Num CPU Shares': 'cpuShares',
  '# CPU Shares': 'cpuShares',
  // Memory Reservation - RVTools uses "Mem reservation"
  'Memory Reservation': 'memoryReservation',
  'Mem reservation': 'memoryReservation',
  'Mem Reservation': 'memoryReservation',
  'Memory Reservation MB': 'memoryReservation',
  'MemReservationMB': 'memoryReservation',
  'Mem Reservation MB': 'memoryReservation',
  // Memory Limit - RVTools uses "Mem limit"
  'Memory Limit': 'memoryLimit',
  'Mem limit': 'memoryLimit',
  'Mem Limit': 'memoryLimit',
  'Memory Limit MB': 'memoryLimit',
  'MemLimitMB': 'memoryLimit',
  'Mem Limit MB': 'memoryLimit',
  // Memory Expandable - RVTools uses "Mem expandableReservation"
  'Memory Expandable': 'memoryExpandable',
  'Mem expandableReservation': 'memoryExpandable',
  'MemExpandableReservation': 'memoryExpandable',
  'Mem Expandable Reservation': 'memoryExpandable',
  // Memory Shares - RVTools uses "Mem shares"
  'Memory Shares': 'memoryShares',
  'Mem shares': 'memoryShares',
  'Mem Shares': 'memoryShares',
  'NumMemShares': 'memoryShares',
  'Num Mem Shares': 'memoryShares',
  '# Mem Shares': 'memoryShares',
  // VM Count - RVTools uses "# VMs" and "# VMs total"
  '# VMs': 'vmCount',
  '# VMs total': 'vmCount',
  'VMs': 'vmCount',
  'NumVMs': 'vmCount',
  'Num VMs': 'vmCount',
  'VM Count': 'vmCount',
  '# VM': 'vmCount',
  // Location
  'Datacenter': 'datacenter',
  'DataCenter': 'datacenter',
  'Data Center': 'datacenter',
  'Cluster': 'cluster',
  'Parent': 'parent',
  'Parent Pool': 'parent',
  'Parent Resource Pool': 'parent',
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
