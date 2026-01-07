// Parser for vSnapshot tab - snapshot information
import type { VSnapshotInfo } from '@/types';
import type { WorkSheet } from 'xlsx';
import { parseSheet, getStringValue, getNumberValue, getDateValue, getBooleanValue } from './utils';

const COLUMN_MAP: Record<string, keyof VSnapshotInfo | null> = {
  'VM': 'vmName',
  'VM Name': 'vmName',
  'Powerstate': 'powerState',
  'Power State': 'powerState',
  'Snapshot': 'snapshotName',
  'Name': 'snapshotName',
  'Snapshot Name': 'snapshotName',
  'Description': 'description',
  'Date / time': 'dateTime',
  'Date/Time': 'dateTime',
  'Created': 'dateTime',
  'Creation Date': 'dateTime',
  'Filename': 'filename',
  'File': 'filename',
  'Size vmsn MB': 'sizeVmsnMiB',
  'Size VMSN MiB': 'sizeVmsnMiB',
  'Size MB': 'sizeTotalMiB',
  'Size MiB': 'sizeTotalMiB',
  'Size Total MiB': 'sizeTotalMiB',
  'Size': 'sizeTotalMiB',
  'Quiesced': 'quiesced',
  'State': 'state',
  'Snapshot State': 'state',
  'Annotation': 'annotation',
  'Notes': 'annotation',
  'Datacenter': 'datacenter',
  'Cluster': 'cluster',
  'Host': 'host',
  'Folder': 'folder',
};

export function parseVSnapshot(sheet: WorkSheet): VSnapshotInfo[] {
  const rows = parseSheet(sheet, COLUMN_MAP);
  const now = new Date();

  return rows.map((row): VSnapshotInfo => {
    const dateTime = getDateValue(row, 'dateTime') || new Date();
    const ageInDays = Math.floor((now.getTime() - dateTime.getTime()) / (1000 * 60 * 60 * 24));

    return {
      vmName: getStringValue(row, 'vmName'),
      powerState: getStringValue(row, 'powerState'),
      snapshotName: getStringValue(row, 'snapshotName'),
      description: getStringValue(row, 'description') || null,
      dateTime,
      filename: getStringValue(row, 'filename'),
      sizeVmsnMiB: getNumberValue(row, 'sizeVmsnMiB'),
      sizeTotalMiB: getNumberValue(row, 'sizeTotalMiB'),
      quiesced: getBooleanValue(row, 'quiesced'),
      state: getStringValue(row, 'state'),
      annotation: getStringValue(row, 'annotation') || null,
      datacenter: getStringValue(row, 'datacenter'),
      cluster: getStringValue(row, 'cluster'),
      host: getStringValue(row, 'host'),
      folder: getStringValue(row, 'folder'),
      ageInDays,
    };
  }).filter(snap => snap.vmName);
}
