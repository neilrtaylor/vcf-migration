// RVTools data types based on actual Excel export structure

export interface RVToolsMetadata {
  fileName: string;
  collectionDate: Date | null;
  vCenterVersion: string | null;
  environment: string | null;
}

export interface VirtualMachine {
  vmName: string;
  powerState: 'poweredOn' | 'poweredOff' | 'suspended';
  template: boolean;
  srmPlaceholder: boolean;
  configStatus: string;
  dnsName: string | null;
  connectionState: string;
  guestState: string;
  heartbeat: string;
  consolidationNeeded: boolean;
  powerOnDate: Date | null;
  suspendedToMemory: boolean;
  suspendTime: Date | null;
  creationDate: Date | null;
  cpus: number;
  memory: number; // MiB
  nics: number;
  disks: number;
  resourcePool: string | null;
  folder: string | null;
  vApp: string | null;
  ftState: string | null;
  ftRole: string | null;
  cbrcEnabled: boolean;
  hardwareVersion: string;
  guestOS: string;
  osToolsConfig: string;
  guestHostname: string | null;
  guestIP: string | null;
  annotation: string | null;
  datacenter: string;
  cluster: string;
  host: string;
  provisionedMiB: number;
  inUseMiB: number;
  uuid: string | null;
  firmwareType: string | null;
  latencySensitivity: string | null;
}

export interface VCPUInfo {
  vmName: string;
  powerState: string;
  template: boolean;
  cpus: number;
  sockets: number;
  coresPerSocket: number;
  maxCpu: number;
  overallLevel: string | null;
  shares: number;
  reservation: number;
  entitlement: number | null;
  drsEntitlement: number | null;
  limit: number;
  hotAddEnabled: boolean;
  affinityRule: string | null;
}

export interface VMemoryInfo {
  vmName: string;
  powerState: string;
  template: boolean;
  memoryMiB: number;
  overallLevel: string | null;
  shares: number;
  reservation: number;
  entitlement: number | null;
  drsEntitlement: number | null;
  limit: number;
  hotAddEnabled: boolean;
  active: number | null;
  consumed: number | null;
  ballooned: number | null;
  swapped: number | null;
  compressed: number | null;
}

export interface VDiskInfo {
  vmName: string;
  powerState: string;
  template: boolean;
  diskLabel: string;
  diskKey: number;
  diskUuid: string | null;
  diskPath: string;
  capacityMiB: number;
  raw: boolean;
  diskMode: string;
  sharingMode: string;
  thin: boolean;
  eagerlyScrub: boolean;
  split: boolean;
  writeThrough: boolean;
  controllerType: string;
  controllerKey: number;
  unitNumber: number;
  datacenter: string;
  cluster: string;
  host: string;
}

export interface VPartitionInfo {
  vmName: string;
  powerState: string;
  partition: string;
  capacityMiB: number;
  consumedMiB: number;
  freeMiB: number;
  freePercent: number;
}

export interface VNetworkInfo {
  vmName: string;
  powerState: string;
  template: boolean;
  nicLabel: string;
  adapterType: string;
  networkName: string;
  switchName: string;
  connected: boolean;
  startsConnected: boolean;
  macAddress: string;
  macType: string;
  ipv4Address: string | null;
  ipv6Address: string | null;
  directPathIO: boolean;
  datacenter: string;
  cluster: string;
  host: string;
}

export interface VCDInfo {
  vmName: string;
  powerState: string;
  template: boolean;
  deviceNode: string;
  connected: boolean;
  startsConnected: boolean;
  deviceType: string;
  annotation: string | null;
  datacenter: string;
  cluster: string;
  host: string;
  guestOS: string;
  osFromTools: string;
}

export interface VSnapshotInfo {
  vmName: string;
  powerState: string;
  snapshotName: string;
  description: string | null;
  dateTime: Date;
  filename: string;
  sizeVmsnMiB: number;
  sizeTotalMiB: number;
  quiesced: boolean;
  state: string;
  annotation: string | null;
  datacenter: string;
  cluster: string;
  host: string;
  folder: string;
  // Calculated field
  ageInDays: number;
}

