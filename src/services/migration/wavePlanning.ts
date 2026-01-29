// Wave planning services for migration

import { mibToGiB } from '@/utils/formatters';
import { SNAPSHOT_BLOCKER_AGE_DAYS } from '@/utils/constants';
import type { MigrationMode } from './osCompatibility';
import { getVSIOSCompatibility, getROKSOSCompatibility } from './osCompatibility';
import type { ComplexityScore } from './migrationAssessment';
import type { VirtualMachine, VDiskInfo, VSnapshotInfo, VToolsInfo, VNetworkInfo } from '@/types/rvtools';

export interface VMWaveData {
  vmName: string;
  complexity: number;
  osStatus: string;
  hasBlocker: boolean;
  vcpus: number;
  memoryGiB: number;
  storageGiB: number;
  networkName: string;
  ipAddress: string;
  subnet: string;
  cluster: string;
}

export interface WaveGroup {
  name: string;
  description: string;
  vms: VMWaveData[];
  vmCount: number;
  vcpus: number;
  memoryGiB: number;
  storageGiB: number;
  hasBlockers: boolean;
  avgComplexity?: number;
}

export interface NetworkWaveGroup extends WaveGroup {
  avgComplexity: number;
}

export type NetworkGroupBy = 'portGroup' | 'cluster';

// Type aliases for wave planning inputs - use RVTools types directly
export type VMInput = Pick<VirtualMachine, 'vmName' | 'guestOS' | 'cpus' | 'memory' | 'inUseMiB' | 'cluster'>;
export type SnapshotData = Pick<VSnapshotInfo, 'vmName' | 'ageInDays'>;
export type DiskData = Pick<VDiskInfo, 'vmName' | 'raw' | 'sharingMode'>;
export type ToolsData = Pick<VToolsInfo, 'vmName' | 'toolsStatus'>;
export type NetworkData = Pick<VNetworkInfo, 'vmName' | 'networkName' | 'ipv4Address'>;

/**
 * Build VM wave data from raw inputs
 */
export function buildVMWaveData(
  vms: VMInput[],
  complexityScores: ComplexityScore[],
  disks: DiskData[],
  snapshots: SnapshotData[],
  tools: ToolsData[],
  networks: NetworkData[],
  mode: MigrationMode
): VMWaveData[] {
  // Build lookup maps
  const toolsMap = new Map(tools.map(t => [t.vmName, t]));
  const networksByVMName = new Map<string, NetworkData[]>();
  networks.forEach(n => {
    const key = n.vmName.toLowerCase();
    if (!networksByVMName.has(key)) {
      networksByVMName.set(key, []);
    }
    networksByVMName.get(key)!.push(n);
  });

  return vms.map(vm => {
    const complexityData = complexityScores.find(cs => cs.vmName === vm.vmName);

    // Determine OS status based on mode
    let osStatus: string;
    if (mode === 'vsi') {
      osStatus = getVSIOSCompatibility(vm.guestOS).status;
    } else {
      osStatus = getROKSOSCompatibility(vm.guestOS).compatibilityStatus;
    }

    // Check for blockers
    const hasRDMOrShared = disks.some(d =>
      d.vmName === vm.vmName && (d.raw || (d.sharingMode && d.sharingMode.toLowerCase() !== 'sharingnone'))
    );
    const hasOldSnapshot = snapshots.some(s => s.vmName === vm.vmName && s.ageInDays > SNAPSHOT_BLOCKER_AGE_DAYS);
    const toolStatus = toolsMap.get(vm.vmName);
    const noTools = !toolStatus || toolStatus.toolsStatus === 'toolsNotInstalled' || toolStatus.toolsStatus === 'guestToolsNotInstalled';

    // VSI-specific blockers
    const hasVeryLargeMem = mode === 'vsi' && mibToGiB(vm.memory) > 1024;

    const hasBlocker = hasRDMOrShared || (mode === 'roks' && hasOldSnapshot) || (mode === 'roks' && noTools) || hasVeryLargeMem;

    // Get network info
    const vmNetworks = networksByVMName.get(vm.vmName.toLowerCase()) || [];
    const primaryNetwork = vmNetworks[0];
    const networkName = primaryNetwork?.networkName || 'No Network';
    const ipAddress = primaryNetwork?.ipv4Address || '';
    const subnet = ipAddress ? ipAddress.split('.').slice(0, 3).join('.') + '.0/24' : 'Unknown';

    return {
      vmName: vm.vmName,
      complexity: complexityData?.score || 0,
      osStatus,
      hasBlocker,
      vcpus: vm.cpus,
      memoryGiB: Math.round(mibToGiB(vm.memory)),
      storageGiB: Math.round(mibToGiB(vm.inUseMiB)),
      networkName,
      ipAddress,
      subnet,
      cluster: vm.cluster || 'No Cluster',
    };
  });
}

/**
 * Create complexity-based migration waves
 */
