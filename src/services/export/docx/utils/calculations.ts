// DOCX Data Calculation Functions

import type { RVToolsData, VirtualMachine, VDiskInfo, VSnapshotInfo, VToolsInfo } from '@/types/rvtools';
import { mibToGiB, getHardwareVersionNumber } from '@/utils/formatters';
import { HW_VERSION_MINIMUM, SNAPSHOT_BLOCKER_AGE_DAYS } from '@/utils/constants';
import ibmCloudConfig from '@/data/ibmCloudConfig.json';
import osCompatibilityData from '@/data/redhatOSCompatibility.json';
import type { VMReadiness, ROKSSizing, VSIMapping } from '../types';
import { BOOT_DISK_SIZE_GIB, BOOT_STORAGE_COST_PER_GB, DATA_STORAGE_COST_PER_GB } from '../types';

function getOSCompatibility(guestOS: string) {
  const osLower = guestOS.toLowerCase();
  for (const entry of osCompatibilityData.osEntries) {
    if (entry.patterns.some((p: string) => osLower.includes(p))) {
      return entry;
    }
  }
  return osCompatibilityData.defaultEntry;
}

function mapVMToVSIProfile(vcpus: number, memoryGiB: number) {
  const vsiProfiles = ibmCloudConfig.vsiProfiles;
  const memToVcpuRatio = memoryGiB / vcpus;

  let family: 'balanced' | 'compute' | 'memory' = 'balanced';
  if (memToVcpuRatio <= 2.5) {
    family = 'compute';
  } else if (memToVcpuRatio >= 6) {
    family = 'memory';
  }

  const profiles = vsiProfiles[family];
  const bestFit = profiles.find(
    (p: { vcpus: number; memoryGiB: number }) => p.vcpus >= vcpus && p.memoryGiB >= memoryGiB
  );
  return { ...(bestFit || profiles[profiles.length - 1]), family };
}

function getVSIPricing(profileName: string): number {
  const pricing = ibmCloudConfig.vsiPricing as Record<string, { monthlyRate: number }>;
  return pricing[profileName]?.monthlyRate || 0;
}

function getBaremetalPricing(profileName: string): number {
  const pricing = ibmCloudConfig.bareMetalPricing as Record<string, { monthlyRate: number }>;
  return pricing[profileName]?.monthlyRate || 0;
}

export function calculateVMReadiness(rawData: RVToolsData): VMReadiness[] {
  const vms = rawData.vInfo.filter((vm) => vm.powerState === 'poweredOn' && !vm.template);
  const toolsMap = new Map(rawData.vTools.map((t: VToolsInfo) => [t.vmName, t]));
  const snapshotSet = new Set(
    rawData.vSnapshot
      .filter((s: VSnapshotInfo) => s.ageInDays > SNAPSHOT_BLOCKER_AGE_DAYS)
      .map((s: VSnapshotInfo) => s.vmName)
  );
  const rdmSet = new Set(rawData.vDisk.filter((d: VDiskInfo) => d.raw).map((d: VDiskInfo) => d.vmName));

  return vms.map((vm: VirtualMachine) => {
    const tool = toolsMap.get(vm.vmName);
    const osCompat = getOSCompatibility(vm.guestOS);
    const hwVersion = getHardwareVersionNumber(vm.hardwareVersion);

    const issues: string[] = [];
    let hasBlocker = false;
    let hasWarning = false;

    if (!tool || tool.toolsStatus === 'toolsNotInstalled') {
      issues.push('No VMware Tools');
      hasBlocker = true;
    }
    if (snapshotSet.has(vm.vmName)) {
      issues.push('Old Snapshots (>30d)');
      hasBlocker = true;
    }
    if (rdmSet.has(vm.vmName)) {
      issues.push('RDM Disk');
      hasBlocker = true;
    }
    if (osCompat.compatibilityStatus === 'unsupported') {
      issues.push('Unsupported OS');
      hasBlocker = true;
    }
    if (hwVersion < HW_VERSION_MINIMUM) {
      issues.push(`HW Version v${hwVersion}`);
      hasWarning = true;
    }
    if (tool?.toolsStatus === 'toolsOld') {
      issues.push('Outdated VMware Tools');
      hasWarning = true;
    }

    return {
      vmName: vm.vmName,
      cluster: vm.cluster || 'N/A',
      guestOS: vm.guestOS,
      cpus: vm.cpus,
      memoryGiB: Math.round(mibToGiB(vm.memory)),
      storageGiB: Math.round(mibToGiB(vm.provisionedMiB)),
      hasBlocker,
      hasWarning,
      issues,
    };
  });
}

