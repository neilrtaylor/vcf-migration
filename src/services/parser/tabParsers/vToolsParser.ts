// Parser for vTools tab - VMware Tools information
import type { VToolsInfo } from '@/types';
import type { WorkSheet } from 'xlsx';
import { parseSheet, getStringValue, getBooleanValue } from './utils';

const COLUMN_MAP: Record<string, keyof VToolsInfo | null> = {
  'VM': 'vmName',
  'VM Name': 'vmName',
  'Name': 'vmName',
  'Powerstate': 'powerState',
  'Power State': 'powerState',
  'Template': 'template',
  'VM Version': 'vmVersion',
  'HW Version': 'vmVersion',
  'Hardware Version': 'vmVersion',
  // Tools status - various RVTools versions use different column names
  'Tools': 'toolsStatus',
  'Tools Status': 'toolsStatus',
  'ToolsStatus': 'toolsStatus',
  'Status': 'toolsStatus',
  'VMware Tools Status': 'toolsStatus',
  'VMwareToolsStatus': 'toolsStatus',
  'Guest Tools Status': 'toolsStatus',
  'Tools Running Status': 'toolsStatus',
  'Running Status': 'toolsStatus',
  'Tools State': 'toolsStatus',
  'ToolsRunningStatus': 'toolsStatus',
  // Tools version
  'Tools Version': 'toolsVersion',
  'ToolsVersion': 'toolsVersion',
  'Version': 'toolsVersion',
  'VMware Tools Version': 'toolsVersion',
  'Required Version': 'requiredVersion',
  'Upgradeable': 'upgradeable',
  'Upgrade Policy': 'upgradePolicy',
  'Policy': 'upgradePolicy',
  'Sync Time': 'syncTime',
  'App Status': 'appStatus',
  'Application Status': 'appStatus',
  'Heartbeat Status': 'heartbeatStatus',
  'Heartbeat': 'heartbeatStatus',
  'Kernel Crash State': 'kernelCrashState',
  'Operation Ready': 'operationReady',
};

export function parseVTools(sheet: WorkSheet): VToolsInfo[] {
  const rows = parseSheet(sheet, COLUMN_MAP);

  return rows.map((row): VToolsInfo => ({
    vmName: getStringValue(row, 'vmName'),
    powerState: getStringValue(row, 'powerState'),
    template: getBooleanValue(row, 'template'),
    vmVersion: getStringValue(row, 'vmVersion'),
    toolsStatus: getStringValue(row, 'toolsStatus'),
    toolsVersion: getStringValue(row, 'toolsVersion') || null,
    requiredVersion: getStringValue(row, 'requiredVersion') || null,
    upgradeable: getBooleanValue(row, 'upgradeable'),
    upgradePolicy: getStringValue(row, 'upgradePolicy'),
    syncTime: getBooleanValue(row, 'syncTime'),
    appStatus: getStringValue(row, 'appStatus') || null,
    heartbeatStatus: getStringValue(row, 'heartbeatStatus') || null,
    kernelCrashState: getStringValue(row, 'kernelCrashState') || null,
    operationReady: getBooleanValue(row, 'operationReady'),
  })).filter(tools => tools.vmName);
}
