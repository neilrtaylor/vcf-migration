// Migration assessment services - complexity scoring and readiness calculations

import { mibToGiB, getHardwareVersionNumber } from '@/utils/formatters';
import { HW_VERSION_MINIMUM, HW_VERSION_RECOMMENDED } from '@/utils/constants';
import { getVSIOSCompatibility, getROKSOSCompatibility, type MigrationMode } from './osCompatibility';
import type { VirtualMachine, VDiskInfo, VNetworkInfo } from '@/types/rvtools';

export interface ComplexityScore {
  vmName: string;
  score: number;
  factors: string;
  category: 'Simple' | 'Moderate' | 'Complex' | 'Blocker';
  guestOS: string;
  cpus: number;
  memoryGiB: number;
  diskCount: number;
  nicCount: number;
  hwVersion?: number;
}

export interface AssessmentSummary {
  totalVMs: number;
  simpleCount: number;
  moderateCount: number;
  complexCount: number;
  blockerCount: number;
  averageScore: number;
}

// Legacy type aliases for backwards compatibility
export type VMData = Pick<VirtualMachine, 'vmName' | 'guestOS' | 'cpus' | 'memory' | 'hardwareVersion'>;
export type DiskData = Pick<VDiskInfo, 'vmName' | 'capacityMiB' | 'raw' | 'sharingMode' | 'diskKey' | 'diskMode'>;
export type NetworkData = Pick<VNetworkInfo, 'vmName' | 'networkName' | 'ipv4Address' | 'adapterType'>;

/**
 * Calculate complexity score for a VM (VSI mode)
 */
export function calculateVSIComplexityScore(
  vm: VMData,
  disks: DiskData[],
  nicCount: number
): ComplexityScore {
  let score = 0;
  const factors: string[] = [];

  // OS compatibility check
  const compat = getVSIOSCompatibility(vm.guestOS);
  if (compat.status === 'unsupported') {
    score += 40;
    factors.push('Unsupported OS (+40)');
  } else if (compat.status === 'community') {
    score += 15;
    factors.push('Community OS (+15)');
  }

  // Network complexity
  if (nicCount > 3) {
    score += 25;
    factors.push(`${nicCount} NICs (+25)`);
  } else if (nicCount > 1) {
    score += 10;
    factors.push(`${nicCount} NICs (+10)`);
  }

  // Disk complexity
  const vmDisks = disks.filter(d => d.vmName === vm.vmName);
  const largeDisks = vmDisks.filter(d => mibToGiB(d.capacityMiB) > 2000).length;
  if (largeDisks > 0) {
    score += 30;
    factors.push(`${largeDisks} large disk${largeDisks > 1 ? 's' : ''} >2TB (+30)`);
  }
  if (vmDisks.length > 5) {
    score += 20;
    factors.push(`${vmDisks.length} disks (+20)`);
  } else if (vmDisks.length > 2) {
    score += 10;
    factors.push(`${vmDisks.length} disks (+10)`);
  }

  // Memory complexity
  const memGiB = mibToGiB(vm.memory);
  if (memGiB > 1024) {
    score += 40;
    factors.push(`${Math.round(memGiB)} GiB memory (+40)`);
  } else if (memGiB > 512) {
    score += 20;
    factors.push(`${Math.round(memGiB)} GiB memory (+20)`);
  }

  // CPU complexity
  if (vm.cpus > 64) {
    score += 30;
    factors.push(`${vm.cpus} vCPUs (+30)`);
  } else if (vm.cpus > 32) {
    score += 15;
    factors.push(`${vm.cpus} vCPUs (+15)`);
  }

  const finalScore = Math.min(100, score);
  const category = getComplexityCategory(finalScore);

  return {
    vmName: vm.vmName,
    score: finalScore,
    factors: factors.length > 0 ? factors.join(', ') : 'No complexity factors',
    category,
    guestOS: vm.guestOS,
    cpus: vm.cpus,
    memoryGiB: Math.round(memGiB),
    diskCount: vmDisks.length,
    nicCount,
  };
}

/**
 * Calculate complexity score for a VM (ROKS mode)
 */
