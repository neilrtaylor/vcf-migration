// Remediation item generation for migration pre-flight checks

import type { RemediationItem } from '@/components/common';
import mtvRequirements from '@/data/mtvRequirements.json';
import type { MigrationMode } from './osCompatibility';

// VPC VSI Limits
export const VPC_BOOT_DISK_MAX_GB = 250;
export const VPC_MAX_DISKS_PER_VM = 12;

export interface PreflightCheckCounts {
  // Common checks
  vmsWithoutTools: number;
  vmsWithoutToolsList: string[];
  vmsWithToolsNotRunning: number;
  vmsWithToolsNotRunningList: string[];
  vmsWithOldSnapshots: number;
  vmsWithOldSnapshotsList: string[];
  vmsWithRDM: number;
  vmsWithRDMList: string[];
  vmsWithSharedDisks: number;
  vmsWithSharedDisksList: string[];
  vmsWithLargeDisks: number;
  vmsWithLargeDisksList: string[];
  hwVersionOutdated: number;
  hwVersionOutdatedList: string[];

  // VSI-specific checks
  vmsWithLargeBootDisk?: number;
  vmsWithLargeBootDiskList?: string[];
  vmsWithTooManyDisks?: number;
  vmsWithTooManyDisksList?: string[];
  vmsWithLargeMemory?: number;
  vmsWithLargeMemoryList?: string[];
  vmsWithVeryLargeMemory?: number;
  vmsWithVeryLargeMemoryList?: string[];
  vmsWithUnsupportedOS?: number;
  vmsWithUnsupportedOSList?: string[];

  // ROKS-specific checks
  vmsWithCdConnected?: number;
  vmsWithCdConnectedList?: string[];
  vmsWithLegacyNIC?: number;
  vmsWithLegacyNICList?: string[];
  vmsWithoutCBT?: number;
  vmsWithoutCBTList?: string[];
  vmsWithInvalidNames?: number;
  vmsWithInvalidNamesList?: string[];
  vmsWithCPUHotPlug?: number;
  vmsWithCPUHotPlugList?: string[];
  vmsWithMemoryHotPlug?: number;
  vmsWithMemoryHotPlugList?: string[];
  vmsWithIndependentDisks?: number;
  vmsWithIndependentDisksList?: string[];
  vmsWithInvalidHostname?: number;
  vmsWithInvalidHostnameList?: string[];
  vmsStaticIPPoweredOff?: number;
  vmsStaticIPPoweredOffList?: string[];
}

/**
 * Generate remediation items for VSI migration
 */
