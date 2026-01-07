// Main Excel parser for RVTools files
import * as XLSX from 'xlsx';
import type { RVToolsData, RVToolsMetadata, ParseResult } from '@/types';
import {
  parseVInfo,
  parseVDisk,
  parseVDatastore,
  parseVSnapshot,
  parseVNetwork,
  parseVCD,
  parseVTools,
  parseVCluster,
  parseVHost,
} from './tabParsers';
import { REQUIRED_SHEETS, RECOMMENDED_SHEETS } from '@/utils/constants';

export interface ParsingProgress {
  phase: 'reading' | 'parsing' | 'validating' | 'complete' | 'error';
  currentSheet?: string;
  sheetsProcessed: number;
  totalSheets: number;
  message: string;
}

export type ProgressCallback = (progress: ParsingProgress) => void;

/**
 * Parse an RVTools Excel file
 */
export async function parseRVToolsFile(
  file: File,
  onProgress?: ProgressCallback
): Promise<ParseResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Phase 1: Read file
    onProgress?.({
      phase: 'reading',
      sheetsProcessed: 0,
      totalSheets: 0,
      message: 'Reading file...',
    });

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

    const sheetNames = workbook.SheetNames;
    const totalSheets = sheetNames.length;

    // Validate required sheets
    const missingRequired = REQUIRED_SHEETS.filter(
      (sheet) => !sheetNames.includes(sheet)
    );

    if (missingRequired.length > 0) {
      errors.push(`Missing required sheets: ${missingRequired.join(', ')}`);
      return { success: false, data: null, errors, warnings };
    }

    // Check for recommended sheets
    const missingRecommended = RECOMMENDED_SHEETS.filter(
      (sheet) => !sheetNames.includes(sheet)
    );

    if (missingRecommended.length > 0) {
      warnings.push(
        `Missing recommended sheets (some analysis may be limited): ${missingRecommended.join(', ')}`
      );
    }

    // Phase 2: Parse sheets
    onProgress?.({
      phase: 'parsing',
      sheetsProcessed: 0,
      totalSheets,
      message: 'Parsing sheets...',
    });

    let sheetsProcessed = 0;

    const reportProgress = (sheetName: string) => {
      sheetsProcessed++;
      onProgress?.({
        phase: 'parsing',
        currentSheet: sheetName,
        sheetsProcessed,
        totalSheets,
        message: `Parsing ${sheetName}...`,
      });
    };

    // Extract metadata
    const metadata = extractMetadata(workbook, file.name);

    // Parse each sheet
    reportProgress('vInfo');
    const vInfo = sheetNames.includes('vInfo')
      ? parseVInfo(workbook.Sheets['vInfo'])
      : [];

    reportProgress('vDisk');
    const vDisk = sheetNames.includes('vDisk')
      ? parseVDisk(workbook.Sheets['vDisk'])
      : [];

    reportProgress('vDatastore');
    const vDatastore = sheetNames.includes('vDatastore')
      ? parseVDatastore(workbook.Sheets['vDatastore'])
      : [];

    reportProgress('vSnapshot');
    const vSnapshot = sheetNames.includes('vSnapshot')
      ? parseVSnapshot(workbook.Sheets['vSnapshot'])
      : [];

    reportProgress('vNetwork');
    const vNetwork = sheetNames.includes('vNetwork')
      ? parseVNetwork(workbook.Sheets['vNetwork'])
      : [];

    reportProgress('vCD');
    const vCD = sheetNames.includes('vCD')
      ? parseVCD(workbook.Sheets['vCD'])
      : [];

    reportProgress('vTools');
    const vTools = sheetNames.includes('vTools')
      ? parseVTools(workbook.Sheets['vTools'])
      : [];

    reportProgress('vCluster');
    const vCluster = sheetNames.includes('vCluster')
      ? parseVCluster(workbook.Sheets['vCluster'])
      : [];

    reportProgress('vHost');
    const vHost = sheetNames.includes('vHost')
      ? parseVHost(workbook.Sheets['vHost'])
      : [];

    // Phase 3: Validate data
    onProgress?.({
      phase: 'validating',
      sheetsProcessed: totalSheets,
      totalSheets,
      message: 'Validating data...',
    });

    // Basic validation
    if (vInfo.length === 0) {
      errors.push('No VMs found in vInfo sheet');
      return { success: false, data: null, errors, warnings };
    }

    // Assemble result
    const data: RVToolsData = {
      metadata,
      vInfo,
      vCPU: [], // TODO: Add parser if needed
      vMemory: [], // TODO: Add parser if needed
      vDisk,
      vPartition: [], // TODO: Add parser if needed
      vNetwork,
      vCD,
      vSnapshot,
      vTools,
      vCluster,
      vHost,
      vDatastore,
      vResourcePool: [], // TODO: Add parser if needed
      vLicense: [], // TODO: Add parser if needed
      vHealth: [], // TODO: Add parser if needed
    };

    // Phase 4: Complete
    onProgress?.({
      phase: 'complete',
      sheetsProcessed: totalSheets,
      totalSheets,
      message: `Successfully parsed ${vInfo.length} VMs`,
    });

    return { success: true, data, errors, warnings };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    errors.push(`Failed to parse file: ${errorMessage}`);

    onProgress?.({
      phase: 'error',
      sheetsProcessed: 0,
      totalSheets: 0,
      message: errorMessage,
    });

    return { success: false, data: null, errors, warnings };
  }
}

/**
 * Extract metadata from workbook
 */
function extractMetadata(workbook: XLSX.WorkBook, fileName: string): RVToolsMetadata {
  // Try to extract date from filename (format: RVTools_export_*_YYYY-MM-DD_HH.MM.SS.xlsx)
  let collectionDate: Date | null = null;
  const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})_(\d{2}\.\d{2}\.\d{2})/);
  if (dateMatch) {
    const [, datePart, timePart] = dateMatch;
    const timeFormatted = timePart.replace(/\./g, ':');
    collectionDate = new Date(`${datePart}T${timeFormatted}`);
    if (isNaN(collectionDate.getTime())) {
      collectionDate = null;
    }
  }

  // Try to get vCenter version from vHealth or metadata sheet
  let vCenterVersion: string | null = null;
  let environment: string | null = null;

  if (workbook.SheetNames.includes('vHealth')) {
    const healthSheet = workbook.Sheets['vHealth'];
    const healthData = XLSX.utils.sheet_to_json<Record<string, unknown>>(healthSheet);

    // Look for vCenter info in health data
    for (const row of healthData) {
      const entity = String(row['Entity'] || row['Name'] || '');
      if (entity.toLowerCase().includes('vcenter')) {
        vCenterVersion = entity;
        break;
      }
    }
  }

  // Extract environment name from filename or first datacenter
  const envMatch = fileName.match(/RVTools_export_([^_]+)_/);
  if (envMatch) {
    environment = envMatch[1];
  }

  return {
    fileName,
    collectionDate,
    vCenterVersion,
    environment,
  };
}

/**
 * Validate file before parsing
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  const MAX_SIZE = 50 * 1024 * 1024; // 50MB
  const VALID_EXTENSIONS = ['.xlsx', '.xls'];

  if (file.size > MAX_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size is 50MB, got ${(file.size / 1024 / 1024).toFixed(1)}MB`,
    };
  }

  const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  if (!VALID_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `Invalid file type. Expected .xlsx or .xls, got ${extension}`,
    };
  }

  return { valid: true };
}