export interface VToolsInfo {
  vmName: string;
  powerState: string;
  template: boolean;
  vmVersion: string;
  toolsStatus: string; // 'toolsOk' | 'toolsOld' | 'toolsNotInstalled' | 'toolsNotRunning'
  toolsVersion: string | null;
  requiredVersion: string | null;
  upgradeable: boolean;
  upgradePolicy: string;
  syncTime: boolean;
  appStatus: string | null;
  heartbeatStatus: string | null;
  kernelCrashState: string | null;
  operationReady: boolean;
}

export interface VClusterInfo {
  name: string;
  configStatus: string;
  overallStatus: string;
  vmCount: number;
  hostCount: number;
  totalCpuMHz: number;
  effectiveCpuMHz: number;
  totalMemoryMiB: number;
  effectiveMemoryMiB: number;
  haEnabled: boolean;
  haFailoverLevel: number;
  drsEnabled: boolean;
  drsBehavior: string;
  evcMode: string | null;
  datacenter: string;
}

export interface VHostInfo {
  name: string;
  configStatus: string;
  overallStatus: string;
  powerState: string;
  connectionState: string;
  cpuModel: string;
  cpuMHz: number;
  cpuSockets: number;
  coresPerSocket: number;
  totalCpuCores: number;
  hyperthreading: boolean;
  cpuUsageMHz: number;
  memoryMiB: number;
  memoryUsageMiB: number;
  vmCount: number;
  vmCpuCount: number;
  vmMemoryMiB: number;
  vendor: string;
  model: string;
  esxiVersion: string;
  esxiBuild: string;
  datacenter: string;
  cluster: string;
  uptimeSeconds: number;
}

export interface VDatastoreInfo {
  name: string;
  configStatus: string;
  address: string | null;
  accessible: boolean;
  type: string; // 'VMFS' | 'NFS' | 'vsan' | 'VVOL'
  vmTotalCount: number;
  vmCount: number;
  capacityMiB: number;
  provisionedMiB: number;
  inUseMiB: number;
  freeMiB: number;
  freePercent: number;
  siocEnabled: boolean;
  siocThreshold: number | null;
  hostCount: number;
  datacenter: string;
  cluster: string | null;
}

export interface VResourcePoolInfo {
  name: string;
  configStatus: string;
  cpuReservation: number;
  cpuLimit: number;
  cpuExpandable: boolean;
  cpuShares: number;
  memoryReservation: number;
  memoryLimit: number;
  memoryExpandable: boolean;
  memoryShares: number;
  vmCount: number;
  datacenter: string;
  cluster: string;
  parent: string | null;
}

export interface VLicenseInfo {
  name: string;
  licenseKey: string;
  total: number;
  used: number;
  expirationDate: Date | null;
  productName: string;
  productVersion: string;
}

export interface VHealthInfo {
  entity: string;
  entityType: string;
  status: string;
  message: string;
  timestamp: Date;
}

// Main data container
export interface RVToolsData {
  metadata: RVToolsMetadata;
  vInfo: VirtualMachine[];
  vCPU: VCPUInfo[];
  vMemory: VMemoryInfo[];
  vDisk: VDiskInfo[];
  vPartition: VPartitionInfo[];
  vNetwork: VNetworkInfo[];
  vCD: VCDInfo[];
  vSnapshot: VSnapshotInfo[];
  vTools: VToolsInfo[];
  vCluster: VClusterInfo[];
  vHost: VHostInfo[];
  vDatastore: VDatastoreInfo[];
  vResourcePool: VResourcePoolInfo[];
  vLicense: VLicenseInfo[];
  vHealth: VHealthInfo[];
}

// Power state helper type
export type PowerState = 'poweredOn' | 'poweredOff' | 'suspended';

// Parsing result type
export interface ParseResult {
  success: boolean;
  data: RVToolsData | null;
  errors: string[];
  warnings: string[];
}
