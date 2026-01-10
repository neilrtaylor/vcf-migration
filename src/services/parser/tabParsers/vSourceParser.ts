// Parser for vSource tab - Source environment information (vCenter servers)
import type { VSourceInfo } from '@/types';
import type { WorkSheet } from 'xlsx';
import { parseSheet, getStringValue, getDateValue } from './utils';

const COLUMN_MAP: Record<string, keyof VSourceInfo | null> = {
  'Server': 'server',
  'Name': 'server',
  'vCenter': 'server',
  'vCenter Server': 'server',
  'IP Address': 'ipAddress',
  'IP': 'ipAddress',
  'Address': 'ipAddress',
  'Version': 'version',
  'vCenter Version': 'version',
  'Build': 'build',
  'Build Number': 'build',
  'OS Type': 'osType',
  'OSType': 'osType',
  'Operating System': 'osType',
  'API Version': 'apiVersion',
  'ApiVersion': 'apiVersion',
  'Instance UUID': 'instanceUuid',
  'InstanceUuid': 'instanceUuid',
  'Instance Uuid': 'instanceUuid',
  'Server Time': 'serverTime',
  'ServerTime': 'serverTime',
  'Full Name': 'fullName',
  'FullName': 'fullName',
  'Product': 'fullName',
  'Product Name': 'fullName',
};

export function parseVSource(sheet: WorkSheet): VSourceInfo[] {
  const rows = parseSheet(sheet, COLUMN_MAP);

  return rows.map((row): VSourceInfo => ({
    server: getStringValue(row, 'server'),
    ipAddress: getStringValue(row, 'ipAddress') || null,
    version: getStringValue(row, 'version') || null,
    build: getStringValue(row, 'build') || null,
    osType: getStringValue(row, 'osType') || null,
    apiVersion: getStringValue(row, 'apiVersion') || null,
    instanceUuid: getStringValue(row, 'instanceUuid') || null,
    serverTime: getDateValue(row, 'serverTime'),
    fullName: getStringValue(row, 'fullName') || null,
  })).filter(source => source.server);
}