export function calculateROKSComplexityScore(
  vm: VMData,
  disks: DiskData[],
  nicCount: number
): ComplexityScore {
  let score = 0;
  const factors: string[] = [];

  // OS compatibility check
  const compat = getROKSOSCompatibility(vm.guestOS);
  const osScore = Math.round((100 - compat.compatibilityScore) * 0.3);
  if (osScore > 0) {
    score += osScore;
    factors.push(`OS compatibility (+${osScore})`);
  }

  // Network complexity
  if (nicCount > 3) {
    score += 30;
    factors.push(`${nicCount} NICs (+30)`);
  } else if (nicCount > 1) {
    score += 15;
    factors.push(`${nicCount} NICs (+15)`);
  }

  // Disk complexity
  const vmDisks = disks.filter(d => d.vmName === vm.vmName);
  if (vmDisks.length > 5) {
    score += 30;
    factors.push(`${vmDisks.length} disks (+30)`);
  } else if (vmDisks.length > 2) {
    score += 15;
    factors.push(`${vmDisks.length} disks (+15)`);
  }

  // Hardware version check
  const hwVersion = getHardwareVersionNumber(vm.hardwareVersion);
  if (hwVersion < HW_VERSION_MINIMUM) {
    score += 25;
    factors.push(`HW v${hwVersion} < min (+25)`);
  } else if (hwVersion < HW_VERSION_RECOMMENDED) {
    score += 10;
    factors.push(`HW v${hwVersion} < recommended (+10)`);
  }

  // Resource size complexity
  const memGiB = mibToGiB(vm.memory);
  if (vm.cpus > 16 || memGiB > 128) {
    score += 20;
    if (vm.cpus > 16 && memGiB > 128) {
      factors.push(`${vm.cpus} vCPUs & ${Math.round(memGiB)} GiB (+20)`);
    } else if (vm.cpus > 16) {
      factors.push(`${vm.cpus} vCPUs (+20)`);
    } else {
      factors.push(`${Math.round(memGiB)} GiB memory (+20)`);
    }
  }

  const finalScore = Math.min(100, Math.round(score));
  const category = getComplexityCategory(finalScore);

  return {
    vmName: vm.vmName,
    score: finalScore,
    factors: factors.length > 0 ? factors.join(', ') : 'No complexity factors',
    category,
    guestOS: vm.guestOS,
    cpus: vm.cpus,
    memoryGiB: Math.round(memGiB),
    diskCount: vmDisks.length,
    nicCount,
    hwVersion,
  };
}

/**
 * Get complexity category from score
 */
export function getComplexityCategory(score: number): 'Simple' | 'Moderate' | 'Complex' | 'Blocker' {
  if (score <= 25) return 'Simple';
  if (score <= 50) return 'Moderate';
  if (score <= 75) return 'Complex';
  return 'Blocker';
}

/**
 * Calculate complexity scores for all VMs
 */
export function calculateComplexityScores(
  vms: VMData[],
  disks: DiskData[],
  networks: NetworkData[],
  mode: MigrationMode
): ComplexityScore[] {
  // Build network count map (case-insensitive)
  const nicCountMap = new Map<string, number>();
  networks.forEach(n => {
    const key = n.vmName.toLowerCase();
    nicCountMap.set(key, (nicCountMap.get(key) || 0) + 1);
  });

  return vms.map(vm => {
    const nicCount = nicCountMap.get(vm.vmName.toLowerCase()) || 0;
    return mode === 'vsi'
      ? calculateVSIComplexityScore(vm, disks, nicCount)
      : calculateROKSComplexityScore(vm, disks, nicCount);
  });
}

/**
 * Get complexity distribution counts
 */
export function getComplexityDistribution(scores: ComplexityScore[]): Record<string, number> {
  return scores.reduce((acc, cs) => {
    acc[cs.category] = (acc[cs.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Get assessment summary
 */
export function getAssessmentSummary(scores: ComplexityScore[]): AssessmentSummary {
  const distribution = getComplexityDistribution(scores);
  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);

  return {
    totalVMs: scores.length,
    simpleCount: distribution['Simple'] || 0,
    moderateCount: distribution['Moderate'] || 0,
    complexCount: distribution['Complex'] || 0,
    blockerCount: distribution['Blocker'] || 0,
    averageScore: scores.length > 0 ? Math.round(totalScore / scores.length) : 0,
  };
}

/**
 * Calculate readiness score based on blockers, warnings, and OS compatibility
 */
export function calculateReadinessScore(
  blockerCount: number,
  warningCount: number,
  unsupportedOSCount: number,
  totalVMs: number
): number {
  const vmCount = totalVMs || 1;
  const blockerPenalty = (blockerCount / vmCount) * 50;
  const warningPenalty = (warningCount / vmCount) * 30;
  const unsupportedOSPenalty = (unsupportedOSCount / vmCount) * 20;

  return Math.max(0, Math.round(100 - blockerPenalty - warningPenalty - unsupportedOSPenalty));
}

/**
 * Get chart data for complexity distribution
 */
export function getComplexityChartData(distribution: Record<string, number>): Array<{ label: string; value: number }> {
  return [
    { label: 'Simple (0-25)', value: distribution['Simple'] || 0 },
    { label: 'Moderate (26-50)', value: distribution['Moderate'] || 0 },
    { label: 'Complex (51-75)', value: distribution['Complex'] || 0 },
    { label: 'Blocker (76-100)', value: distribution['Blocker'] || 0 },
  ].filter(d => d.value > 0);
}

/**
 * Get top N most complex VMs for chart display
 */
export function getTopComplexVMs(
  scores: ComplexityScore[],
  count: number = 10
): Array<{ label: string; value: number }> {
  return [...scores]
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(cs => ({
      label: cs.vmName.substring(0, 40),
      value: Math.round(cs.score),
    }));
}
