// Web Worker for parsing RVTools files in the background
import * as XLSX from 'xlsx';
import type { RVToolsData, RVToolsMetadata, ParseResult, VirtualMachine } from '@/types';
import { REQUIRED_SHEETS } from '@/utils/constants';

// Message types
interface ParseMessage {
  type: 'parse';
  file: ArrayBuffer;
  fileName: string;
}

interface ProgressMessage {
  type: 'progress';
  phase: 'reading' | 'parsing' | 'validating' | 'complete' | 'error';
  currentSheet?: string;
  sheetsProcessed: number;
  totalSheets: number;
  message: string;
}

interface ResultMessage {
  type: 'result';
  result: ParseResult;
}

type WorkerMessage = ParseMessage;
type WorkerResponse = ProgressMessage | ResultMessage;

// Handle messages from main thread
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, file, fileName } = event.data;

  if (type === 'parse') {
    await parseFile(file, fileName);
  }
};

// Post progress update
function postProgress(progress: Omit<ProgressMessage, 'type'>): void {
  self.postMessage({ type: 'progress', ...progress } as WorkerResponse);
}

// Post result
function postResult(result: ParseResult): void {
  self.postMessage({ type: 'result', result } as WorkerResponse);
}

// Main parsing function
async function parseFile(arrayBuffer: ArrayBuffer, fileName: string): Promise<void> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    postProgress({
      phase: 'reading',
      sheetsProcessed: 0,
      totalSheets: 0,
      message: 'Reading file...',
    });

    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const sheetNames = workbook.SheetNames;
    const totalSheets = sheetNames.length;

    // Validate required sheets
    const missingRequired = REQUIRED_SHEETS.filter(
      (sheet) => !sheetNames.includes(sheet)
    );

    if (missingRequired.length > 0) {
      errors.push(`Missing required sheets: ${missingRequired.join(', ')}`);
      postResult({ success: false, data: null, errors, warnings });
      return;
    }

    postProgress({
      phase: 'parsing',
      sheetsProcessed: 0,
      totalSheets,
      message: 'Parsing sheets...',
    });

    let sheetsProcessed = 0;

    const reportProgress = (sheetName: string) => {
      sheetsProcessed++;
      postProgress({
        phase: 'parsing',
        currentSheet: sheetName,
        sheetsProcessed,
        totalSheets,
        message: `Parsing ${sheetName}...`,
      });
    };

    // Extract metadata
    const metadata = extractMetadata(fileName);

    // Parse vInfo
    reportProgress('vInfo');
    const vInfo = parseVInfoSheet(workbook.Sheets['vInfo']);

    // Parse other sheets (simplified for worker - main thread uses full parsers)
    reportProgress('vDisk');
    reportProgress('vDatastore');
    reportProgress('vSnapshot');
    reportProgress('vNetwork');
    reportProgress('vCD');
    reportProgress('vTools');
    reportProgress('vCluster');
    reportProgress('vHost');

    postProgress({
      phase: 'validating',
      sheetsProcessed: totalSheets,
      totalSheets,
      message: 'Validating data...',
    });

    if (vInfo.length === 0) {
      errors.push('No VMs found in vInfo sheet');
      postResult({ success: false, data: null, errors, warnings });
      return;
    }

    // Assemble result - worker only parses vInfo fully
    // Other sheets are parsed by main thread using full parsers
    const data: RVToolsData = {
      metadata,
      vInfo,
      vCPU: [],
      vMemory: [],
      vDisk: [],
      vPartition: [],
      vNetwork: [],
      vCD: [],
      vSnapshot: [],
      vTools: [],
      vCluster: [],
      vHost: [],
      vDatastore: [],
      vResourcePool: [],
      vLicense: [],
      vHealth: [],
    };

    postProgress({
      phase: 'complete',
      sheetsProcessed: totalSheets,
      totalSheets,
      message: `Successfully parsed ${vInfo.length} VMs`,
    });

    postResult({ success: true, data, errors, warnings });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    errors.push(`Failed to parse file: ${errorMessage}`);

    postProgress({
      phase: 'error',
      sheetsProcessed: 0,
      totalSheets: 0,
      message: errorMessage,
    });

    postResult({ success: false, data: null, errors, warnings });
  }
}

