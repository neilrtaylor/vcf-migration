// Parser for vInfo tab - main VM information
import type { VirtualMachine } from '@/types';
import type { WorkSheet } from 'xlsx';
import { parseSheet, getStringValue, getNumberValue, getBooleanValue, getDateValue } from './utils';

// Column mappings for vInfo tab (handles variations in RVTools versions)
const COLUMN_MAP: Record<string, keyof VirtualMachine | null> = {
  'VM': 'vmName',
  'VM Name': 'vmName',
  'Name': 'vmName',
  'Powerstate': 'powerState',
  'Power State': 'powerState',
  'Template': 'template',
  'SRM Placeholder': 'srmPlaceholder',
  'Config status': 'configStatus',
  'Config Status': 'configStatus',
  'DNS Name': 'dnsName',
  'Connection state': 'connectionState',
  'Connection State': 'connectionState',
  'Guest state': 'guestState',
  'Guest State': 'guestState',
  'Heartbeat': 'heartbeat',
  'Consolidation Needed': 'consolidationNeeded',
  'PowerOn': 'powerOnDate',
  'Power On': 'powerOnDate',
  'Suspended To Memory': 'suspendedToMemory',
  'Suspend Time': 'suspendTime',
  'Creation date': 'creationDate',
  'Creation Date': 'creationDate',
  'CPUs': 'cpus',
  'Num CPU': 'cpus',
  'Memory': 'memory',
  'Memory MB': 'memory',
  'NICs': 'nics',
  'Disks': 'disks',
  'Resource pool': 'resourcePool',
  'Resource Pool': 'resourcePool',
  'Folder': 'folder',
  'vApp': 'vApp',
  'FT State': 'ftState',
  'FT Role': 'ftRole',
  'CBRC Enabled': 'cbrcEnabled',
  'CBT': 'cbtEnabled',
  'CBT Enabled': 'cbtEnabled',
  'Changed Block Tracking': 'cbtEnabled',
  'Change Block Tracking': 'cbtEnabled',
  'HW version': 'hardwareVersion',
  'Hardware Version': 'hardwareVersion',
  'HW Version': 'hardwareVersion',
  'OS according to the configuration file': 'guestOS',
  'OS according to the VMware Tools': 'osToolsConfig',
  'Guest OS': 'guestOS',
  'OS': 'guestOS',
  'Guest Hostname': 'guestHostname',
  'Hostname': 'guestHostname',
  'Guest IP': 'guestIP',
  'IP Address': 'guestIP',
  'Primary IP Address': 'guestIP',
  'Annotation': 'annotation',
  'Notes': 'annotation',
  'Cluster': 'cluster',
  'Host': 'host',
  'Datacenter': 'datacenter',
  'Provisioned MB': 'provisionedMiB',
  'Provisioned MiB': 'provisionedMiB',
  'In Use MB': 'inUseMiB',
  'In Use MiB': 'inUseMiB',
  'VM UUID': 'uuid',
  'UUID': 'uuid',
  'Firmware': 'firmwareType',
  'Firmware Type': 'firmwareType',
  'Latency Sensitivity': 'latencySensitivity',
};

export function parseVInfo(sheet: WorkSheet): VirtualMachine[] {
  const rows = parseSheet(sheet, COLUMN_MAP);

  return rows.map((row): VirtualMachine => {
    const powerStateRaw = getStringValue(row, 'powerState').toLowerCase();
    let powerState: 'poweredOn' | 'poweredOff' | 'suspended' = 'poweredOff';
    if (powerStateRaw.includes('on') || powerStateRaw === 'poweredon') {
      powerState = 'poweredOn';
    } else if (powerStateRaw.includes('suspend')) {
      powerState = 'suspended';
    }

    return {
      vmName: getStringValue(row, 'vmName'),
      powerState,
      template: getBooleanValue(row, 'template'),
      srmPlaceholder: getBooleanValue(row, 'srmPlaceholder'),
      configStatus: getStringValue(row, 'configStatus'),
      dnsName: getStringValue(row, 'dnsName') || null,
      connectionState: getStringValue(row, 'connectionState'),
      guestState: getStringValue(row, 'guestState'),
      heartbeat: getStringValue(row, 'heartbeat'),
      consolidationNeeded: getBooleanValue(row, 'consolidationNeeded'),
      powerOnDate: getDateValue(row, 'powerOnDate'),
      suspendedToMemory: getBooleanValue(row, 'suspendedToMemory'),
      suspendTime: getDateValue(row, 'suspendTime'),
      creationDate: getDateValue(row, 'creationDate'),
      cpus: getNumberValue(row, 'cpus'),
      memory: getNumberValue(row, 'memory'),
      nics: getNumberValue(row, 'nics'),
      disks: getNumberValue(row, 'disks'),
      resourcePool: getStringValue(row, 'resourcePool') || null,
      folder: getStringValue(row, 'folder') || null,
      vApp: getStringValue(row, 'vApp') || null,
      ftState: getStringValue(row, 'ftState') || null,
      ftRole: getStringValue(row, 'ftRole') || null,
      cbrcEnabled: getBooleanValue(row, 'cbrcEnabled'),
      hardwareVersion: getStringValue(row, 'hardwareVersion'),
      guestOS: getStringValue(row, 'guestOS'),
      osToolsConfig: getStringValue(row, 'osToolsConfig'),
      guestHostname: getStringValue(row, 'guestHostname') || null,
      guestIP: getStringValue(row, 'guestIP') || null,
      annotation: getStringValue(row, 'annotation') || null,
      datacenter: getStringValue(row, 'datacenter'),
      cluster: getStringValue(row, 'cluster'),
      host: getStringValue(row, 'host'),
      provisionedMiB: getNumberValue(row, 'provisionedMiB'),
      inUseMiB: getNumberValue(row, 'inUseMiB'),
      uuid: getStringValue(row, 'uuid') || null,
      firmwareType: getStringValue(row, 'firmwareType') || null,
      latencySensitivity: getStringValue(row, 'latencySensitivity') || null,
      cbtEnabled: getBooleanValue(row, 'cbtEnabled'),
    };
  }).filter(vm => vm.vmName); // Filter out empty rows
}
