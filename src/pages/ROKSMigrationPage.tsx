// ROKS (OpenShift Virtualization) Migration page
import { useState, useCallback, useMemo } from 'react';
import { Grid, Column, Tile, Tag, Tabs, TabList, Tab, TabPanels, TabPanel, UnorderedList, ListItem, Button, InlineNotification, RadioButtonGroup, RadioButton, Dropdown, NumberInput } from '@carbon/react';
import { Download } from '@carbon/icons-react';
import { Navigate } from 'react-router-dom';
import { useData, useVMs } from '@/hooks';
import { ROUTES, HW_VERSION_MINIMUM, HW_VERSION_RECOMMENDED, SNAPSHOT_WARNING_AGE_DAYS, SNAPSHOT_BLOCKER_AGE_DAYS } from '@/utils/constants';
import { formatNumber, mibToGiB, getHardwareVersionNumber } from '@/utils/formatters';
import { HorizontalBarChart, DoughnutChart } from '@/components/charts';
import { MetricCard, RedHatDocLink, RemediationPanel } from '@/components/common';
import { SizingCalculator } from '@/components/sizing';
import type { SizingResult } from '@/components/sizing';
import { CostEstimation } from '@/components/cost';
import type { RemediationItem } from '@/components/common';
import type { ROKSSizingInput } from '@/services/costEstimation';
import { MTVYAMLGenerator, downloadBlob } from '@/services/export';
import type { MTVExportOptions } from '@/types/mtvYaml';
import osCompatibilityData from '@/data/redhatOSCompatibility.json';
import mtvRequirements from '@/data/mtvRequirements.json';
import './MigrationPage.scss';

// OS Compatibility lookup
function getOSCompatibility(guestOS: string) {
  const osLower = guestOS.toLowerCase();
  for (const entry of osCompatibilityData.osEntries) {
    if (entry.patterns.some(p => osLower.includes(p))) {
      return entry;
    }
  }
  return osCompatibilityData.defaultEntry;
}