function extractMetadata(fileName: string): RVToolsMetadata {
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

  const envMatch = fileName.match(/RVTools_export_([^_]+)_/);
  const environment = envMatch ? envMatch[1] : null;

  return {
    fileName,
    collectionDate,
    vCenterVersion: null,
    environment,
  };
}

// Simplified vInfo parser for worker
function parseVInfoSheet(sheet: XLSX.WorkSheet): VirtualMachine[] {
  const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  return rawData.map((row): VirtualMachine => {
    const powerStateRaw = String(row['Powerstate'] || row['Power State'] || '').toLowerCase();
    let powerState: 'poweredOn' | 'poweredOff' | 'suspended' = 'poweredOff';
    if (powerStateRaw.includes('on')) powerState = 'poweredOn';
    else if (powerStateRaw.includes('suspend')) powerState = 'suspended';

    return {
      vmName: String(row['VM'] || row['VM Name'] || row['Name'] || ''),
      powerState,
      template: Boolean(row['Template']),
      srmPlaceholder: false,
      configStatus: String(row['Config status'] || row['Config Status'] || ''),
      dnsName: row['DNS Name'] ? String(row['DNS Name']) : null,
      connectionState: String(row['Connection state'] || row['Connection State'] || ''),
      guestState: String(row['Guest state'] || row['Guest State'] || ''),
      heartbeat: String(row['Heartbeat'] || ''),
      consolidationNeeded: false,
      powerOnDate: null,
      suspendedToMemory: false,
      suspendTime: null,
      creationDate: null,
      cpus: Number(row['CPUs'] || row['Num CPU'] || 0),
      memory: Number(row['Memory'] || row['Memory MB'] || 0),
      nics: Number(row['NICs'] || 0),
      disks: Number(row['Disks'] || 0),
      resourcePool: row['Resource pool'] || row['Resource Pool'] ? String(row['Resource pool'] || row['Resource Pool']) : null,
      folder: row['Folder'] ? String(row['Folder']) : null,
      vApp: row['vApp'] ? String(row['vApp']) : null,
      ftState: row['FT State'] ? String(row['FT State']) : null,
      ftRole: null,
      cbrcEnabled: false,
      hardwareVersion: String(row['HW version'] || row['Hardware Version'] || row['HW Version'] || ''),
      guestOS: String(row['OS according to the configuration file'] || row['Guest OS'] || row['OS'] || ''),
      osToolsConfig: String(row['OS according to the VMware Tools'] || ''),
      guestHostname: row['Guest Hostname'] || row['Hostname'] ? String(row['Guest Hostname'] || row['Hostname']) : null,
      guestIP: row['Guest IP'] || row['IP Address'] || row['Primary IP Address'] ? String(row['Guest IP'] || row['IP Address'] || row['Primary IP Address']) : null,
      annotation: row['Annotation'] || row['Notes'] ? String(row['Annotation'] || row['Notes']) : null,
      datacenter: String(row['Datacenter'] || ''),
      cluster: String(row['Cluster'] || ''),
      host: String(row['Host'] || ''),
      provisionedMiB: Number(row['Provisioned MB'] || row['Provisioned MiB'] || 0),
      inUseMiB: Number(row['In Use MB'] || row['In Use MiB'] || 0),
      uuid: row['VM UUID'] || row['UUID'] ? String(row['VM UUID'] || row['UUID']) : null,
      firmwareType: row['Firmware'] || row['Firmware Type'] ? String(row['Firmware'] || row['Firmware Type']) : null,
      latencySensitivity: null,
    };
  });
}

export type { WorkerMessage, WorkerResponse, ProgressMessage, ResultMessage };
