// Parser for vNetwork tab - network adapter information
import type { VNetworkInfo } from '@/types';
import type { WorkSheet } from 'xlsx';
import { parseSheet, getStringValue, getBooleanValue } from './utils';

const COLUMN_MAP: Record<string, keyof VNetworkInfo | null> = {
  'VM': 'vmName',
  'VM Name': 'vmName',
  'Powerstate': 'powerState',
  'Power State': 'powerState',
  'Template': 'template',
  'NIC': 'nicLabel',
  'Adapter': 'nicLabel',
  'NIC Label': 'nicLabel',
  'Adapter Type': 'adapterType',
  'Type': 'adapterType',
  'Network': 'networkName',
  'Network Name': 'networkName',
  'Switch': 'switchName',
  'Switch Name': 'switchName',
  'Connected': 'connected',
  'Start Connected': 'startsConnected',
  'Starts Connected': 'startsConnected',
  'MAC Address': 'macAddress',
  'MAC': 'macAddress',
  'MAC Type': 'macType',
  'IP Address': 'ipv4Address',
  'IPv4 Address': 'ipv4Address',
  'IP': 'ipv4Address',
  'IPv6 Address': 'ipv6Address',
  'DirectPath IO': 'directPathIO',
  'Datacenter': 'datacenter',
  'Cluster': 'cluster',
  'Host': 'host',
};

export function parseVNetwork(sheet: WorkSheet): VNetworkInfo[] {
  const rows = parseSheet(sheet, COLUMN_MAP);

  return rows.map((row): VNetworkInfo => ({
    vmName: getStringValue(row, 'vmName'),
    powerState: getStringValue(row, 'powerState'),
    template: getBooleanValue(row, 'template'),
    nicLabel: getStringValue(row, 'nicLabel'),
    adapterType: getStringValue(row, 'adapterType'),
    networkName: getStringValue(row, 'networkName'),
    switchName: getStringValue(row, 'switchName'),
    connected: getBooleanValue(row, 'connected'),
    startsConnected: getBooleanValue(row, 'startsConnected'),
    macAddress: getStringValue(row, 'macAddress'),
    macType: getStringValue(row, 'macType'),
    ipv4Address: getStringValue(row, 'ipv4Address') || null,
    ipv6Address: getStringValue(row, 'ipv6Address') || null,
    directPathIO: getBooleanValue(row, 'directPathIO'),
    datacenter: getStringValue(row, 'datacenter'),
    cluster: getStringValue(row, 'cluster'),
    host: getStringValue(row, 'host'),
  })).filter(net => net.vmName);
}
