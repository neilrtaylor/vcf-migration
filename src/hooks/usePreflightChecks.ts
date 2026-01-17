// Pre-flight checks hook - manages migration pre-flight validation

import { useMemo } from 'react';
import { mibToGiB, getHardwareVersionNumber } from '@/utils/formatters';
import { HW_VERSION_MINIMUM, HW_VERSION_RECOMMENDED, SNAPSHOT_BLOCKER_AGE_DAYS } from '@/utils/constants';
import {
  type MigrationMode,
  type PreflightCheckCounts,
  VPC_BOOT_DISK_MAX_GB,
  VPC_MAX_DISKS_PER_VM,
  generateRemediationItems,
  countRemediationSeverity,
  getVSIOSCompatibility,
} from '@/services/migration';
import type { RemediationItem } from '@/components/common';
import type {
  VirtualMachine,
  VDiskInfo,
  VSnapshotInfo,
  VToolsInfo,
  VCDInfo,
  VNetworkInfo,
  VCPUInfo,
  VMemoryInfo,
} from '@/types/rvtools';

export interface UsePreflightChecksConfig {
  mode: MigrationMode;
  vms: VirtualMachine[];
  allVms?: VirtualMachine[]; // For powered-off VM checks
  disks: VDiskInfo[];
  snapshots: VSnapshotInfo[];
  tools: VToolsInfo[];
  networks?: VNetworkInfo[];
  cdDrives?: VCDInfo[];
  cpuInfo?: VCPUInfo[];
  memoryInfo?: VMemoryInfo[];
}

export interface UsePreflightChecksReturn {
  counts: PreflightCheckCounts;
  remediationItems: RemediationItem[];
  blockerCount: number;
  warningCount: number;
  hwVersionCounts: { recommended: number; supported: number; outdated: number };
}

/**
 * Check if VM name is RFC 1123 compliant (for ROKS)
 */
function isRFC1123Compliant(name: string): boolean {
  if (!name || name.length > 63) return false;
  const lowerName = name.toLowerCase();
  const rfc1123Pattern = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  return rfc1123Pattern.test(lowerName);
}

/**
 * Check if hostname is valid (for ROKS)
 */
function isValidHostname(hostname: string | null | undefined): boolean {
  const h = hostname?.toLowerCase()?.trim();
  return !!(h && h !== '' && h !== 'localhost' && h !== 'localhost.localdomain' && h !== 'localhost.local');
}

/**
 * Hook for managing migration pre-flight checks
 */
