// Analysis result types

export interface ExecutiveMetrics {
  // VM counts
  totalVMs: number;
  poweredOnVMs: number;
  poweredOffVMs: number;
  suspendedVMs: number;
  templates: number;

  // Resource totals
  totalVCPUs: number;
  totalMemoryGiB: number;
  totalProvisionedTiB: number;
  totalConsumedTiB: number;

  // Infrastructure
  clusterCount: number;
  hostCount: number;
  datastoreCount: number;

  // Health indicators
  healthIndicators: HealthIndicator[];

  // MTV readiness
  mtvScore: number;
  mtvReadyCount: number;
  mtvPrepCount: number;
  mtvBlockerCount: number;
}

export interface HealthIndicator {
  id: string;
  category: 'warning' | 'critical' | 'info';
  title: string;
  description: string;
  count: number;
  vmNames?: string[];
  action?: string;
}

export interface ComputeMetrics {
  // CPU metrics
  cpuMetrics: {
    totalVCPUs: number;
    avgVCPUsPerVM: number;
    maxVCPUs: number;
    vcpuDistribution: { range: string; count: number }[];
    topConsumers: { vmName: string; vcpus: number }[];
  };

  // Memory metrics
  memoryMetrics: {
    totalMemoryGiB: number;
    avgMemoryPerVMGiB: number;
    maxMemoryGiB: number;
    memoryDistribution: { range: string; count: number }[];
    topConsumers: { vmName: string; memoryGiB: number }[];
  };

  // Reservations
  reservationMetrics: {
    vmsWithCpuReservation: number;
    vmsWithMemoryReservation: number;
    totalCpuReserved: number;
    totalMemoryReservedGiB: number;
  };
}

export interface StorageMetrics {
  // Datastore overview
  datastoreMetrics: {
    totalCapacityTiB: number;
    totalProvisionedTiB: number;
    totalConsumedTiB: number;
    totalFreeTiB: number;
    avgUtilizationPercent: number;
    typeDistribution: { type: string; count: number; capacityTiB: number }[];
    datastoresOver80Percent: { name: string; usedPercent: number; capacityTiB: number }[];
  };

  // Disk analysis
  diskMetrics: {
    totalDisks: number;
    avgDisksPerVM: number;
    thinProvisionedCount: number;
    thickProvisionedCount: number;
    rdmCount: number;
    sharedDiskCount: number;
    topStorageConsumers: { vmName: string; provisionedGiB: number; consumedGiB: number }[];
  };

  // Snapshot analysis
  snapshotMetrics: {
    totalSnapshots: number;
    vmsWithSnapshots: number;
    oldSnapshots30Days: number;
    oldSnapshots90Days: number;
    totalSnapshotSizeGiB: number;
    oldestSnapshot: { vmName: string; ageInDays: number; date: Date } | null;
  };
}

export interface NetworkMetrics {
  totalNICs: number;
  avgNICsPerVM: number;
  adapterTypeDistribution: { type: string; count: number }[];
  portGroupDistribution: { name: string; vmCount: number }[];
  vmsWithMultipleNICs: number;
  vmsWithDisconnectedNICs: number;
  legacyAdapterCount: number;
}

export interface ClusterMetrics {
  clusters: {
    name: string;
    hostCount: number;
    vmCount: number;
    totalCores: number;
    totalVCPUs: number;
    cpuOvercommitRatio: number;
    totalMemoryGiB: number;
    allocatedMemoryGiB: number;
    memoryOvercommitRatio: number;
    haEnabled: boolean;
    drsEnabled: boolean;
    evcMode: string | null;
  }[];

  hosts: {
    name: string;
    cluster: string;
    cpuModel: string;
    cores: number;
    memoryGiB: number;
    vmCount: number;
    esxiVersion: string;
    uptimeDays: number;
  }[];
}

export interface ComplexityResult {
  vmName: string;
  score: number;
  category: 'simple' | 'moderate' | 'complex' | 'blocker';
  factors: ComplexityFactor[];
}

export interface ComplexityFactor {
  factor: string;
  weight: number;
  score: number;
  description: string;
}

// Main analysis results container
export interface AnalysisResults {
  executive: ExecutiveMetrics;
  compute: ComputeMetrics;
  storage: StorageMetrics;
  network: NetworkMetrics;
  clusters: ClusterMetrics;

  // These will be populated in Step 10
  mtv?: MTVAnalysisResults;
  complexity?: ComplexityResult[];
  osCompatibility?: OSCompatibilityResults;
}

// Placeholder types for MTV (will be detailed in mtv.ts)
export interface MTVAnalysisResults {
  overallScore: number;
  readyVMs: string[];
  prepNeededVMs: string[];
  blockerVMs: string[];
  preFlightResults: MTVPreFlightResult[];
}

export interface MTVPreFlightResult {
  vmName: string;
  status: 'ready' | 'needs-prep' | 'blocker';
  checks: MTVCheck[];
  blockerReasons: string[];
  prepItems: string[];
}

export interface MTVCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface OSCompatibilityResults {
  distribution: { os: string; count: number; status: OSStatus }[];
  supportedCount: number;
  cautionCount: number;
  unsupportedCount: number;
}

export type OSStatus = 'fully-supported' | 'supported-with-caveats' | 'unsupported';

// Chart data types
export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface BarChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string | string[];
  }[];
}

export interface PieChartData {
  labels: string[];
  datasets: {
    data: number[];
    backgroundColor: string[];
  }[];
}
