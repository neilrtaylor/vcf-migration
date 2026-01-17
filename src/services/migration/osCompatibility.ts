// OS compatibility services for VSI and ROKS migrations

import osCompatibilityData from '@/data/redhatOSCompatibility.json';

export type MigrationMode = 'vsi' | 'roks';

// IBM Cloud VPC supported guest OS mapping
const ibmCloudOSSupport: Record<string, { status: 'supported' | 'community' | 'unsupported'; notes: string }> = {
  'rhel': { status: 'supported', notes: 'RHEL 7.x, 8.x, 9.x supported' },
  'centos': { status: 'community', notes: 'CentOS 7.x, 8.x - community supported' },
  'ubuntu': { status: 'supported', notes: 'Ubuntu 18.04, 20.04, 22.04 supported' },
  'debian': { status: 'community', notes: 'Debian 10, 11 - community supported' },
  'windows 2016': { status: 'supported', notes: 'Windows Server 2016 supported' },
  'windows 2019': { status: 'supported', notes: 'Windows Server 2019 supported' },
  'windows 2022': { status: 'supported', notes: 'Windows Server 2022 supported' },
  'sles': { status: 'supported', notes: 'SUSE Linux Enterprise Server supported' },
  'rocky': { status: 'community', notes: 'Rocky Linux - community supported' },
  'alma': { status: 'community', notes: 'AlmaLinux - community supported' },
};

export interface VSIOSCompatibility {
  status: 'supported' | 'community' | 'unsupported';
  notes: string;
}

export interface ROKSOSCompatibility {
  id: string;
  displayName: string;
  patterns: string[];
  compatibilityStatus: 'fully-supported' | 'supported-with-caveats' | 'unsupported';
  compatibilityScore: number;
  notes: string;
  documentationLink?: string;
  recommendedUpgrade?: string;
  eolDate?: string;
}

/**
 * Get IBM Cloud VPC VSI OS compatibility
 */
export function getVSIOSCompatibility(guestOS: string): VSIOSCompatibility {
  const osLower = guestOS.toLowerCase();
  for (const [pattern, support] of Object.entries(ibmCloudOSSupport)) {
    if (osLower.includes(pattern)) {
      return support;
    }
  }
  return { status: 'unsupported', notes: 'Not validated for IBM Cloud VPC' };
}

/**
 * Get ROKS/OpenShift Virtualization OS compatibility
 */
export function getROKSOSCompatibility(guestOS: string): ROKSOSCompatibility {
  const osLower = guestOS.toLowerCase();
  for (const entry of osCompatibilityData.osEntries) {
    if (entry.patterns.some(p => osLower.includes(p))) {
      return {
        id: entry.id,
        displayName: entry.displayName,
        patterns: entry.patterns,
        compatibilityStatus: entry.compatibilityStatus as ROKSOSCompatibility['compatibilityStatus'],
        compatibilityScore: entry.compatibilityScore,
        notes: entry.notes,
        documentationLink: entry.documentationLink,
        recommendedUpgrade: (entry as { recommendedUpgrade?: string }).recommendedUpgrade,
        eolDate: (entry as { eolDate?: string }).eolDate,
      };
    }
  }
  // Default entry doesn't have patterns array
  const defaultEntry = osCompatibilityData.defaultEntry;
  return {
    id: defaultEntry.id,
    displayName: defaultEntry.displayName,
    patterns: [],
    compatibilityStatus: defaultEntry.compatibilityStatus as ROKSOSCompatibility['compatibilityStatus'],
    compatibilityScore: defaultEntry.compatibilityScore,
    notes: defaultEntry.notes,
    documentationLink: defaultEntry.documentationLink,
  };
}

/**
 * Unified OS compatibility check for both migration modes
 */
export function getOSCompatibility(guestOS: string, mode: MigrationMode): VSIOSCompatibility | ROKSOSCompatibility {
  return mode === 'vsi'
    ? getVSIOSCompatibility(guestOS)
    : getROKSOSCompatibility(guestOS);
}

/**
 * Check if OS is considered a blocker for migration
 */
export function isOSBlocker(guestOS: string, mode: MigrationMode): boolean {
  if (mode === 'vsi') {
    return getVSIOSCompatibility(guestOS).status === 'unsupported';
  }
  return getROKSOSCompatibility(guestOS).compatibilityStatus === 'unsupported';
}

/**
 * Get normalized OS status for unified handling
 */
export function getNormalizedOSStatus(guestOS: string, mode: MigrationMode): 'supported' | 'partial' | 'unsupported' {
  if (mode === 'vsi') {
    const compat = getVSIOSCompatibility(guestOS);
    if (compat.status === 'supported') return 'supported';
    if (compat.status === 'community') return 'partial';
    return 'unsupported';
  }

  const compat = getROKSOSCompatibility(guestOS);
  if (compat.compatibilityStatus === 'fully-supported') return 'supported';
  if (compat.compatibilityStatus === 'supported-with-caveats') return 'partial';
  return 'unsupported';
}

export interface OSCompatibilityResult {
  vmName: string;
  guestOS: string;
  compatibility: VSIOSCompatibility | ROKSOSCompatibility;
  normalizedStatus: 'supported' | 'partial' | 'unsupported';
}

/**
 * Get OS compatibility results for a list of VMs
 */
export function getOSCompatibilityResults(
  vms: Array<{ vmName: string; guestOS: string }>,
  mode: MigrationMode
): OSCompatibilityResult[] {
  return vms.map(vm => ({
    vmName: vm.vmName,
    guestOS: vm.guestOS,
    compatibility: getOSCompatibility(vm.guestOS, mode),
    normalizedStatus: getNormalizedOSStatus(vm.guestOS, mode),
  }));
}

/**
 * Count VMs by OS compatibility status
 */
export function countByOSStatus(
  vms: Array<{ vmName: string; guestOS: string }>,
  mode: MigrationMode
): Record<string, number> {
  const results = getOSCompatibilityResults(vms, mode);

  return results.reduce((acc, result) => {
    if (mode === 'vsi') {
      const status = (result.compatibility as VSIOSCompatibility).status;
      acc[status] = (acc[status] || 0) + 1;
    } else {
      const status = (result.compatibility as ROKSOSCompatibility).compatibilityStatus;
      acc[status] = (acc[status] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
}
