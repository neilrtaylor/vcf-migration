// VSI Profile mapping services

import { mibToGiB } from '@/utils/formatters';
import ibmCloudConfig from '@/data/ibmCloudConfig.json';

export interface VSIProfile {
  name: string;
  vcpus: number;
  memoryGiB: number;
  bandwidthGbps: number;
  hourlyRate: number;
  monthlyRate: number;
}

export interface CustomProfile {
  name: string;
  vcpus: number;
  memoryGiB: number;
  bandwidth?: number;
}

export interface VMProfileMapping {
  vmName: string;
  vcpus: number;
  memoryGiB: number;
  autoProfile: VSIProfile;
  profile: VSIProfile;
  effectiveProfileName: string;
  isOverridden: boolean;
}

export type ProfileFamily = 'balanced' | 'compute' | 'memory';

/**
 * Get all VSI profiles from config
 */
export function getVSIProfiles(): Record<ProfileFamily, VSIProfile[]> {
  return ibmCloudConfig.vsiProfiles as Record<ProfileFamily, VSIProfile[]>;
}

/**
 * Determine profile family based on memory to vCPU ratio
 */
export function determineProfileFamily(vcpus: number, memoryGiB: number): ProfileFamily {
  const memToVcpuRatio = memoryGiB / vcpus;

  if (memToVcpuRatio <= 2.5) {
    return 'compute';
  } else if (memToVcpuRatio >= 6) {
    return 'memory';
  }
  return 'balanced';
}

/**
 * Map a VM to the best-fit VSI profile
 */
export function mapVMToVSIProfile(vcpus: number, memoryGiB: number): VSIProfile {
  const vsiProfiles = getVSIProfiles();
  const family = determineProfileFamily(vcpus, memoryGiB);

  const profiles = vsiProfiles[family];
  const bestFit = profiles.find(p => p.vcpus >= vcpus && p.memoryGiB >= memoryGiB);
  return bestFit || profiles[profiles.length - 1];
}

/**
 * Find a profile by name across all families
 */
export function findProfileByName(name: string): VSIProfile | undefined {
  const vsiProfiles = getVSIProfiles();
  const allProfiles = [
    ...vsiProfiles.balanced,
    ...vsiProfiles.compute,
    ...vsiProfiles.memory,
  ];
  return allProfiles.find(p => p.name === name);
}

/**
 * Get profile family from profile name prefix
 */
export function getProfileFamilyFromName(profileName: string): string {
  const prefix = profileName.split('-')[0];
  switch (prefix) {
    case 'bx2':
    case 'bx2d':
      return 'Balanced';
    case 'cx2':
    case 'cx2d':
      return 'Compute';
    case 'mx2':
    case 'mx2d':
      return 'Memory';
    default:
      return 'Other';
  }
}

export interface VMInput {
  vmName: string;
  cpus: number;
  memory: number; // in MiB
}

/**
 * Create profile mappings for a list of VMs
 */
export function createVMProfileMappings(
  vms: VMInput[],
  customProfiles: CustomProfile[],
  getEffectiveProfile: (vmName: string, autoProfile: string) => string,
  hasOverride: (vmName: string) => boolean
): VMProfileMapping[] {
  return vms.map(vm => {
    const memoryGiB = mibToGiB(vm.memory);
    const autoProfile = mapVMToVSIProfile(vm.cpus, memoryGiB);
    const effectiveProfileName = getEffectiveProfile(vm.vmName, autoProfile.name);
    const isOverridden = hasOverride(vm.vmName);

    // Look up profile details
    let effectiveProfile = autoProfile;
    if (isOverridden) {
      const customProfile = customProfiles.find(p => p.name === effectiveProfileName);
      if (customProfile) {
        effectiveProfile = {
          name: customProfile.name,
          vcpus: customProfile.vcpus,
          memoryGiB: customProfile.memoryGiB,
          bandwidthGbps: customProfile.bandwidth || 16,
          hourlyRate: 0,
          monthlyRate: 0,
        };
      } else {
        const standardProfile = findProfileByName(effectiveProfileName);
        if (standardProfile) {
          effectiveProfile = standardProfile;
        }
      }
    }

    return {
      vmName: vm.vmName,
      vcpus: vm.cpus,
      memoryGiB: Math.round(memoryGiB),
      autoProfile,
      profile: effectiveProfile,
      effectiveProfileName,
      isOverridden,
    };
  });
}

/**
 * Count VMs by profile name
 */
export function countByProfile(mappings: VMProfileMapping[]): Record<string, number> {
  return mappings.reduce((acc, mapping) => {
    acc[mapping.profile.name] = (acc[mapping.profile.name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Count VMs by profile family
 */
export function countByFamily(mappings: VMProfileMapping[]): Record<string, number> {
  return mappings.reduce((acc, mapping) => {
    const familyName = getProfileFamilyFromName(mapping.profile.name);
    acc[familyName] = (acc[familyName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Get top N profiles by VM count
 */
export function getTopProfiles(
  mappings: VMProfileMapping[],
  count: number = 10
): Array<{ label: string; value: number }> {
  const profileCounts = countByProfile(mappings);
  return Object.entries(profileCounts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, count);
}

/**
 * Get family distribution chart data
 */
export function getFamilyChartData(mappings: VMProfileMapping[]): Array<{ label: string; value: number }> {
  const familyCounts = countByFamily(mappings);
  return Object.entries(familyCounts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Calculate totals from profile mappings
 */
export function calculateProfileTotals(mappings: VMProfileMapping[]): {
  totalVSIs: number;
  uniqueProfiles: number;
  totalVCPUs: number;
  totalMemory: number;
  overriddenCount: number;
} {
  const profileCounts = countByProfile(mappings);

  return {
    totalVSIs: mappings.length,
    uniqueProfiles: Object.keys(profileCounts).length,
    totalVCPUs: mappings.reduce((sum, m) => sum + m.profile.vcpus, 0),
    totalMemory: mappings.reduce((sum, m) => sum + m.profile.memoryGiB, 0),
    overriddenCount: mappings.filter(m => m.isOverridden).length,
  };
}
