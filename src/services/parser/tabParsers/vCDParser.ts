// Parser for vCD tab - CD-ROM information
import type { VCDInfo } from '@/types';
import type { WorkSheet } from 'xlsx';
import { parseSheet, getStringValue, getBooleanValue } from './utils';

const COLUMN_MAP: Record<string, keyof VCDInfo | null> = {
  'VM': 'vmName',
  'VM Name': 'vmName',
  'Powerstate': 'powerState',
  'Power State': 'powerState',
  'Template': 'template',
  'Device': 'deviceNode',
  'Device Node': 'deviceNode',
  'CD/DVD': 'deviceNode',
  'Label': 'deviceNode',
  'Connected': 'connected',
  'Start Connected': 'startsConnected',
  'Starts Connected': 'startsConnected',
  'Device Type': 'deviceType',
  'Type': 'deviceType',
  'Annotation': 'annotation',
  'Notes': 'annotation',
  'Datacenter': 'datacenter',
  'Cluster': 'cluster',
  'Host': 'host',
  'Guest OS': 'guestOS',
  'OS': 'guestOS',
  'OS from Tools': 'osFromTools',
};

export function parseVCD(sheet: WorkSheet): VCDInfo[] {
  const rows = parseSheet(sheet, COLUMN_MAP);

  return rows.map((row): VCDInfo => ({
    vmName: getStringValue(row, 'vmName'),
    powerState: getStringValue(row, 'powerState'),
    template: getBooleanValue(row, 'template'),
    deviceNode: getStringValue(row, 'deviceNode'),
    connected: getBooleanValue(row, 'connected'),
    startsConnected: getBooleanValue(row, 'startsConnected'),
    deviceType: getStringValue(row, 'deviceType'),
    annotation: getStringValue(row, 'annotation') || null,
    datacenter: getStringValue(row, 'datacenter'),
    cluster: getStringValue(row, 'cluster'),
    host: getStringValue(row, 'host'),
    guestOS: getStringValue(row, 'guestOS'),
    osFromTools: getStringValue(row, 'osFromTools'),
  })).filter(cd => cd.vmName);
}
