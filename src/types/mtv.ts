// MTV (Migration Toolkit for Virtualization) types

export interface MTVPreFlightCheck {
  id: string;
  name: string;
  description: string;
  category: 'tools' | 'storage' | 'network' | 'hardware' | 'config';
  severity: 'blocker' | 'warning' | 'info';
  checkFunction: string; // Reference to the check function
}

export interface MTVCheckResult {
  checkId: string;
  checkName: string;
  passed: boolean;
  severity: 'blocker' | 'warning' | 'info';
  message: string;
  remediation?: string;
  documentationLink?: string;
}

export interface VMPreFlightResult {
  vmName: string;
  powerState: string;
  guestOS: string;
  status: 'ready' | 'needs-prep' | 'blocker';
  score: number; // 0-100
  checks: MTVCheckResult[];
  blockers: MTVCheckResult[];
  warnings: MTVCheckResult[];
  totalChecks: number;
  passedChecks: number;
}

export interface MTVSummary {
  overallScore: number;
  totalVMs: number;
  readyVMs: number;
  needsPrepVMs: number;
  blockerVMs: number;
  topBlockers: { reason: string; count: number }[];
  topWarnings: { reason: string; count: number }[];
}

// Red Hat OS Compatibility types
export interface OSCompatibilityEntry {
  id: string;
  displayName: string;
  patterns: string[]; // Regex patterns to match OS names
  compatibilityStatus: 'fully-supported' | 'supported-with-caveats' | 'unsupported';
  compatibilityScore: number; // 0-100
  notes: string;
  recommendedUpgrade?: string;
  documentationLink?: string;
  eolDate?: string;
}

export interface OSCompatibilityResult {
  vmName: string;
  rawOS: string;
  normalizedOS: string;
  compatibilityStatus: 'fully-supported' | 'supported-with-caveats' | 'unsupported';
  compatibilityScore: number;
  notes: string;
  recommendedUpgrade?: string;
  documentationLink?: string;
}

// Complexity scoring types
export interface ComplexityWeights {
  operatingSystem: number; // 30%
  networkComplexity: number; // 20%
  storageComplexity: number; // 20%
  hardwareConfig: number; // 15%
  toolsAndVersion: number; // 10%
  appDependencies: number; // 5%
}

export interface ComplexityScore {
  vmName: string;
  totalScore: number; // 0-100
  category: 'simple' | 'moderate' | 'complex' | 'blocker';
  breakdown: {
    factor: string;
    weight: number;
    rawScore: number;
    weightedScore: number;
    details: string;
  }[];
}

// Migration wave planning
export interface MigrationWave {
  waveNumber: number;
  name: string;
  vms: string[];
  vmCount: number;
  totalVCPUs: number;
  totalMemoryGiB: number;
  totalStorageGiB: number;
  estimatedComplexity: 'low' | 'medium' | 'high';
  dependencies: string[];
  prerequisites: string[];
}

// ROKS sizing types
export interface ROKSSizing {
  workerNodes: {
    count: number;
    profile: string;
    vcpus: number;
    memoryGiB: number;
  };
  totalClusterResources: {
    vcpus: number;
    memoryGiB: number;
  };
  odfStorage: {
    capacityTiB: number;
    replicationFactor: number;
    rawCapacityTiB: number;
    storageClass: string;
  };
  networking: {
    clusterSubnetCIDR: string;
    podNetworkCIDR: string;
    serviceNetworkCIDR: string;
  };
  overcommitRatios: {
    cpu: number;
    memory: number;
  };
}

// VPC VSI sizing types
export interface VPCVSISizing {
  instances: {
    profile: string;
    family: string;
    count: number;
    vcpus: number;
    memoryGiB: number;
  }[];
  totalInstances: number;
  storage: {
    bootVolumeTotalGiB: number;
    dataVolumeTotalGiB: number;
    totalVolumes: number;
  };
  networking: {
    subnets: {
      name: string;
      cidr: string;
      tier: string;
      vmCount: number;
    }[];
  };
}

// IBM Cloud profile reference
export interface IBMCloudProfile {
  name: string;
  family: 'balanced' | 'compute' | 'memory' | 'veryHighMemory' | 'ultraHighMemory';
  vcpus: number;
  memoryGiB: number;
  cpuMemoryRatio: string;
  useCase: string;
}

// Export constants
export const MTV_CHECK_IDS = {
  TOOLS_INSTALLED: 'tools-installed',
  TOOLS_RUNNING: 'tools-running',
  NO_SNAPSHOTS: 'no-snapshots',
  OLD_SNAPSHOTS: 'old-snapshots',
  CD_DISCONNECTED: 'cd-disconnected',
  HW_VERSION: 'hw-version',
  NO_RDM: 'no-rdm',
  NO_SHARED_DISKS: 'no-shared-disks',
  NO_PCI_PASSTHROUGH: 'no-pci-passthrough',
  NETWORK_ADAPTER: 'network-adapter',
  NO_USB: 'no-usb',
} as const;

export const COMPLEXITY_CATEGORIES = {
  SIMPLE: { min: 0, max: 25 },
  MODERATE: { min: 26, max: 50 },
  COMPLEX: { min: 51, max: 75 },
  BLOCKER: { min: 76, max: 100 },
} as const;