export function generateVSIRemediationItems(counts: PreflightCheckCounts): RemediationItem[] {
  const items: RemediationItem[] = [];

  // BLOCKERS

  if (counts.vmsWithLargeBootDisk && counts.vmsWithLargeBootDisk > 0) {
    items.push({
      id: 'boot-disk-too-large',
      name: 'Boot Disk Exceeds 250GB Limit',
      severity: 'blocker',
      description: `VPC VSI boot volumes are limited to ${VPC_BOOT_DISK_MAX_GB}GB maximum. VMs with larger boot disks cannot be migrated directly.`,
      remediation: 'Reduce boot disk size by moving data to secondary disks, or restructure the VM to use a smaller boot volume with separate data volumes.',
      documentationLink: 'https://fullvalence.com/2025/11/10/from-vmware-to-ibm-cloud-vpc-vsi-part-3-migrating-virtual-machines/',
      affectedCount: counts.vmsWithLargeBootDisk,
      affectedVMs: counts.vmsWithLargeBootDiskList || [],
    });
  }

  if (counts.vmsWithTooManyDisks && counts.vmsWithTooManyDisks > 0) {
    items.push({
      id: 'too-many-disks',
      name: `Exceeds ${VPC_MAX_DISKS_PER_VM} Disk Limit`,
      severity: 'blocker',
      description: `VPC VSI supports a maximum of ${VPC_MAX_DISKS_PER_VM} disks per instance. VMs with more disks cannot be migrated directly.`,
      remediation: 'Consolidate disks or consider using file storage for some data volumes. Alternatively, split workloads across multiple VSIs.',
      documentationLink: 'https://fullvalence.com/2025/11/10/from-vmware-to-ibm-cloud-vpc-vsi-part-3-migrating-virtual-machines/',
      affectedCount: counts.vmsWithTooManyDisks,
      affectedVMs: counts.vmsWithTooManyDisksList || [],
    });
  }

  if (counts.vmsWithRDM > 0) {
    items.push({
      id: 'no-rdm',
      name: 'RDM Disks Detected',
      severity: 'blocker',
      description: 'Raw Device Mapping disks cannot be migrated to VPC VSI.',
      remediation: 'Convert RDM disks to VMDK before migration.',
      documentationLink: mtvRequirements.checks['no-rdm'].documentationLink,
      affectedCount: counts.vmsWithRDM,
      affectedVMs: counts.vmsWithRDMList,
    });
  }

  if (counts.vmsWithSharedDisks > 0) {
    items.push({
      id: 'no-shared-disks',
      name: 'Shared Disks Detected',
      severity: 'blocker',
      description: 'VPC VSI does not support shared block volumes. File storage is available but does not support Windows clients.',
      remediation: 'Reconfigure shared storage to use file storage (Linux only), or deploy a custom VSI with iSCSI targets as a workaround.',
      documentationLink: 'https://fullvalence.com/2025/11/10/from-vmware-to-ibm-cloud-vpc-vsi-part-3-migrating-virtual-machines/',
      affectedCount: counts.vmsWithSharedDisks,
      affectedVMs: counts.vmsWithSharedDisksList,
    });
  }

  if (counts.vmsWithVeryLargeMemory && counts.vmsWithVeryLargeMemory > 0) {
    items.push({
      id: 'large-memory',
      name: 'Very Large Memory VMs (>1TB)',
      severity: 'blocker',
      description: 'VMs with >1TB memory exceed VPC VSI profile limits.',
      remediation: 'Consider using bare metal servers or splitting workloads across multiple VSIs.',
      documentationLink: 'https://cloud.ibm.com/docs/vpc?topic=vpc-profiles',
      affectedCount: counts.vmsWithVeryLargeMemory,
      affectedVMs: counts.vmsWithVeryLargeMemoryList || [],
    });
  }

  if (counts.vmsWithUnsupportedOS && counts.vmsWithUnsupportedOS > 0) {
    items.push({
      id: 'unsupported-os',
      name: 'Unsupported Operating System',
      severity: 'blocker',
      description: 'These VMs have operating systems that are not supported for VPC VSI migration. Windows must be Server 2008 R2+ or Windows 7+.',
      remediation: 'Upgrade the operating system to a supported version before migration, or consider alternative migration strategies.',
      documentationLink: 'https://fullvalence.com/2025/11/10/from-vmware-to-ibm-cloud-vpc-vsi-part-3-migrating-virtual-machines/',
      affectedCount: counts.vmsWithUnsupportedOS,
      affectedVMs: counts.vmsWithUnsupportedOSList || [],
    });
  }

  // WARNINGS

  if (counts.vmsWithoutTools > 0) {
    items.push({
      id: 'tools-installed',
      name: 'VMware Tools Not Installed',
      severity: 'warning',
      description: 'VMware Tools required for clean VM export and proper shutdown.',
      remediation: 'Install VMware Tools before exporting the VM. Windows VMs must be shut down cleanly for virt-v2v processing.',
      documentationLink: mtvRequirements.checks['tools-installed'].documentationLink,
      affectedCount: counts.vmsWithoutTools,
      affectedVMs: counts.vmsWithoutToolsList,
    });
  }

  const largeMemoryOnly = (counts.vmsWithLargeMemory || 0) - (counts.vmsWithVeryLargeMemory || 0);
  if (largeMemoryOnly > 0) {
    const largeMemoryOnlyList = (counts.vmsWithLargeMemoryList || []).filter(
      vm => !(counts.vmsWithVeryLargeMemoryList || []).includes(vm)
    );
    items.push({
      id: 'large-memory-warning',
      name: 'Large Memory VMs (>512GB)',
      severity: 'warning',
      description: 'VMs with >512GB memory require high-memory profiles which may have limited availability.',
      remediation: 'Ensure mx2-128x1024 or similar profile is available in your target region.',
      documentationLink: 'https://cloud.ibm.com/docs/vpc?topic=vpc-profiles',
      affectedCount: largeMemoryOnly,
      affectedVMs: largeMemoryOnlyList,
    });
  }

  if (counts.vmsWithLargeDisks > 0) {
    items.push({
      id: 'large-disks',
      name: 'Large Disks (>2TB)',
      severity: 'warning',
      description: 'Disks larger than 2TB may require multiple block volumes.',
      remediation: 'Plan for disk splitting or use file storage for large data volumes.',
      documentationLink: 'https://cloud.ibm.com/docs/vpc?topic=vpc-block-storage-profiles',
      affectedCount: counts.vmsWithLargeDisks,
      affectedVMs: counts.vmsWithLargeDisksList,
    });
  }

  if (counts.vmsWithOldSnapshots > 0) {
    items.push({
      id: 'old-snapshots',
      name: 'Old Snapshots',
      severity: 'warning',
      description: 'Snapshots should be consolidated before export for best results.',
      remediation: 'Delete or consolidate snapshots before VM export.',
      documentationLink: mtvRequirements.checks['old-snapshots'].documentationLink,
      affectedCount: counts.vmsWithOldSnapshots,
      affectedVMs: counts.vmsWithOldSnapshotsList,
    });
  }

  return items;
}

