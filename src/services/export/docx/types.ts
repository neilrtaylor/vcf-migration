// DOCX Generator Types and Constants

import { Paragraph, Table, AlignmentType, HeadingLevel } from 'docx';
import type { MigrationInsights } from '@/services/ai/types';

// Type alias for document content elements
export type DocumentContent = Paragraph | Table;

export interface DocxExportOptions {
  clientName?: string;
  preparedBy?: string;
  companyName?: string;
  includeROKS?: boolean;
  includeVSI?: boolean;
  includeCosts?: boolean;
  maxIssueVMs?: number;
  aiInsights?: MigrationInsights | null;
}

export interface VMReadiness {
  vmName: string;
  cluster: string;
  guestOS: string;
  cpus: number;
  memoryGiB: number;
  storageGiB: number;
  hasBlocker: boolean;
  hasWarning: boolean;
  issues: string[];
}

export interface ROKSSizing {
  workerNodes: number;
  profileName: string;
  totalCores: number;
  totalThreads: number;
  totalMemoryGiB: number;
  totalNvmeTiB: number;
  odfUsableTiB: number;
  monthlyCost: number;
}

export interface VSIMapping {
  vmName: string;
  sourceVcpus: number;
  sourceMemoryGiB: number;
  sourceStorageGiB: number;
  bootDiskGiB: number;
  dataDiskGiB: number;
  profile: string;
  profileVcpus: number;
  profileMemoryGiB: number;
  family: string;
  computeCost: number;
  bootStorageCost: number;
  dataStorageCost: number;
  storageCost: number;
  monthlyCost: number;
}

export interface NetworkWave {
  portGroup: string;
  vSwitch: string;
  vmCount: number;
  vcpus: number;
  memoryGiB: number;
  storageGiB: number;
  subnet: string;
}

export interface ChartData {
  label: string;
  value: number;
  color?: string;
}

// ===== STYLING CONSTANTS =====

export const FONT_FAMILY = 'IBM Plex Sans';

export const STYLES = {
  titleSize: 56,
  heading1Size: 32,
  heading2Size: 26,
  heading3Size: 22,
  bodySize: 22,
  smallSize: 20,
  primaryColor: '0f62fe', // IBM Blue
  secondaryColor: '393939',
  accentColor: '24a148', // Green
  warningColor: 'ff832b', // Orange
  errorColor: 'da1e28', // Red
  purpleColor: '8a3ffc', // Purple
  tealColor: '009d9a', // Teal
  magentaColor: 'ee5396', // Magenta
  cyanColor: '1192e8', // Cyan
  lightGray: 'f4f4f4',
  mediumGray: 'e0e0e0',
};

// Chart colors for visual consistency
export const CHART_COLORS = [
  '#0f62fe', // IBM Blue
  '#24a148', // Green
  '#8a3ffc', // Purple
  '#ff832b', // Orange
  '#009d9a', // Teal
  '#ee5396', // Magenta
  '#1192e8', // Cyan
  '#da1e28', // Red
];

// VSI Storage Configuration
export const BOOT_DISK_SIZE_GIB = 100;
export const BOOT_STORAGE_COST_PER_GB = 0.08;

export const DATA_STORAGE_TIER_DISTRIBUTION = {
  generalPurpose: 0.50,
  tier5iops: 0.30,
  tier10iops: 0.20,
};

export const DATA_STORAGE_COST_PER_GB =
  (DATA_STORAGE_TIER_DISTRIBUTION.generalPurpose * 0.08) +
  (DATA_STORAGE_TIER_DISTRIBUTION.tier5iops * 0.10) +
  (DATA_STORAGE_TIER_DISTRIBUTION.tier10iops * 0.13);

// Re-export needed docx types for convenience
export { AlignmentType, HeadingLevel };
