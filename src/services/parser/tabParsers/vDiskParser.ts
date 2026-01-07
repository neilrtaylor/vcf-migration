// Parser for vDisk tab - disk information
import type { VDiskInfo } from '@/types';
import type { WorkSheet } from 'xlsx';
import { parseSheet, getStringValue, getNumberValue, getBooleanValue } from './utils';

const COLUMN_MAP: Record<string, keyof VDiskInfo | null> = {
  'VM': 'vmName',
  'VM Name': 'vmName',
  'Powerstate': 'powerState',
  'Power State': 'powerState',
  'Template': 'template',
  'Disk': 'diskLabel',
  'Disk Label': 'diskLabel',
  'Label': 'diskLabel',
  'Key': 'diskKey',
  'Disk Key': 'diskKey',
  'UUID': 'diskUuid',
  'Disk UUID': 'diskUuid',
  'Path': 'diskPath',
  'Disk Path': 'diskPath',
  'Capacity MB': 'capacityMiB',
  'Capacity MiB': 'capacityMiB',
  'Capacity': 'capacityMiB',
  'Raw': 'raw',
  'RDM': 'raw',
  'Disk Mode': 'diskMode',
  'Mode': 'diskMode',
  'Sharing': 'sharingMode',
  'Sharing Mode': 'sharingMode',
  'Thin': 'thin',
  'Thin provisioned': 'thin',
  'Thin Provisioned': 'thin',
  'Eagerly Scrub': 'eagerlyScrub',
  'Split': 'split',
  'Write Through': 'writeThrough',
  'Controller': 'controllerType',
  'Controller Type': 'controllerType',
  'SCSI Controller': 'controllerType',
  'Controller Key': 'controllerKey',
  'Unit Number': 'unitNumber',
  'Unit': 'unitNumber',
  'Datacenter': 'datacenter',
  'Cluster': 'cluster',
  'Host': 'host',
};

export function parseVDisk(sheet: WorkSheet): VDiskInfo[] {
  const rows = parseSheet(sheet, COLUMN_MAP);

  return rows.map((row): VDiskInfo => ({
    vmName: getStringValue(row, 'vmName'),
    powerState: getStringValue(row, 'powerState'),
    template: getBooleanValue(row, 'template'),
    diskLabel: getStringValue(row, 'diskLabel'),
    diskKey: getNumberValue(row, 'diskKey'),
    diskUuid: getStringValue(row, 'diskUuid') || null,
    diskPath: getStringValue(row, 'diskPath'),
    capacityMiB: getNumberValue(row, 'capacityMiB'),
    raw: getBooleanValue(row, 'raw'),
    diskMode: getStringValue(row, 'diskMode'),
    sharingMode: getStringValue(row, 'sharingMode'),
    thin: getBooleanValue(row, 'thin'),
    eagerlyScrub: getBooleanValue(row, 'eagerlyScrub'),
    split: getBooleanValue(row, 'split'),
    writeThrough: getBooleanValue(row, 'writeThrough'),
    controllerType: getStringValue(row, 'controllerType'),
    controllerKey: getNumberValue(row, 'controllerKey'),
    unitNumber: getNumberValue(row, 'unitNumber'),
    datacenter: getStringValue(row, 'datacenter'),
    cluster: getStringValue(row, 'cluster'),
    host: getStringValue(row, 'host'),
  })).filter(disk => disk.vmName);
}