export function calculateROKSSizing(rawData: RVToolsData): ROKSSizing {
  const { odfSizing, ocpVirtSizing, bareMetalProfiles: bmProfiles } = ibmCloudConfig;
  const bareMetalProfiles = [
    ...bmProfiles.balanced,
    ...bmProfiles.compute,
    ...bmProfiles.memory,
  ];
  const poweredOnVMs = rawData.vInfo.filter(
    (vm: VirtualMachine) => vm.powerState === 'poweredOn' && !vm.template
  );

  const totalVCPUs = poweredOnVMs.reduce((sum: number, vm: VirtualMachine) => sum + vm.cpus, 0);
  const totalMemoryGiB = poweredOnVMs.reduce(
    (sum: number, vm: VirtualMachine) => sum + mibToGiB(vm.memory),
    0
  );
  const totalStorageGiB = poweredOnVMs.reduce(
    (sum: number, vm: VirtualMachine) => sum + mibToGiB(vm.provisionedMiB),
    0
  );

  const replicaFactor = odfSizing.replicaFactor;
  const operationalCapacity = odfSizing.operationalCapacityPercent / 100;
  const cephEfficiency = 1 - odfSizing.cephOverheadPercent / 100;
  const requiredRawStorageGiB = Math.ceil(
    (totalStorageGiB * replicaFactor) / operationalCapacity / cephEfficiency
  );
  const adjustedVCPUs = Math.ceil(totalVCPUs / ocpVirtSizing.cpuOvercommitConservative);

  const recommendedProfile = bareMetalProfiles.find(
    (p: { name: string }) => p.name === 'bx2d.metal.96x384'
  ) || bareMetalProfiles[0];

  const usableThreadsPerNode = Math.floor(recommendedProfile.vcpus * 0.85);
  const usableMemoryPerNode = recommendedProfile.memoryGiB - ocpVirtSizing.systemReservedMemoryGiB;
  const usableNvmePerNode = recommendedProfile.totalNvmeGiB || 0;

  const nodesForCPU = Math.ceil(adjustedVCPUs / usableThreadsPerNode);
  const nodesForMemory = Math.ceil(totalMemoryGiB / usableMemoryPerNode);
  const nodesForStorage = usableNvmePerNode > 0 ? Math.ceil(requiredRawStorageGiB / usableNvmePerNode) : 0;
  const baseNodeCount = Math.max(odfSizing.minOdfNodes, nodesForCPU, nodesForMemory, nodesForStorage);
  const recommendedWorkers = baseNodeCount + ocpVirtSizing.nodeRedundancy;

  const totalClusterNvmeGiB = recommendedWorkers * (recommendedProfile.totalNvmeGiB || 0);
  const odfUsableTiB =
    ((totalClusterNvmeGiB / replicaFactor) * operationalCapacity * cephEfficiency) / 1024;

  const monthlyCost = recommendedWorkers * getBaremetalPricing('bx2d.metal.96x384');

  return {
    workerNodes: recommendedWorkers,
    profileName: recommendedProfile.name,
    totalCores: recommendedWorkers * recommendedProfile.physicalCores,
    totalThreads: recommendedWorkers * recommendedProfile.vcpus,
    totalMemoryGiB: recommendedWorkers * recommendedProfile.memoryGiB,
    totalNvmeTiB: Math.round(totalClusterNvmeGiB / 1024),
    odfUsableTiB: parseFloat(odfUsableTiB.toFixed(1)),
    monthlyCost,
  };
}

export function calculateVSIMappings(rawData: RVToolsData): VSIMapping[] {
  const poweredOnVMs = rawData.vInfo.filter(
    (vm: VirtualMachine) => vm.powerState === 'poweredOn' && !vm.template
  );

  return poweredOnVMs.map((vm: VirtualMachine) => {
    const memGiB = mibToGiB(vm.memory);
    const totalStorageGiB = mibToGiB(vm.inUseMiB || vm.provisionedMiB);
    const profile = mapVMToVSIProfile(vm.cpus, memGiB);
    const computeCost = getVSIPricing(profile.name);

    const bootDiskGiB = Math.min(BOOT_DISK_SIZE_GIB, Math.max(10, totalStorageGiB * 0.2));
    const bootStorageCost = bootDiskGiB * BOOT_STORAGE_COST_PER_GB;

    const dataDiskGiB = Math.max(0, totalStorageGiB - bootDiskGiB);
    const dataStorageCost = dataDiskGiB * DATA_STORAGE_COST_PER_GB;

    const storageCost = bootStorageCost + dataStorageCost;

    return {
      vmName: vm.vmName,
      sourceVcpus: vm.cpus,
      sourceMemoryGiB: Math.round(memGiB),
      sourceStorageGiB: Math.round(totalStorageGiB),
      bootDiskGiB: Math.round(bootDiskGiB),
      dataDiskGiB: Math.round(dataDiskGiB),
      profile: profile.name,
      profileVcpus: profile.vcpus,
      profileMemoryGiB: profile.memoryGiB,
      family: profile.family.charAt(0).toUpperCase() + profile.family.slice(1),
      computeCost,
      bootStorageCost,
      dataStorageCost,
      storageCost,
      monthlyCost: computeCost + storageCost,
    };
  });
}