export function usePreflightChecks(config: UsePreflightChecksConfig): UsePreflightChecksReturn {
  const {
    mode,
    vms: poweredOnVMs,
    allVms,
    disks,
    snapshots,
    tools,
    networks = [],
    cdDrives = [],
    cpuInfo = [],
    memoryInfo = [],
  } = config;

  // Calculate all pre-flight check counts
  const { counts, hwVersionCounts } = useMemo(() => {
    const toolsMap = new Map(tools.map(t => [t.vmName, t]));

    // VMware Tools checks
    const vmsWithoutToolsList = poweredOnVMs.filter(vm => {
      const tool = toolsMap.get(vm.vmName);
      return !tool || tool.toolsStatus === 'toolsNotInstalled' || tool.toolsStatus === 'guestToolsNotInstalled';
    }).map(vm => vm.vmName);

    const vmsWithToolsNotRunningList = poweredOnVMs.filter(vm => {
      const tool = toolsMap.get(vm.vmName);
      return tool && (tool.toolsStatus === 'toolsNotRunning' || tool.toolsStatus === 'guestToolsNotRunning');
    }).map(vm => vm.vmName);

    // Snapshot checks
    const vmsWithOldSnapshotsList = [...new Set(
      snapshots.filter(s => s.ageInDays > SNAPSHOT_BLOCKER_AGE_DAYS).map(s => s.vmName)
    )];

    // Storage checks
    const vmsWithRDMList = [...new Set(disks.filter(d => d.raw).map(d => d.vmName))];
    const vmsWithSharedDisksList = [...new Set(disks.filter(d =>
      d.sharingMode && d.sharingMode.toLowerCase() !== 'sharingnone'
    ).map(d => d.vmName))];
    const vmsWithLargeDisksList = [...new Set(
      disks.filter(d => mibToGiB(d.capacityMiB) > 2000).map(d => d.vmName)
    )];

    // Hardware version
    const hwVersionOutdatedList: string[] = [];
    const hwCounts = poweredOnVMs.reduce((acc, vm) => {
      const versionNum = getHardwareVersionNumber(vm.hardwareVersion);
      if (versionNum >= HW_VERSION_RECOMMENDED) {
        acc.recommended++;
      } else if (versionNum >= HW_VERSION_MINIMUM) {
        acc.supported++;
      } else {
        acc.outdated++;
        hwVersionOutdatedList.push(vm.vmName);
      }
      return acc;
    }, { recommended: 0, supported: 0, outdated: 0 });

    const checkCounts: PreflightCheckCounts = {
      vmsWithoutTools: vmsWithoutToolsList.length,
      vmsWithoutToolsList,
      vmsWithToolsNotRunning: vmsWithToolsNotRunningList.length,
      vmsWithToolsNotRunningList,
      vmsWithOldSnapshots: vmsWithOldSnapshotsList.length,
      vmsWithOldSnapshotsList,
      vmsWithRDM: vmsWithRDMList.length,
      vmsWithRDMList,
      vmsWithSharedDisks: vmsWithSharedDisksList.length,
      vmsWithSharedDisksList,
      vmsWithLargeDisks: vmsWithLargeDisksList.length,
      vmsWithLargeDisksList,
      hwVersionOutdated: hwCounts.outdated,
      hwVersionOutdatedList,
    };

    // VSI-specific checks
    if (mode === 'vsi') {
      // Boot disk size check
      const vmsWithLargeBootDiskList = poweredOnVMs.filter(vm => {
        const vmDisks = disks.filter(d => d.vmName === vm.vmName);
        if (vmDisks.length === 0) return false;
        const sortedDisks = [...vmDisks].sort((a, b) => (a.diskKey || 0) - (b.diskKey || 0));
        const bootDisk = sortedDisks[0];
        return bootDisk && mibToGiB(bootDisk.capacityMiB) > VPC_BOOT_DISK_MAX_GB;
      }).map(vm => vm.vmName);
      checkCounts.vmsWithLargeBootDisk = vmsWithLargeBootDiskList.length;
      checkCounts.vmsWithLargeBootDiskList = vmsWithLargeBootDiskList;

      // Too many disks check
      const vmsWithTooManyDisksList = poweredOnVMs.filter(vm => {
        const vmDiskCount = disks.filter(d => d.vmName === vm.vmName).length;
        return vmDiskCount > VPC_MAX_DISKS_PER_VM;
      }).map(vm => vm.vmName);
      checkCounts.vmsWithTooManyDisks = vmsWithTooManyDisksList.length;
      checkCounts.vmsWithTooManyDisksList = vmsWithTooManyDisksList;

      // Large memory checks
      const vmsWithLargeMemoryList = poweredOnVMs.filter(vm => mibToGiB(vm.memory) > 512).map(vm => vm.vmName);
      const vmsWithVeryLargeMemoryList = poweredOnVMs.filter(vm => mibToGiB(vm.memory) > 1024).map(vm => vm.vmName);
      checkCounts.vmsWithLargeMemory = vmsWithLargeMemoryList.length;
      checkCounts.vmsWithLargeMemoryList = vmsWithLargeMemoryList;
      checkCounts.vmsWithVeryLargeMemory = vmsWithVeryLargeMemoryList.length;
      checkCounts.vmsWithVeryLargeMemoryList = vmsWithVeryLargeMemoryList;

      // Unsupported OS check
      const vmsWithUnsupportedOSList = poweredOnVMs.filter(vm => {
        const compat = getVSIOSCompatibility(vm.guestOS);
        return compat.status === 'unsupported';
      }).map(vm => vm.vmName);
      checkCounts.vmsWithUnsupportedOS = vmsWithUnsupportedOSList.length;
      checkCounts.vmsWithUnsupportedOSList = vmsWithUnsupportedOSList;
    }

    // ROKS-specific checks
    if (mode === 'roks') {
      // CD-ROM checks
      const vmsWithCdConnectedList = [...new Set(cdDrives.filter(cd => cd.connected).map(cd => cd.vmName))];
      checkCounts.vmsWithCdConnected = vmsWithCdConnectedList.length;
      checkCounts.vmsWithCdConnectedList = vmsWithCdConnectedList;

      // Legacy NIC checks
      const vmsWithLegacyNICList = [...new Set(
        networks.filter(n => n.adapterType?.toLowerCase().includes('e1000')).map(n => n.vmName)
      )];
      checkCounts.vmsWithLegacyNIC = vmsWithLegacyNICList.length;
      checkCounts.vmsWithLegacyNICList = vmsWithLegacyNICList;

      // CBT check
      const vmsWithoutCBTList = poweredOnVMs.filter(vm => !vm.cbtEnabled).map(vm => vm.vmName);
      checkCounts.vmsWithoutCBT = vmsWithoutCBTList.length;
      checkCounts.vmsWithoutCBTList = vmsWithoutCBTList;

      // VM name RFC 1123 check
      const vmsWithInvalidNamesList = poweredOnVMs.filter(vm => !isRFC1123Compliant(vm.vmName)).map(vm => vm.vmName);
      checkCounts.vmsWithInvalidNames = vmsWithInvalidNamesList.length;
      checkCounts.vmsWithInvalidNamesList = vmsWithInvalidNamesList;

      // CPU hot plug check
      const cpuMap = new Map(cpuInfo.map(c => [c.vmName, c]));
      const vmsWithCPUHotPlugList = poweredOnVMs.filter(vm => cpuMap.get(vm.vmName)?.hotAddEnabled).map(vm => vm.vmName);
      checkCounts.vmsWithCPUHotPlug = vmsWithCPUHotPlugList.length;
      checkCounts.vmsWithCPUHotPlugList = vmsWithCPUHotPlugList;

      // Memory hot plug check
      const memMap = new Map(memoryInfo.map(m => [m.vmName, m]));
      const vmsWithMemoryHotPlugList = poweredOnVMs.filter(vm => memMap.get(vm.vmName)?.hotAddEnabled).map(vm => vm.vmName);
      checkCounts.vmsWithMemoryHotPlug = vmsWithMemoryHotPlugList.length;
      checkCounts.vmsWithMemoryHotPlugList = vmsWithMemoryHotPlugList;

      // Independent disk check
      const vmsWithIndependentDisksList = [...new Set(
        disks.filter(d => d.diskMode?.toLowerCase().includes('independent')).map(d => d.vmName)
      )];
      checkCounts.vmsWithIndependentDisks = vmsWithIndependentDisksList.length;
      checkCounts.vmsWithIndependentDisksList = vmsWithIndependentDisksList;

      // Hostname check
      const vmsWithInvalidHostnameList = poweredOnVMs.filter(vm => !isValidHostname(vm.guestHostname)).map(vm => vm.vmName);
      checkCounts.vmsWithInvalidHostname = vmsWithInvalidHostnameList.length;
      checkCounts.vmsWithInvalidHostnameList = vmsWithInvalidHostnameList;

      // Static IP with powered off check
      const vmsStaticIPPoweredOffList = (allVms || []).filter(vm =>
        vm.powerState === 'poweredOff' && vm.guestIP
      ).map(vm => vm.vmName);
      checkCounts.vmsStaticIPPoweredOff = vmsStaticIPPoweredOffList.length;
      checkCounts.vmsStaticIPPoweredOffList = vmsStaticIPPoweredOffList;
    }

    return { counts: checkCounts, hwVersionCounts: hwCounts };
  }, [mode, poweredOnVMs, allVms, disks, snapshots, tools, networks, cdDrives, cpuInfo, memoryInfo]);

  // Generate remediation items
  const remediationItems = useMemo(
    () => generateRemediationItems(counts, mode),
    [counts, mode]
  );

  // Count blockers and warnings
  const { blockers: blockerCount, warnings: warningCount } = useMemo(
    () => countRemediationSeverity(remediationItems),
    [remediationItems]
  );

  return {
    counts,
    remediationItems,
    blockerCount,
    warningCount,
    hwVersionCounts,
  };
}

export default usePreflightChecks;