export function createComplexityWaves(
  vmWaveData: VMWaveData[],
  mode: MigrationMode
): WaveGroup[] {
  const supportedStatus = mode === 'vsi' ? 'supported' : 'fully-supported';

  const waveList: WaveGroup[] = [
    { name: 'Wave 1: Pilot', description: 'Simple VMs with supported OS for initial validation', vms: [], vmCount: 0, vcpus: 0, memoryGiB: 0, storageGiB: 0, hasBlockers: false },
    { name: 'Wave 2: Quick Wins', description: 'Low complexity VMs ready for migration', vms: [], vmCount: 0, vcpus: 0, memoryGiB: 0, storageGiB: 0, hasBlockers: false },
    { name: 'Wave 3: Standard', description: 'Moderate complexity VMs', vms: [], vmCount: 0, vcpus: 0, memoryGiB: 0, storageGiB: 0, hasBlockers: false },
    { name: 'Wave 4: Complex', description: 'High complexity VMs requiring careful planning', vms: [], vmCount: 0, vcpus: 0, memoryGiB: 0, storageGiB: 0, hasBlockers: false },
    { name: 'Wave 5: Remediation', description: 'VMs with blockers requiring fixes before migration', vms: [], vmCount: 0, vcpus: 0, memoryGiB: 0, storageGiB: 0, hasBlockers: true },
  ];

  vmWaveData.forEach(vm => {
    let waveIndex: number;
    if (vm.hasBlocker) {
      waveIndex = 4;
    } else if (vm.complexity <= 15 && vm.osStatus === supportedStatus) {
      waveIndex = 0;
    } else if (vm.complexity <= 30) {
      waveIndex = 1;
    } else if (vm.complexity <= 55) {
      waveIndex = 2;
    } else {
      waveIndex = 3;
    }
    waveList[waveIndex].vms.push(vm);
  });

  // Calculate totals
  return waveList
    .map(wave => ({
      ...wave,
      vmCount: wave.vms.length,
      vcpus: wave.vms.reduce((sum, vm) => sum + vm.vcpus, 0),
      memoryGiB: wave.vms.reduce((sum, vm) => sum + vm.memoryGiB, 0),
      storageGiB: wave.vms.reduce((sum, vm) => sum + vm.storageGiB, 0),
    }))
    .filter(w => w.vms.length > 0);
}

/**
 * Create network-based migration waves
 */
export function createNetworkWaves(
  vmWaveData: VMWaveData[],
  groupBy: NetworkGroupBy
): NetworkWaveGroup[] {
  const groups = new Map<string, VMWaveData[]>();

  vmWaveData.forEach(vm => {
    const key = groupBy === 'cluster' ? vm.cluster : (vm.networkName || 'No Network');

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(vm);
  });

  // Convert to wave format
  const waves = Array.from(groups.entries()).map(([groupName, vms]) => {
    const ipRanges = [...new Set(vms.map(v => v.ipAddress).filter(Boolean))];
    const portGroups = [...new Set(vms.map(v => v.networkName).filter(n => n && n !== 'No Network'))];
    const hasBlockers = vms.some(vm => vm.hasBlocker);
    const avgComplexity = vms.reduce((sum, vm) => sum + vm.complexity, 0) / vms.length;

    let description: string;
    if (groupBy === 'portGroup') {
      description = ipRanges.length > 0
        ? `IPs: ${ipRanges.slice(0, 3).join(', ')}${ipRanges.length > 3 ? ` +${ipRanges.length - 3} more` : ''}`
        : 'No IP addresses detected';
    } else {
      description = portGroups.length > 0
        ? `Port Group: ${portGroups.slice(0, 3).join(', ')}${portGroups.length > 3 ? ` +${portGroups.length - 3} more` : ''}`
        : 'No port group info';
    }

    return {
      name: groupName,
      description,
      vms,
      vmCount: vms.length,
      hasBlockers,
      avgComplexity,
      vcpus: vms.reduce((sum, vm) => sum + vm.vcpus, 0),
      memoryGiB: vms.reduce((sum, vm) => sum + vm.memoryGiB, 0),
      storageGiB: vms.reduce((sum, vm) => sum + vm.storageGiB, 0),
    };
  });

  // Sort: groups without blockers first, then by VM count ascending
  return waves.sort((a, b) => {
    if (a.hasBlockers !== b.hasBlockers) return a.hasBlockers ? 1 : -1;
    return a.vmCount - b.vmCount;
  });
}

/**
 * Get wave chart data
 */
export function getWaveChartData(
  waves: WaveGroup[],
  isNetworkMode: boolean,
  maxItems: number = 10
): Array<{ label: string; value: number }> {
  if (isNetworkMode) {
    return waves.slice(0, maxItems).map((wave) => ({
      label: wave.name.length > 20 ? wave.name.substring(0, 17) + '...' : wave.name,
      value: wave.vmCount,
    }));
  }

  return waves.map((wave, waveIdx) => ({
    label: `Wave ${waveIdx + 1}`,
    value: wave.vmCount,
  }));
}

/**
 * Get wave resources summary
 */
export function getWaveResources(
  waves: WaveGroup[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _isNetworkMode: boolean
): Array<{
  name: string;
  description: string;
  vmCount: number;
  vcpus: number;
  memoryGiB: number;
  storageGiB: number;
  hasBlockers: boolean;
}> {
  return waves.map((wave) => ({
    name: wave.name,
    description: wave.description,
    vmCount: wave.vmCount,
    vcpus: wave.vcpus,
    memoryGiB: wave.memoryGiB,
    storageGiB: wave.storageGiB,
    hasBlockers: wave.hasBlockers,
  }));
}