export function ROKSMigrationPage() {
  const { rawData } = useData();
  const vms = useVMs();
  const [yamlExporting, setYamlExporting] = useState(false);
  const [yamlExportSuccess, setYamlExportSuccess] = useState(false);
  const [calculatorSizing, setCalculatorSizing] = useState<SizingResult | null>(null);
  const [wavePlanningMode, setWavePlanningMode] = useState<'complexity' | 'network'>('network');
  const [networkGroupBy, setNetworkGroupBy] = useState<'portGroup' | 'portGroupPrefix' | 'ipPrefix'>('portGroup');
  const [ipPrefixLength, setIpPrefixLength] = useState<number>(24);
  const [portGroupPrefixLength, setPortGroupPrefixLength] = useState<number>(20);

  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  const poweredOnVMs = vms.filter(vm => vm.powerState === 'poweredOn');
  const snapshots = rawData.vSnapshot;
  const tools = rawData.vTools;
  const cdDrives = rawData.vCD;
  const disks = rawData.vDisk;
  const vCPU = rawData.vCPU;
  const vMemory = rawData.vMemory;
  const networks = rawData.vNetwork;

  // Create case-insensitive network lookup map for reliable VM matching
  const networksByVMName = useMemo(() => {
    const map = new Map<string, typeof networks>();
    networks.forEach(n => {
      const key = n.vmName.toLowerCase();
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(n);
    });
    return map;
  }, [networks]);

  // ===== PRE-FLIGHT CHECKS =====

  // VMware Tools checks
  const toolsMap = new Map(tools.map(t => [t.vmName, t]));
  const vmsWithoutToolsList = poweredOnVMs.filter(vm => {
    const tool = toolsMap.get(vm.vmName);
    return !tool || tool.toolsStatus === 'toolsNotInstalled' || tool.toolsStatus === 'guestToolsNotInstalled';
  }).map(vm => vm.vmName);
  const vmsWithoutTools = vmsWithoutToolsList.length;

  const vmsWithToolsNotRunningList = poweredOnVMs.filter(vm => {
    const tool = toolsMap.get(vm.vmName);
    return tool && (tool.toolsStatus === 'toolsNotRunning' || tool.toolsStatus === 'guestToolsNotRunning');
  }).map(vm => vm.vmName);
  const vmsWithToolsNotRunning = vmsWithToolsNotRunningList.length;

  const vmsWithOutdatedTools = poweredOnVMs.filter(vm => {
    const tool = toolsMap.get(vm.vmName);
    return tool && tool.toolsStatus === 'toolsOld';
  }).length;

  // Snapshot checks
  const vmsWithSnapshots = new Set(snapshots.map(s => s.vmName)).size;
  const vmsWithOldSnapshotsList = [...new Set(
    snapshots.filter(s => s.ageInDays > SNAPSHOT_BLOCKER_AGE_DAYS).map(s => s.vmName)
  )];
  const vmsWithOldSnapshots = vmsWithOldSnapshotsList.length;
  const vmsWithWarningSnapshots = new Set(
    snapshots.filter(s => s.ageInDays > SNAPSHOT_WARNING_AGE_DAYS && s.ageInDays <= SNAPSHOT_BLOCKER_AGE_DAYS).map(s => s.vmName)
  ).size;

  // CD-ROM checks
  const vmsWithCdConnectedList = [...new Set(cdDrives.filter(cd => cd.connected).map(cd => cd.vmName))];
  const vmsWithCdConnected = vmsWithCdConnectedList.length;

  // Hardware version checks
  const hwVersionOutdatedList: string[] = [];
  const hwVersionCounts = poweredOnVMs.reduce((acc, vm) => {
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

  // Storage checks
  const vmsWithRDMList = [...new Set(disks.filter(d => d.raw).map(d => d.vmName))];
  const vmsWithRDM = vmsWithRDMList.length;

  const vmsWithSharedDisksList = [...new Set(disks.filter(d =>
    d.sharingMode && d.sharingMode.toLowerCase() !== 'sharingnone'
  ).map(d => d.vmName))];
  const vmsWithSharedDisks = vmsWithSharedDisksList.length;

  // Network checks
  const vmsWithLegacyNICList = [...new Set(
    networks.filter(n => n.adapterType?.toLowerCase().includes('e1000')).map(n => n.vmName)
  )];
  const vmsWithLegacyNIC = vmsWithLegacyNICList.length;

  // ===== NRT (Migration Toolkit) CHECKS =====

  // CBT (Changed Block Tracking) check
  const vmsWithoutCBTList = poweredOnVMs.filter(vm => !vm.cbtEnabled).map(vm => vm.vmName);
  const vmsWithoutCBT = vmsWithoutCBTList.length;

  // VM name RFC 1123 compliance check
  const isRFC1123Compliant = (name: string): boolean => {
    if (!name || name.length > 63) return false;
    const lowerName = name.toLowerCase();
    const rfc1123Pattern = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
    return rfc1123Pattern.test(lowerName);
  };
  const vmsWithInvalidNamesList = poweredOnVMs.filter(vm => !isRFC1123Compliant(vm.vmName)).map(vm => vm.vmName);
  const vmsWithInvalidNames = vmsWithInvalidNamesList.length;

  // Hot pluggable CPU/Memory checks
  const vCPUMap = new Map(vCPU.map(c => [c.vmName, c]));
  const vMemoryMap = new Map(vMemory.map(m => [m.vmName, m]));

  const vmsWithCPUHotPlugList = poweredOnVMs.filter(vm => {
    const cpuInfo = vCPUMap.get(vm.vmName);
    return cpuInfo?.hotAddEnabled;
  }).map(vm => vm.vmName);
  const vmsWithCPUHotPlug = vmsWithCPUHotPlugList.length;

  const vmsWithMemoryHotPlugList = poweredOnVMs.filter(vm => {
    const memInfo = vMemoryMap.get(vm.vmName);
    return memInfo?.hotAddEnabled;
  }).map(vm => vm.vmName);
  const vmsWithMemoryHotPlug = vmsWithMemoryHotPlugList.length;

  // Independent disk mode check (BLOCKER)
  const vmsWithIndependentDisksList = [...new Set(
    disks.filter(d => {
      const mode = d.diskMode?.toLowerCase() || '';
      return mode.includes('independent');
    }).map(d => d.vmName)
  )];
  const vmsWithIndependentDisks = vmsWithIndependentDisksList.length;

  // Hostname missing/localhost check
  const vmsWithInvalidHostnameList = poweredOnVMs.filter(vm => {
    const hostname = vm.guestHostname?.toLowerCase()?.trim();
    return !hostname ||
           hostname === '' ||
           hostname === 'localhost' ||
           hostname === 'localhost.localdomain' ||
           hostname === 'localhost.local';
  }).map(vm => vm.vmName);
  const vmsWithInvalidHostname = vmsWithInvalidHostnameList.length;

  // Static IP with powered off VM check
  const vmsStaticIPPoweredOffList = vms.filter(vm =>
    vm.powerState === 'poweredOff' && vm.guestIP
  ).map(vm => vm.vmName);
  const vmsStaticIPPoweredOff = vmsStaticIPPoweredOffList.length;

  // ===== OS COMPATIBILITY =====
  const osCompatibilityResults = poweredOnVMs.map(vm => ({
    vmName: vm.vmName,
    guestOS: vm.guestOS,
    compatibility: getOSCompatibility(vm.guestOS)
  }));

  const osStatusCounts = osCompatibilityResults.reduce((acc, result) => {
    acc[result.compatibility.compatibilityStatus] = (acc[result.compatibility.compatibilityStatus] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const osCompatibilityChartData = [
    { label: 'Fully Supported', value: osStatusCounts['fully-supported'] || 0 },
    { label: 'Supported (Caveats)', value: osStatusCounts['supported-with-caveats'] || 0 },
    { label: 'Unsupported', value: osStatusCounts['unsupported'] || 0 },
  ].filter(d => d.value > 0);

  // ===== READINESS SCORE CALCULATION =====
  const blockerCount = vmsWithoutTools + vmsWithOldSnapshots + vmsWithRDM + vmsWithSharedDisks + vmsWithIndependentDisks;
  const warningCount = vmsWithToolsNotRunning + vmsWithWarningSnapshots + vmsWithCdConnected +
                       hwVersionCounts.outdated + vmsWithLegacyNIC +
                       vmsWithoutCBT + vmsWithInvalidNames + vmsWithCPUHotPlug +
                       vmsWithMemoryHotPlug + vmsWithInvalidHostname;

  // Calculate score
  const totalVMsToCheck = poweredOnVMs.length || 1;
  const blockerPenalty = (blockerCount / totalVMsToCheck) * 50;
  const warningPenalty = (warningCount / totalVMsToCheck) * 30;
  const unsupportedOSPenalty = ((osStatusCounts['unsupported'] || 0) / totalVMsToCheck) * 20;

  const readinessScore = Math.max(0, Math.round(100 - blockerPenalty - warningPenalty - unsupportedOSPenalty));

  // ===== COMPLEXITY DISTRIBUTION =====
  const complexityScores = poweredOnVMs.map(vm => {
    let score = 0;
    const compat = getOSCompatibility(vm.guestOS);
    score += (100 - compat.compatibilityScore) * 0.3;

    const vmNics = networks.filter(n => n.vmName === vm.vmName).length;
    if (vmNics > 3) score += 30;
    else if (vmNics > 1) score += 15;

    const vmDisks = disks.filter(d => d.vmName === vm.vmName).length;
    if (vmDisks > 5) score += 30;
    else if (vmDisks > 2) score += 15;

    const hwVersion = getHardwareVersionNumber(vm.hardwareVersion);
    if (hwVersion < HW_VERSION_MINIMUM) score += 25;
    else if (hwVersion < HW_VERSION_RECOMMENDED) score += 10;

    if (vm.cpus > 16 || mibToGiB(vm.memory) > 128) score += 20;

    return { vmName: vm.vmName, score: Math.min(100, score) };
  });

  const complexityDistribution = complexityScores.reduce((acc, cs) => {
    const category = cs.score <= 25 ? 'Simple' :
                     cs.score <= 50 ? 'Moderate' :
                     cs.score <= 75 ? 'Complex' : 'Blocker';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const complexityChartData = [
    { label: 'Simple (0-25)', value: complexityDistribution['Simple'] || 0 },
    { label: 'Moderate (26-50)', value: complexityDistribution['Moderate'] || 0 },
    { label: 'Complex (51-75)', value: complexityDistribution['Complex'] || 0 },
    { label: 'Blocker (76-100)', value: complexityDistribution['Blocker'] || 0 },
  ].filter(d => d.value > 0);

  const topComplexVMs = [...complexityScores]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(cs => ({
      label: cs.vmName.substring(0, 40),
      value: Math.round(cs.score),
    }));

  // ===== MIGRATION WAVE PLANNING =====

  // Build VM data with network info
  const vmWaveData = poweredOnVMs.map(vm => {
    const complexityData = complexityScores.find(cs => cs.vmName === vm.vmName);
    const osCompat = getOSCompatibility(vm.guestOS);
    const hasBlocker = disks.some(d => d.vmName === vm.vmName && (d.raw || (d.sharingMode && d.sharingMode.toLowerCase() !== 'sharingnone')));
    const hasSnapshot = snapshots.some(s => s.vmName === vm.vmName && s.ageInDays > SNAPSHOT_BLOCKER_AGE_DAYS);
    const toolStatus = toolsMap.get(vm.vmName);
    const noTools = !toolStatus || toolStatus.toolsStatus === 'toolsNotInstalled';

    // Get network info for this VM (case-insensitive lookup)
    const vmNetworks = networksByVMName.get(vm.vmName.toLowerCase()) || [];
    const primaryNetwork = vmNetworks[0];
    const networkName = primaryNetwork?.networkName || 'No Network';
    const ipAddress = primaryNetwork?.ipv4Address || '';

    // Derive subnet from IP (assuming /24 for simplicity)
    const subnet = ipAddress ? ipAddress.split('.').slice(0, 3).join('.') + '.0/24' : 'Unknown';

    return {
      vmName: vm.vmName,
      complexity: complexityData?.score || 0,
      osStatus: osCompat.compatibilityStatus,
      hasBlocker: hasBlocker || hasSnapshot || noTools,
      vcpus: vm.cpus,
      memoryGiB: Math.round(mibToGiB(vm.memory)),
      storageGiB: Math.round(mibToGiB(vm.provisionedMiB)),
      networkName,
      ipAddress,
      subnet,
    };
  });

  // Helper function to calculate IP prefix based on CIDR length
  const getIpPrefix = (ip: string, prefixLength: number): string => {
    if (!ip) return 'Unknown';
    const parts = ip.split('.');
    if (parts.length !== 4) return 'Unknown';

    // Calculate how many octets to keep based on prefix length
    const octetsToKeep = Math.floor(prefixLength / 8);
    const remainingBits = prefixLength % 8;

    const prefix = parts.slice(0, octetsToKeep).map(Number);

    if (remainingBits > 0 && octetsToKeep < 4) {
      // Apply mask to partial octet
      const mask = 256 - Math.pow(2, 8 - remainingBits);
      prefix.push(Number(parts[octetsToKeep]) & mask);
    }

    // Pad with zeros
    while (prefix.length < 4) {
      prefix.push(0);
    }

    return `${prefix.join('.')}/${prefixLength}`;
  };

  // Network-based waves: Group by port group, port group prefix, or IP prefix
  const networkWaves = useMemo(() => {
    const groups = new Map<string, typeof vmWaveData>();

    vmWaveData.forEach(vm => {
      let key: string;

      if (networkGroupBy === 'portGroup') {
        // Group by full VMware port group name
        key = vm.networkName || 'No Network';
      } else if (networkGroupBy === 'portGroupPrefix') {
        // Group by first N characters of port group name
        const name = vm.networkName || 'No Network';
        key = name.length > portGroupPrefixLength ? name.substring(0, portGroupPrefixLength) + '...' : name;
      } else {
        // Group by IP prefix with configurable length
        if (vm.ipAddress) {
          key = getIpPrefix(vm.ipAddress, ipPrefixLength);
        } else {
          key = `No IP: ${vm.networkName}`;
        }
      }

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(vm);
    });

    // Convert to waves, sorted by VM count (smaller first for pilot)
    return Array.from(groups.entries())
      .map(([groupName, vms]) => {
        // Get additional info based on grouping method
        const portGroups = [...new Set(vms.map(v => v.networkName).filter(n => n && n !== 'No Network'))];
        const ipRanges = [...new Set(vms.map(v => v.ipAddress).filter(Boolean))];
        const hasBlockers = vms.some(v => v.hasBlocker);
        const avgComplexity = vms.reduce((sum, v) => sum + v.complexity, 0) / vms.length;

        let description: string;
        if (networkGroupBy === 'portGroup') {
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
      })
      .sort((a, b) => {
        // Sort: groups with blockers last, then by VM count ascending
        if (a.hasBlockers !== b.hasBlockers) return a.hasBlockers ? 1 : -1;
        return a.vmCount - b.vmCount;
      });
  }, [vmWaveData, networkGroupBy, ipPrefixLength, portGroupPrefixLength]);

  // Complexity-based waves (original logic)
  const complexityWaves = useMemo(() => {
    const waves: { name: string; description: string; vms: typeof vmWaveData }[] = [
      { name: 'Wave 1: Pilot', description: 'Simple VMs with fully supported OS for initial validation', vms: [] },
      { name: 'Wave 2: Quick Wins', description: 'Low complexity VMs ready for migration', vms: [] },
      { name: 'Wave 3: Standard', description: 'Moderate complexity VMs', vms: [] },
      { name: 'Wave 4: Complex', description: 'High complexity VMs requiring careful planning', vms: [] },
      { name: 'Wave 5: Remediation', description: 'VMs with blockers requiring fixes before migration', vms: [] },
    ];

    vmWaveData.forEach(vm => {
      if (vm.hasBlocker) {
        waves[4].vms.push(vm);
      } else if (vm.complexity <= 15 && vm.osStatus === 'fully-supported') {
        waves[0].vms.push(vm);
      } else if (vm.complexity <= 30) {
        waves[1].vms.push(vm);
      } else if (vm.complexity <= 55) {
        waves[2].vms.push(vm);
      } else {
        waves[3].vms.push(vm);
      }
    });

    return waves;
  }, [vmWaveData]);

  // Select active waves based on mode
  const waves = wavePlanningMode === 'network'
    ? networkWaves.map((nw, idx) => ({
        name: `Wave ${idx + 1}: ${nw.name.length > 30 ? nw.name.substring(0, 27) + '...' : nw.name}`,
        description: nw.description,
        vms: nw.vms,
      }))
    : complexityWaves;

  const waveChartData = wavePlanningMode === 'network'
    ? networkWaves.slice(0, 15).map((nw, idx) => ({
        label: `Wave ${idx + 1}`,
        value: nw.vmCount,
      })).filter(d => d.value > 0)
    : complexityWaves.map((wave, idx) => ({
        label: `Wave ${idx + 1}`,
        value: wave.vms.length,
      })).filter(d => d.value > 0);

  const waveResources = wavePlanningMode === 'network'
    ? networkWaves.map((nw, idx) => ({
        name: `Wave ${idx + 1}: ${nw.name.length > 25 ? nw.name.substring(0, 22) + '...' : nw.name}`,
        description: nw.description,
        vmCount: nw.vmCount,
        vcpus: nw.vcpus,
        memoryGiB: nw.memoryGiB,
        storageGiB: nw.storageGiB,
        hasBlockers: nw.hasBlockers,
      }))
    : complexityWaves.map(wave => ({
        name: wave.name,
        description: wave.description,
        vmCount: wave.vms.length,
        vcpus: wave.vms.reduce((sum, vm) => sum + vm.vcpus, 0),
        memoryGiB: wave.vms.reduce((sum, vm) => sum + vm.memoryGiB, 0),
        storageGiB: wave.vms.reduce((sum, vm) => sum + vm.storageGiB, 0),
        hasBlockers: wave.name.includes('Remediation'),
      })).filter(w => w.vmCount > 0);

  // ===== REMEDIATION ITEMS =====
  const remediationItems: RemediationItem[] = [];

  if (vmsWithoutTools > 0) {
    remediationItems.push({
      id: 'tools-installed',
      name: mtvRequirements.checks['tools-installed'].name,
      severity: 'blocker',
      description: mtvRequirements.checks['tools-installed'].description,
      remediation: mtvRequirements.checks['tools-installed'].remediation,
      documentationLink: mtvRequirements.checks['tools-installed'].documentationLink,
      affectedCount: vmsWithoutTools,
      affectedVMs: vmsWithoutToolsList,
    });
  }

  if (vmsWithOldSnapshots > 0) {
    remediationItems.push({
      id: 'old-snapshots',
      name: mtvRequirements.checks['old-snapshots'].name,
      severity: 'blocker',
      description: mtvRequirements.checks['old-snapshots'].description,
      remediation: mtvRequirements.checks['old-snapshots'].remediation,
      documentationLink: mtvRequirements.checks['old-snapshots'].documentationLink,
      affectedCount: vmsWithOldSnapshots,
      affectedVMs: vmsWithOldSnapshotsList,
    });
  }

  if (vmsWithRDM > 0) {
    remediationItems.push({
      id: 'no-rdm',
      name: mtvRequirements.checks['no-rdm'].name,
      severity: 'blocker',
      description: mtvRequirements.checks['no-rdm'].description,
      remediation: mtvRequirements.checks['no-rdm'].remediation,
      documentationLink: mtvRequirements.checks['no-rdm'].documentationLink,
      affectedCount: vmsWithRDM,
      affectedVMs: vmsWithRDMList,
    });
  }

  if (vmsWithSharedDisks > 0) {
    remediationItems.push({
      id: 'no-shared-disks',
      name: mtvRequirements.checks['no-shared-disks'].name,
      severity: 'blocker',
      description: mtvRequirements.checks['no-shared-disks'].description,
      remediation: mtvRequirements.checks['no-shared-disks'].remediation,
      documentationLink: mtvRequirements.checks['no-shared-disks'].documentationLink,
      affectedCount: vmsWithSharedDisks,
      affectedVMs: vmsWithSharedDisksList,
    });
  }

  if (vmsWithToolsNotRunning > 0) {
    remediationItems.push({
      id: 'tools-running',
      name: mtvRequirements.checks['tools-running'].name,
      severity: 'warning',
      description: mtvRequirements.checks['tools-running'].description,
      remediation: mtvRequirements.checks['tools-running'].remediation,
      documentationLink: mtvRequirements.checks['tools-running'].documentationLink,
      affectedCount: vmsWithToolsNotRunning,
      affectedVMs: vmsWithToolsNotRunningList,
    });
  }

  if (vmsWithCdConnected > 0) {
    remediationItems.push({
      id: 'cd-disconnected',
      name: mtvRequirements.checks['cd-disconnected'].name,
      severity: 'warning',
      description: mtvRequirements.checks['cd-disconnected'].description,
      remediation: mtvRequirements.checks['cd-disconnected'].remediation,
      documentationLink: mtvRequirements.checks['cd-disconnected'].documentationLink,
      affectedCount: vmsWithCdConnected,
      affectedVMs: vmsWithCdConnectedList,
    });
  }

  if (hwVersionCounts.outdated > 0) {
    remediationItems.push({
      id: 'hw-version',
      name: mtvRequirements.checks['hw-version'].name,
      severity: 'warning',
      description: mtvRequirements.checks['hw-version'].description,
      remediation: mtvRequirements.checks['hw-version'].remediation,
      documentationLink: mtvRequirements.checks['hw-version'].documentationLink,
      affectedCount: hwVersionCounts.outdated,
      affectedVMs: hwVersionOutdatedList,
    });
  }

  if (vmsWithLegacyNIC > 0) {
    remediationItems.push({
      id: 'network-adapter',
      name: mtvRequirements.checks['network-adapter'].name,
      severity: 'info',
      description: mtvRequirements.checks['network-adapter'].description,
      remediation: mtvRequirements.checks['network-adapter'].remediation,
      documentationLink: mtvRequirements.checks['network-adapter'].documentationLink,
      affectedCount: vmsWithLegacyNIC,
      affectedVMs: vmsWithLegacyNICList,
    });
  }

  if (vmsWithIndependentDisks > 0) {
    remediationItems.push({
      id: 'independent-disk',
      name: mtvRequirements.checks['independent-disk'].name,
      severity: 'blocker',
      description: mtvRequirements.checks['independent-disk'].description,
      remediation: mtvRequirements.checks['independent-disk'].remediation,
      documentationLink: mtvRequirements.checks['independent-disk'].documentationLink,
      affectedCount: vmsWithIndependentDisks,
      affectedVMs: vmsWithIndependentDisksList,
    });
  }

  if (vmsWithoutCBT > 0) {
    remediationItems.push({
      id: 'cbt-enabled',
      name: mtvRequirements.checks['cbt-enabled'].name,
      severity: 'warning',
      description: mtvRequirements.checks['cbt-enabled'].description,
      remediation: mtvRequirements.checks['cbt-enabled'].remediation,
      documentationLink: mtvRequirements.checks['cbt-enabled'].documentationLink,
      affectedCount: vmsWithoutCBT,
      affectedVMs: vmsWithoutCBTList,
    });
  }

  if (vmsWithInvalidNames > 0) {
    remediationItems.push({
      id: 'vm-name-rfc1123',
      name: mtvRequirements.checks['vm-name-rfc1123'].name,
      severity: 'warning',
      description: mtvRequirements.checks['vm-name-rfc1123'].description,
      remediation: mtvRequirements.checks['vm-name-rfc1123'].remediation,
      documentationLink: mtvRequirements.checks['vm-name-rfc1123'].documentationLink,
      affectedCount: vmsWithInvalidNames,
      affectedVMs: vmsWithInvalidNamesList,
    });
  }

  if (vmsWithCPUHotPlug > 0) {
    remediationItems.push({
      id: 'cpu-hot-plug',
      name: mtvRequirements.checks['cpu-hot-plug'].name,
      severity: 'warning',
      description: mtvRequirements.checks['cpu-hot-plug'].description,
      remediation: mtvRequirements.checks['cpu-hot-plug'].remediation,
      documentationLink: mtvRequirements.checks['cpu-hot-plug'].documentationLink,
      affectedCount: vmsWithCPUHotPlug,
      affectedVMs: vmsWithCPUHotPlugList,
    });
  }

  if (vmsWithMemoryHotPlug > 0) {
    remediationItems.push({
      id: 'memory-hot-plug',
      name: mtvRequirements.checks['memory-hot-plug'].name,
      severity: 'warning',
      description: mtvRequirements.checks['memory-hot-plug'].description,
      remediation: mtvRequirements.checks['memory-hot-plug'].remediation,
      documentationLink: mtvRequirements.checks['memory-hot-plug'].documentationLink,
      affectedCount: vmsWithMemoryHotPlug,
      affectedVMs: vmsWithMemoryHotPlugList,
    });
  }

  if (vmsWithInvalidHostname > 0) {
    remediationItems.push({
      id: 'hostname-missing',
      name: mtvRequirements.checks['hostname-missing'].name,
      severity: 'warning',
      description: mtvRequirements.checks['hostname-missing'].description,
      remediation: mtvRequirements.checks['hostname-missing'].remediation,
      documentationLink: mtvRequirements.checks['hostname-missing'].documentationLink,
      affectedCount: vmsWithInvalidHostname,
      affectedVMs: vmsWithInvalidHostnameList,
    });
  }

  if (vmsStaticIPPoweredOff > 0) {
    remediationItems.push({
      id: 'static-ip-powered-off',
      name: mtvRequirements.checks['static-ip-powered-off'].name,
      severity: 'warning',
      description: mtvRequirements.checks['static-ip-powered-off'].description,
      remediation: mtvRequirements.checks['static-ip-powered-off'].remediation,
      documentationLink: mtvRequirements.checks['static-ip-powered-off'].documentationLink,
      affectedCount: vmsStaticIPPoweredOff,
      affectedVMs: vmsStaticIPPoweredOffList,
    });
  }

  // ===== MTV YAML EXPORT =====
  const handleYAMLExport = useCallback(async () => {
    setYamlExporting(true);
    setYamlExportSuccess(false);

    try {
      const exportOptions: MTVExportOptions = {
        namespace: 'openshift-mtv',
        sourceProviderName: 'vmware-source',
        destinationProviderName: 'host',
        networkMapName: 'vmware-network-map',
        storageMapName: 'vmware-storage-map',
        defaultStorageClass: 'ocs-storagecluster-ceph-rbd',
        targetNamespace: 'migrated-vms',
        warm: false,
        preserveStaticIPs: false,
      };

      const generator = new MTVYAMLGenerator(exportOptions);

      const waveExportData = waves
        .filter(w => w.vms.length > 0)
        .map(wave => ({
          name: wave.name.replace(/Wave \d+: /, '').toLowerCase(),
          vms: wave.vms.map(vmData => {
            const fullVm = poweredOnVMs.find(v => v.vmName === vmData.vmName);
            return fullVm!;
          }).filter(Boolean),
        }));

      const blob = await generator.generateBundle(
        waveExportData,
        networks,
        rawData.vDatastore
      );

      downloadBlob(blob, `mtv-migration-plan-${new Date().toISOString().split('T')[0]}.zip`);
      setYamlExportSuccess(true);
    } catch (error) {
      console.error('YAML export failed:', error);
    } finally {
      setYamlExporting(false);
    }
  }, [waves, poweredOnVMs, networks, rawData.vDatastore]);

  // ===== COST ESTIMATION SIZING =====
  // Use calculator sizing if available, otherwise calculate defaults
  const roksSizing = useMemo<ROKSSizingInput>(() => {
    // If we have sizing from the calculator, use it
    if (calculatorSizing) {
      return {
        computeNodes: calculatorSizing.computeNodes,
        computeProfile: calculatorSizing.computeProfile,
        useNvme: calculatorSizing.useNvme,
        storageTiB: calculatorSizing.storageTiB,
      };
    }

    // Otherwise calculate default sizing
    const totalStorageGiB = poweredOnVMs.reduce((sum, vm) => sum + mibToGiB(vm.provisionedMiB), 0);

    return {
      computeNodes: 3, // Minimum for ODF
      computeProfile: 'mx2d.metal.96x768',
      useNvme: true,
      storageTiB: Math.ceil(totalStorageGiB / 1024),
    };
  }, [calculatorSizing, poweredOnVMs]);

  return (
    <div className="migration-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="migration-page__title">ROKS Migration</h1>
          <p className="migration-page__subtitle">
            OpenShift Virtualization on IBM Cloud ROKS with MTV migration workflow
          </p>
        </Column>

        {/* Readiness Score */}
        <Column lg={4} md={4} sm={4}>
          <Tile className="migration-page__score-tile">
            <span className="migration-page__score-label">Readiness Score</span>
            <span className={`migration-page__score-value migration-page__score-value--${
              readinessScore >= 80 ? 'good' : readinessScore >= 60 ? 'warning' : 'critical'
            }`}>
              {readinessScore}%
            </span>
            <span className="migration-page__score-detail">
              {blockerCount > 0
                ? `${blockerCount} blocker${blockerCount !== 1 ? 's' : ''} found`
                : readinessScore >= 80
                  ? 'Ready for migration'
                  : 'Preparation needed'}
            </span>
          </Tile>
        </Column>

        {/* Quick Stats */}
        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="VMs to Migrate"
            value={formatNumber(poweredOnVMs.length)}
            variant="primary"
          />
        </Column>
        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Blockers"
            value={formatNumber(blockerCount)}
            variant={blockerCount > 0 ? 'error' : 'success'}
          />
        </Column>
        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Warnings"
            value={formatNumber(warningCount)}
            variant={warningCount > 0 ? 'warning' : 'success'}
          />
        </Column>

        {/* Tabs */}
        <Column lg={16} md={8} sm={4}>
          <Tabs>
            <TabList aria-label="ROKS migration tabs">
              <Tab>Pre-Flight Checks</Tab>
              <Tab>Sizing</Tab>
              <Tab>Cost Estimation</Tab>
              <Tab>Wave Planning</Tab>
              <Tab>OS Compatibility</Tab>
              <Tab>Complexity</Tab>
              <Tab>MTV Workflow</Tab>
            </TabList>
            <TabPanels>
              {/* Pre-Flight Checks Panel */}
              <TabPanel>
                <Grid className="migration-page__tab-content">
                  <Column lg={8} md={8} sm={4}>
                    <Tile className="migration-page__checks-tile">
                      <h3>VMware Tools Status</h3>
                      <div className="migration-page__check-items">
                        <div className="migration-page__check-item">
                          <span>Tools Not Installed</span>
                          <Tag type={vmsWithoutTools === 0 ? 'green' : 'red'}>
                            {formatNumber(vmsWithoutTools)}
                          </Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Tools Not Running</span>
                          <Tag type={vmsWithToolsNotRunning === 0 ? 'green' : 'magenta'}>
                            {formatNumber(vmsWithToolsNotRunning)}
                          </Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Tools Outdated</span>
                          <Tag type={vmsWithOutdatedTools === 0 ? 'green' : 'teal'}>
                            {formatNumber(vmsWithOutdatedTools)}
                          </Tag>
                        </div>
                      </div>
                    </Tile>
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="migration-page__checks-tile">
                      <h3>Snapshot Status</h3>
                      <div className="migration-page__check-items">
                        <div className="migration-page__check-item">
                          <span>VMs with Any Snapshots</span>
                          <Tag type={vmsWithSnapshots === 0 ? 'green' : 'teal'}>
                            {formatNumber(vmsWithSnapshots)}
                          </Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Old Snapshots (&gt;{SNAPSHOT_BLOCKER_AGE_DAYS} days)</span>
                          <Tag type={vmsWithOldSnapshots === 0 ? 'green' : 'red'}>
                            {formatNumber(vmsWithOldSnapshots)}
                          </Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Warning Snapshots ({SNAPSHOT_WARNING_AGE_DAYS}-{SNAPSHOT_BLOCKER_AGE_DAYS} days)</span>
                          <Tag type={vmsWithWarningSnapshots === 0 ? 'green' : 'magenta'}>
                            {formatNumber(vmsWithWarningSnapshots)}
                          </Tag>
                        </div>
                      </div>
                    </Tile>
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="migration-page__checks-tile">
                      <h3>Storage Configuration</h3>
                      <div className="migration-page__check-items">
                        <div className="migration-page__check-item">
                          <span>VMs with RDM Disks</span>
                          <Tag type={vmsWithRDM === 0 ? 'green' : 'red'}>
                            {formatNumber(vmsWithRDM)}
                          </Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>VMs with Shared Disks</span>
                          <Tag type={vmsWithSharedDisks === 0 ? 'green' : 'red'}>
                            {formatNumber(vmsWithSharedDisks)}
                          </Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>CD-ROM Connected</span>
                          <Tag type={vmsWithCdConnected === 0 ? 'green' : 'magenta'}>
                            {formatNumber(vmsWithCdConnected)}
                          </Tag>
                        </div>
                      </div>
                    </Tile>
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="migration-page__checks-tile">
                      <h3>Hardware Compatibility</h3>
                      <div className="migration-page__check-items">
                        <div className="migration-page__check-item">
                          <span>HW v{HW_VERSION_RECOMMENDED}+ (Recommended)</span>
                          <Tag type="green">{formatNumber(hwVersionCounts.recommended)}</Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>HW v{HW_VERSION_MINIMUM}-{HW_VERSION_RECOMMENDED - 1} (Supported)</span>
                          <Tag type="teal">{formatNumber(hwVersionCounts.supported)}</Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>&lt;HW v{HW_VERSION_MINIMUM} (Upgrade Required)</span>
                          <Tag type={hwVersionCounts.outdated === 0 ? 'green' : 'red'}>
                            {formatNumber(hwVersionCounts.outdated)}
                          </Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Legacy NICs (E1000)</span>
                          <Tag type={vmsWithLegacyNIC === 0 ? 'green' : 'teal'}>
                            {formatNumber(vmsWithLegacyNIC)}
                          </Tag>
                        </div>
                      </div>
                    </Tile>
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="migration-page__checks-tile">
                      <h3>Warm Migration Requirements</h3>
                      <div className="migration-page__check-items">
                        <div className="migration-page__check-item">
                          <span>CBT Not Enabled</span>
                          <Tag type={vmsWithoutCBT === 0 ? 'green' : 'magenta'}>
                            {formatNumber(vmsWithoutCBT)}
                          </Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Independent Disks (Blocker)</span>
                          <Tag type={vmsWithIndependentDisks === 0 ? 'green' : 'red'}>
                            {formatNumber(vmsWithIndependentDisks)}
                          </Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Static IP + Powered Off</span>
                          <Tag type={vmsStaticIPPoweredOff === 0 ? 'green' : 'magenta'}>
                            {formatNumber(vmsStaticIPPoweredOff)}
                          </Tag>
                        </div>
                      </div>
                    </Tile>
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="migration-page__checks-tile">
                      <h3>VM Configuration</h3>
                      <div className="migration-page__check-items">
                        <div className="migration-page__check-item">
                          <span>Name Not RFC 1123</span>
                          <Tag type={vmsWithInvalidNames === 0 ? 'green' : 'magenta'}>
                            {formatNumber(vmsWithInvalidNames)}
                          </Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>CPU Hot Plug Enabled</span>
                          <Tag type={vmsWithCPUHotPlug === 0 ? 'green' : 'teal'}>
                            {formatNumber(vmsWithCPUHotPlug)}
                          </Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Memory Hot Plug Enabled</span>
                          <Tag type={vmsWithMemoryHotPlug === 0 ? 'green' : 'teal'}>
                            {formatNumber(vmsWithMemoryHotPlug)}
                          </Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Hostname Missing/Invalid</span>
                          <Tag type={vmsWithInvalidHostname === 0 ? 'green' : 'magenta'}>
                            {formatNumber(vmsWithInvalidHostname)}
                          </Tag>
                        </div>
                      </div>
                    </Tile>
                  </Column>

                  {/* Remediation Panel */}
                  {remediationItems.length > 0 && (
                    <Column lg={16} md={8} sm={4}>
                      <RemediationPanel
                        items={remediationItems}
                        title="Remediation Required"
                        showAffectedVMs={true}
                      />
                    </Column>
                  )}
                </Grid>
              </TabPanel>

              {/* Sizing Panel */}
              <TabPanel>
                <Grid className="migration-page__tab-content">
                  <Column lg={16} md={8} sm={4}>
                    <Tile className="migration-page__sizing-header">
                      <h3>ROKS Bare Metal Cluster Sizing</h3>
                      <p>
                        Interactive sizing calculator for OpenShift Virtualization with ODF storage on NVMe drives.
                        Adjust the parameters below to see how they affect node requirements.
                      </p>
                    </Tile>
                  </Column>

                  <Column lg={16} md={8} sm={4}>
                    <SizingCalculator onSizingChange={setCalculatorSizing} />
                  </Column>

                  <Column lg={16} md={8} sm={4}>
                    <Tile className="migration-page__cost-tile">
                      <h4>Important Notes</h4>
                      <p className="migration-page__cost-description">
                        • OpenShift Virtualization requires bare metal worker nodes with hardware virtualization (Intel VT-x/AMD-V)<br />
                        • Hyperthreading efficiency typically provides 20-30% boost (1.25× multiplier for mixed workloads)<br />
                        • Memory overcommitment is NOT recommended for VMs - total memory becomes the leading sizing factor<br />
                        • CPU overcommitment ratio of 1.8:1 is the Red Hat conservative recommendation (max 10:1)<br />
                        • ODF with 3-way replication provides data protection; 75% operational capacity ensures room for rebalancing<br />
                        • N+2 redundancy ensures cluster availability during maintenance and unexpected failures
                      </p>
                      <RedHatDocLink
                        href="https://cloud.ibm.com/kubernetes/catalog/create?platformType=openshift"
                        label="Open IBM Cloud ROKS Catalog"
                        description="Configure and estimate costs for your bare metal OpenShift cluster"
                      />
                    </Tile>
                  </Column>
                </Grid>
              </TabPanel>

              {/* Cost Estimation Panel */}
              <TabPanel>
                <Grid className="migration-page__tab-content">
                  <Column lg={16} md={8} sm={4}>
                    <CostEstimation
                      type="roks"
                      roksSizing={roksSizing}
                      title="ROKS Cluster Cost Estimation"
                    />
                  </Column>

                  <Column lg={16} md={8} sm={4}>
                    <Tile className="migration-page__cost-tile">
                      <h4>Cost Estimation Notes</h4>
                      <p className="migration-page__cost-description">
                        • Based on {roksSizing.computeNodes} {roksSizing.computeProfile} bare metal nodes with local NVMe storage<br />
                        • NVMe storage is included with the bare metal nodes - no separate block storage charges<br />
                        • Select different regions and discount options to see pricing variations<br />
                        • 1-year reserved capacity provides 20% discount, 3-year provides 35% discount<br />
                        • Contact IBM for enterprise volume discounts on larger deployments
                      </p>
                      <RedHatDocLink
                        href="https://cloud.ibm.com/estimator"
                        label="Open IBM Cloud Cost Estimator"
                        description="Create a detailed cost estimate with all services"
                      />
                    </Tile>
                  </Column>
                </Grid>
              </TabPanel>

              {/* Wave Planning Panel */}
              <TabPanel>
                <Grid className="migration-page__tab-content">
                  <Column lg={16} md={8} sm={4}>
                    <Tile className="migration-page__sizing-header">
                      <div className="migration-page__wave-header">
                        <div>
                          <h3>Migration Wave Planning</h3>
                          <p>
                            {wavePlanningMode === 'network'
                              ? `${networkWaves.length} ${networkGroupBy === 'ipPrefix' ? 'IP subnets' : 'port groups'} for network-based migration with cutover`
                              : `VMs organized into ${waveResources.length} waves based on complexity and readiness`
                            }
                          </p>
                        </div>
                        <RadioButtonGroup
                          legendText="Wave Planning Mode"
                          name="wave-mode"
                          valueSelected={wavePlanningMode}
                          onChange={(value) => setWavePlanningMode(value as 'complexity' | 'network')}
                          orientation="horizontal"
                        >
                          <RadioButton
                            id="wave-network"
                            value="network"
                            labelText="Network-based"
                          />
                          <RadioButton
                            id="wave-complexity"
                            value="complexity"
                            labelText="Complexity-based"
                          />
                        </RadioButtonGroup>
                      </div>
                      {wavePlanningMode === 'network' && (
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                          <Dropdown
                            id="network-group-by"
                            titleText="Group VMs by"
                            label="Select grouping method"
                            items={['portGroup', 'portGroupPrefix', 'ipPrefix']}
                            itemToString={(item) => item === 'portGroup' ? 'Port Group (exact name match)'
                              : item === 'portGroupPrefix' ? 'Port Group Prefix (first N characters)'
                              : item === 'ipPrefix' ? 'IP Prefix (subnet based on IP address)' : ''}
                            selectedItem={networkGroupBy}
                            onChange={({ selectedItem }) => selectedItem && setNetworkGroupBy(selectedItem as 'portGroup' | 'portGroupPrefix' | 'ipPrefix')}
                            style={{ minWidth: '300px' }}
                          />
                          {networkGroupBy === 'portGroupPrefix' && (
                            <NumberInput
                              id="port-group-prefix-length"
                              label="Prefix Characters"
                              helperText="Match first N characters of port group name"
                              min={5}
                              max={50}
                              step={1}
                              value={portGroupPrefixLength}
                              onChange={(_e, { value }) => value && setPortGroupPrefixLength(Number(value))}
                              style={{ minWidth: '180px' }}
                            />
                          )}
                          {networkGroupBy === 'ipPrefix' && (
                            <NumberInput
                              id="ip-prefix-length"
                              label="CIDR Prefix Length"
                              helperText="e.g., /24 = 256 IPs, /16 = 65,536 IPs"
                              min={8}
                              max={30}
                              step={1}
                              value={ipPrefixLength}
                              onChange={(_e, { value }) => value && setIpPrefixLength(Number(value))}
                              style={{ minWidth: '180px' }}
                            />
                          )}
                        </div>
                      )}
                    </Tile>
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="migration-page__chart-tile">
                      <HorizontalBarChart
                        title={wavePlanningMode === 'network'
                          ? (networkGroupBy === 'ipPrefix' ? 'VMs by IP Subnet' : 'VMs by Port Group')
                          : 'VMs by Wave'}
                        subtitle={wavePlanningMode === 'network'
                          ? `Top ${Math.min(15, networkWaves.length)} of ${networkWaves.length} ${networkGroupBy === 'ipPrefix' ? 'subnets' : 'groups'}`
                          : 'Distribution across migration waves'
                        }
                        data={waveChartData}
                        height={280}
                        valueLabel="VMs"
                        formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
                      />
                    </Tile>
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="migration-page__checks-tile">
                      <h3>{wavePlanningMode === 'network' ? (networkGroupBy === 'ipPrefix' ? 'IP Subnets' : 'Port Groups') : 'Wave Descriptions'}</h3>
                      <div className="migration-page__check-items">
                        {waveResources.slice(0, 10).map((wave, idx) => (
                          <div key={idx} className="migration-page__check-item">
                            <span title={wave.description}>{wave.name}</span>
                            <Tag type={wave.hasBlockers ? 'red' : 'blue'}>
                              {formatNumber(wave.vmCount)}
                            </Tag>
                          </div>
                        ))}
                        {waveResources.length > 10 && (
                          <div className="migration-page__check-item">
                            <span>... and {waveResources.length - 10} more</span>
                          </div>
                        )}
                      </div>
                    </Tile>
                  </Column>

                  {waveResources.slice(0, 20).map((wave, idx) => (
                    <Column key={idx} lg={8} md={8} sm={4}>
                      <Tile className={`migration-page__wave-tile ${wave.hasBlockers ? 'migration-page__wave-tile--warning' : ''}`}>
                        <h4>{wave.name}</h4>
                        {wave.description && (
                          <p className="migration-page__wave-description">{wave.description}</p>
                        )}
                        <div className="migration-page__wave-stats">
                          <div className="migration-page__wave-stat">
                            <span className="migration-page__wave-stat-label">VMs</span>
                            <span className="migration-page__wave-stat-value">{formatNumber(wave.vmCount)}</span>
                          </div>
                          <div className="migration-page__wave-stat">
                            <span className="migration-page__wave-stat-label">vCPUs</span>
                            <span className="migration-page__wave-stat-value">{formatNumber(wave.vcpus)}</span>
                          </div>
                          <div className="migration-page__wave-stat">
                            <span className="migration-page__wave-stat-label">Memory</span>
                            <span className="migration-page__wave-stat-value">{formatNumber(wave.memoryGiB)} GiB</span>
                          </div>
                          <div className="migration-page__wave-stat">
                            <span className="migration-page__wave-stat-label">Storage</span>
                            <span className="migration-page__wave-stat-value">{formatNumber(Math.round(wave.storageGiB / 1024))} TiB</span>
                          </div>
                        </div>
                      </Tile>
                    </Column>
                  ))}
                </Grid>
              </TabPanel>

              {/* OS Compatibility Panel */}
              <TabPanel>
                <Grid className="migration-page__tab-content">
                  <Column lg={8} md={8} sm={4}>
                    <Tile className="migration-page__chart-tile">
                      <DoughnutChart
                        title="OS Compatibility Distribution"
                        subtitle="Red Hat validated compatibility status"
                        data={osCompatibilityChartData}
                        height={280}
                        colors={['#24a148', '#f1c21b', '#da1e28']}
                        formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
                      />
                    </Tile>
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="migration-page__checks-tile">
                      <h3>Compatibility Summary</h3>
                      <div className="migration-page__check-items">
                        <div className="migration-page__check-item">
                          <span>Fully Supported</span>
                          <Tag type="green">{formatNumber(osStatusCounts['fully-supported'] || 0)}</Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Supported with Caveats</span>
                          <Tag type="magenta">{formatNumber(osStatusCounts['supported-with-caveats'] || 0)}</Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Unsupported / EOL</span>
                          <Tag type="red">{formatNumber(osStatusCounts['unsupported'] || 0)}</Tag>
                        </div>
                      </div>
                      <p className="migration-page__os-note">
                        Based on Red Hat OpenShift Virtualization compatibility matrix
                      </p>
                    </Tile>
                  </Column>
                </Grid>
              </TabPanel>

              {/* Complexity Panel */}
              <TabPanel>
                <Grid className="migration-page__tab-content">
                  <Column lg={8} md={8} sm={4}>
                    <Tile className="migration-page__chart-tile">
                      <DoughnutChart
                        title="Migration Complexity"
                        subtitle="Based on OS, network, storage, and hardware"
                        data={complexityChartData}
                        height={280}
                        colors={['#24a148', '#1192e8', '#ff832b', '#da1e28']}
                        formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
                      />
                    </Tile>
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="migration-page__chart-tile">
                      <HorizontalBarChart
                        title="Top 10 Most Complex VMs"
                        subtitle="Highest complexity scores"
                        data={topComplexVMs}
                        height={280}
                        valueLabel="Score"
                        formatValue={(v) => `Score: ${v}`}
                      />
                    </Tile>
                  </Column>
                </Grid>
              </TabPanel>

              {/* MTV Workflow Panel */}
              <TabPanel>
                <Grid className="migration-page__tab-content">
                  <Column lg={16} md={8} sm={4}>
                    <Tile className="migration-page__workflow-header">
                      <div className="migration-page__workflow-header-content">
                        <div>
                          <h3>Migration Toolkit for Virtualization (MTV) Workflow</h3>
                          <p>Follow these four phases for a successful migration to OpenShift Virtualization</p>
                        </div>
                        <Button
                          kind="primary"
                          size="md"
                          renderIcon={Download}
                          onClick={handleYAMLExport}
                          disabled={yamlExporting || poweredOnVMs.length === 0}
                        >
                          {yamlExporting ? 'Generating...' : 'Export MTV YAML'}
                        </Button>
                      </div>
                      {yamlExportSuccess && (
                        <InlineNotification
                          kind="success"
                          title="Export complete"
                          subtitle="MTV YAML templates downloaded. Review and customize before applying to your cluster."
                          lowContrast
                          hideCloseButton
                          style={{ marginTop: '1rem' }}
                        />
                      )}
                      <div className="migration-page__workflow-docs">
                        <RedHatDocLink
                          href="https://docs.openshift.com/container-platform/latest/virt/virtual_machines/importing_vms/virt-importing-vmware-vm.html"
                          label="Official MTV Documentation"
                          description="Complete guide to importing VMware VMs to OpenShift Virtualization"
                        />
                      </div>
                    </Tile>
                  </Column>

                  {mtvRequirements.workflowPhases.map((phase) => (
                    <Column key={phase.phase} lg={8} md={8} sm={4}>
                      <Tile className={`migration-page__phase-tile migration-page__phase-tile--phase-${phase.phase}`}>
                        <div className="migration-page__phase-header">
                          <span className="migration-page__phase-number">Phase {phase.phase}</span>
                          <h4 className="migration-page__phase-name">{phase.name}</h4>
                        </div>
                        <p className="migration-page__phase-description">{phase.description}</p>
                        <div className="migration-page__phase-activities">
                          <h5>Activities</h5>
                          <UnorderedList>
                            {phase.activities.map((activity, idx) => (
                              <ListItem key={idx}>{activity}</ListItem>
                            ))}
                          </UnorderedList>
                        </div>
                      </Tile>
                    </Column>
                  ))}

                  <Column lg={16} md={8} sm={4}>
                    <Tile className="migration-page__workflow-resources">
                      <h4>Additional Resources</h4>
                      <div className="migration-page__resource-links">
                        <RedHatDocLink
                          href="https://github.com/RedHatQuickCourses/architect-the-ocpvirt"
                          label="Architecture Course"
                          description="Red Hat Quick Course - Architect OpenShift Virtualization"
                        />
                        <RedHatDocLink
                          href="https://github.com/RedHatQuickCourses/ocpvirt-migration"
                          label="Migration Course"
                          description="Red Hat Quick Course - OpenShift Virtualization Migration"
                        />
                        <RedHatDocLink
                          href="https://access.redhat.com/articles/973163"
                          label="RHEL Life Cycle"
                          description="Red Hat Enterprise Linux Life Cycle dates"
                        />
                      </div>
                    </Tile>
                  </Column>
                </Grid>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Column>
      </Grid>
    </div>
  );
}