/**
 * Generate remediation items for ROKS migration
 */
export function generateROKSRemediationItems(counts: PreflightCheckCounts): RemediationItem[] {
  const items: RemediationItem[] = [];

  // BLOCKERS

  if (counts.vmsWithoutTools > 0) {
    items.push({
      id: 'tools-installed',
      name: mtvRequirements.checks['tools-installed'].name,
      severity: 'blocker',
      description: mtvRequirements.checks['tools-installed'].description,
      remediation: mtvRequirements.checks['tools-installed'].remediation,
      documentationLink: mtvRequirements.checks['tools-installed'].documentationLink,
      affectedCount: counts.vmsWithoutTools,
      affectedVMs: counts.vmsWithoutToolsList,
    });
  }

  if (counts.vmsWithOldSnapshots > 0) {
    items.push({
      id: 'old-snapshots',
      name: mtvRequirements.checks['old-snapshots'].name,
      severity: 'blocker',
      description: mtvRequirements.checks['old-snapshots'].description,
      remediation: mtvRequirements.checks['old-snapshots'].remediation,
      documentationLink: mtvRequirements.checks['old-snapshots'].documentationLink,
      affectedCount: counts.vmsWithOldSnapshots,
      affectedVMs: counts.vmsWithOldSnapshotsList,
    });
  }

  if (counts.vmsWithRDM > 0) {
    items.push({
      id: 'no-rdm',
      name: mtvRequirements.checks['no-rdm'].name,
      severity: 'blocker',
      description: mtvRequirements.checks['no-rdm'].description,
      remediation: mtvRequirements.checks['no-rdm'].remediation,
      documentationLink: mtvRequirements.checks['no-rdm'].documentationLink,
      affectedCount: counts.vmsWithRDM,
      affectedVMs: counts.vmsWithRDMList,
    });
  }

  if (counts.vmsWithSharedDisks > 0) {
    items.push({
      id: 'no-shared-disks',
      name: mtvRequirements.checks['no-shared-disks'].name,
      severity: 'blocker',
      description: mtvRequirements.checks['no-shared-disks'].description,
      remediation: mtvRequirements.checks['no-shared-disks'].remediation,
      documentationLink: mtvRequirements.checks['no-shared-disks'].documentationLink,
      affectedCount: counts.vmsWithSharedDisks,
      affectedVMs: counts.vmsWithSharedDisksList,
    });
  }

  if (counts.vmsWithIndependentDisks && counts.vmsWithIndependentDisks > 0) {
    items.push({
      id: 'independent-disk',
      name: mtvRequirements.checks['independent-disk'].name,
      severity: 'blocker',
      description: mtvRequirements.checks['independent-disk'].description,
      remediation: mtvRequirements.checks['independent-disk'].remediation,
      documentationLink: mtvRequirements.checks['independent-disk'].documentationLink,
      affectedCount: counts.vmsWithIndependentDisks,
      affectedVMs: counts.vmsWithIndependentDisksList || [],
    });
  }

  // WARNINGS

  if (counts.vmsWithToolsNotRunning > 0) {
    items.push({
      id: 'tools-running',
      name: mtvRequirements.checks['tools-running'].name,
      severity: 'warning',
      description: mtvRequirements.checks['tools-running'].description,
      remediation: mtvRequirements.checks['tools-running'].remediation,
      documentationLink: mtvRequirements.checks['tools-running'].documentationLink,
      affectedCount: counts.vmsWithToolsNotRunning,
      affectedVMs: counts.vmsWithToolsNotRunningList,
    });
  }

  if (counts.vmsWithCdConnected && counts.vmsWithCdConnected > 0) {
    items.push({
      id: 'cd-disconnected',
      name: mtvRequirements.checks['cd-disconnected'].name,
      severity: 'warning',
      description: mtvRequirements.checks['cd-disconnected'].description,
      remediation: mtvRequirements.checks['cd-disconnected'].remediation,
      documentationLink: mtvRequirements.checks['cd-disconnected'].documentationLink,
      affectedCount: counts.vmsWithCdConnected,
      affectedVMs: counts.vmsWithCdConnectedList || [],
    });
  }

  if (counts.hwVersionOutdated > 0) {
    items.push({
      id: 'hw-version',
      name: mtvRequirements.checks['hw-version'].name,
      severity: 'warning',
      description: mtvRequirements.checks['hw-version'].description,
      remediation: mtvRequirements.checks['hw-version'].remediation,
      documentationLink: mtvRequirements.checks['hw-version'].documentationLink,
      affectedCount: counts.hwVersionOutdated,
      affectedVMs: counts.hwVersionOutdatedList,
    });
  }

  if (counts.vmsWithLegacyNIC && counts.vmsWithLegacyNIC > 0) {
    items.push({
      id: 'network-adapter',
      name: mtvRequirements.checks['network-adapter'].name,
      severity: 'info',
      description: mtvRequirements.checks['network-adapter'].description,
      remediation: mtvRequirements.checks['network-adapter'].remediation,
      documentationLink: mtvRequirements.checks['network-adapter'].documentationLink,
      affectedCount: counts.vmsWithLegacyNIC,
      affectedVMs: counts.vmsWithLegacyNICList || [],
    });
  }

  if (counts.vmsWithoutCBT && counts.vmsWithoutCBT > 0) {
    items.push({
      id: 'cbt-enabled',
      name: mtvRequirements.checks['cbt-enabled'].name,
      severity: 'warning',
      description: mtvRequirements.checks['cbt-enabled'].description,
      remediation: mtvRequirements.checks['cbt-enabled'].remediation,
      documentationLink: mtvRequirements.checks['cbt-enabled'].documentationLink,
      affectedCount: counts.vmsWithoutCBT,
      affectedVMs: counts.vmsWithoutCBTList || [],
    });
  }

  if (counts.vmsWithInvalidNames && counts.vmsWithInvalidNames > 0) {
    items.push({
      id: 'vm-name-rfc1123',
      name: mtvRequirements.checks['vm-name-rfc1123'].name,
      severity: 'warning',
      description: mtvRequirements.checks['vm-name-rfc1123'].description,
      remediation: mtvRequirements.checks['vm-name-rfc1123'].remediation,
      documentationLink: mtvRequirements.checks['vm-name-rfc1123'].documentationLink,
      affectedCount: counts.vmsWithInvalidNames,
      affectedVMs: counts.vmsWithInvalidNamesList || [],
    });
  }

  if (counts.vmsWithCPUHotPlug && counts.vmsWithCPUHotPlug > 0) {
    items.push({
      id: 'cpu-hot-plug',
      name: mtvRequirements.checks['cpu-hot-plug'].name,
      severity: 'warning',
      description: mtvRequirements.checks['cpu-hot-plug'].description,
      remediation: mtvRequirements.checks['cpu-hot-plug'].remediation,
      documentationLink: mtvRequirements.checks['cpu-hot-plug'].documentationLink,
      affectedCount: counts.vmsWithCPUHotPlug,
      affectedVMs: counts.vmsWithCPUHotPlugList || [],
    });
  }

  if (counts.vmsWithMemoryHotPlug && counts.vmsWithMemoryHotPlug > 0) {
    items.push({
      id: 'memory-hot-plug',
      name: mtvRequirements.checks['memory-hot-plug'].name,
      severity: 'warning',
      description: mtvRequirements.checks['memory-hot-plug'].description,
      remediation: mtvRequirements.checks['memory-hot-plug'].remediation,
      documentationLink: mtvRequirements.checks['memory-hot-plug'].documentationLink,
      affectedCount: counts.vmsWithMemoryHotPlug,
      affectedVMs: counts.vmsWithMemoryHotPlugList || [],
    });
  }

  if (counts.vmsWithInvalidHostname && counts.vmsWithInvalidHostname > 0) {
    items.push({
      id: 'hostname-missing',
      name: mtvRequirements.checks['hostname-missing'].name,
      severity: 'warning',
      description: mtvRequirements.checks['hostname-missing'].description,
      remediation: mtvRequirements.checks['hostname-missing'].remediation,
      documentationLink: mtvRequirements.checks['hostname-missing'].documentationLink,
      affectedCount: counts.vmsWithInvalidHostname,
      affectedVMs: counts.vmsWithInvalidHostnameList || [],
    });
  }

  if (counts.vmsStaticIPPoweredOff && counts.vmsStaticIPPoweredOff > 0) {
    items.push({
      id: 'static-ip-powered-off',
      name: mtvRequirements.checks['static-ip-powered-off'].name,
      severity: 'warning',
      description: mtvRequirements.checks['static-ip-powered-off'].description,
      remediation: mtvRequirements.checks['static-ip-powered-off'].remediation,
      documentationLink: mtvRequirements.checks['static-ip-powered-off'].documentationLink,
      affectedCount: counts.vmsStaticIPPoweredOff,
      affectedVMs: counts.vmsStaticIPPoweredOffList || [],
    });
  }

  return items;
}

/**
 * Generate remediation items based on migration mode
 */
export function generateRemediationItems(
  counts: PreflightCheckCounts,
  mode: MigrationMode
): RemediationItem[] {
  return mode === 'vsi'
    ? generateVSIRemediationItems(counts)
    : generateROKSRemediationItems(counts);
}

/**
 * Count blockers and warnings from remediation items
 */
export function countRemediationSeverity(items: RemediationItem[]): { blockers: number; warnings: number; info: number } {
  return items.reduce(
    (acc, item) => {
      if (item.severity === 'blocker') acc.blockers += item.affectedCount;
      else if (item.severity === 'warning') acc.warnings += item.affectedCount;
      else if (item.severity === 'info') acc.info += item.affectedCount;
      return acc;
    },
    { blockers: 0, warnings: 0, info: 0 }
  );
}
