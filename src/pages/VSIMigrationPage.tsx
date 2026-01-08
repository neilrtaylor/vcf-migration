// VSI (IBM Cloud VPC Virtual Server) Migration page
import { useState, useMemo } from 'react';
import { Grid, Column, Tile, Tag, Tabs, TabList, Tab, TabPanels, TabPanel, RadioButtonGroup, RadioButton, Dropdown, NumberInput } from '@carbon/react';
import { Navigate } from 'react-router-dom';
import { useData, useVMs } from '@/hooks';
import { ROUTES, HW_VERSION_MINIMUM, HW_VERSION_RECOMMENDED, SNAPSHOT_WARNING_AGE_DAYS, SNAPSHOT_BLOCKER_AGE_DAYS } from '@/utils/constants';
import { formatNumber, mibToGiB, getHardwareVersionNumber } from '@/utils/formatters';
import { HorizontalBarChart, DoughnutChart } from '@/components/charts';
import { MetricCard, RedHatDocLink, RemediationPanel } from '@/components/common';
import { CostEstimation } from '@/components/cost';
import type { RemediationItem } from '@/components/common';
import type { VSISizingInput } from '@/services/costEstimation';
import ibmCloudProfiles from '@/data/ibmCloudProfiles.json';
import mtvRequirements from '@/data/mtvRequirements.json';
import './MigrationPage.scss';

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

function getIBMCloudOSSupport(guestOS: string) {
  const osLower = guestOS.toLowerCase();
  for (const [pattern, support] of Object.entries(ibmCloudOSSupport)) {
    if (osLower.includes(pattern)) {
      return support;
    }
  }
  return { status: 'unsupported' as const, notes: 'Not validated for IBM Cloud VPC' };
}

export function VSIMigrationPage() {
  const { rawData } = useData();
  const vms = useVMs();

  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  // Wave planning mode: 'complexity' for traditional complexity-based waves, 'network' for subnet-based waves
  const [wavePlanningMode, setWavePlanningMode] = useState<'complexity' | 'network'>('network');
  const [networkGroupBy, setNetworkGroupBy] = useState<'portGroup' | 'ipPrefix'>('portGroup');
  const [ipPrefixLength, setIpPrefixLength] = useState<number>(24);

  const poweredOnVMs = vms.filter(vm => vm.powerState === 'poweredOn');
  const snapshots = rawData.vSnapshot;
  const tools = rawData.vTools;
  const disks = rawData.vDisk;
  const networks = rawData.vNetwork;

  // ===== PRE-FLIGHT CHECKS =====

  // VMware Tools checks (needed for clean export)
  const toolsMap = new Map(tools.map(t => [t.vmName, t]));
  const vmsWithoutTools = poweredOnVMs.filter(vm => {
    const tool = toolsMap.get(vm.vmName);
    return !tool || tool.toolsStatus === 'toolsNotInstalled' || tool.toolsStatus === 'guestToolsNotInstalled';
  }).length;
  const vmsWithToolsNotRunning = poweredOnVMs.filter(vm => {
    const tool = toolsMap.get(vm.vmName);
    return tool && (tool.toolsStatus === 'toolsNotRunning' || tool.toolsStatus === 'guestToolsNotRunning');
  }).length;

  // Snapshot checks
  const vmsWithSnapshots = new Set(snapshots.map(s => s.vmName)).size;
  const vmsWithOldSnapshots = new Set(
    snapshots.filter(s => s.ageInDays > SNAPSHOT_BLOCKER_AGE_DAYS).map(s => s.vmName)
  ).size;
  const vmsWithWarningSnapshots = new Set(
    snapshots.filter(s => s.ageInDays > SNAPSHOT_WARNING_AGE_DAYS && s.ageInDays <= SNAPSHOT_BLOCKER_AGE_DAYS).map(s => s.vmName)
  ).size;

  // Hardware version checks
  const hwVersionCounts = poweredOnVMs.reduce((acc, vm) => {
    const versionNum = getHardwareVersionNumber(vm.hardwareVersion);
    if (versionNum >= HW_VERSION_RECOMMENDED) {
      acc.recommended++;
    } else if (versionNum >= HW_VERSION_MINIMUM) {
      acc.supported++;
    } else {
      acc.outdated++;
    }
    return acc;
  }, { recommended: 0, supported: 0, outdated: 0 });

  // Storage checks - RDM not supported in VPC
  const vmsWithRDM = new Set(disks.filter(d => d.raw).map(d => d.vmName)).size;
  const vmsWithSharedDisks = new Set(disks.filter(d =>
    d.sharingMode && d.sharingMode.toLowerCase() !== 'sharingnone'
  ).map(d => d.vmName)).size;

  // Large disk check - VPC has limits
  const vmsWithLargeDisks = new Set(
    disks.filter(d => mibToGiB(d.capacityMiB) > 2000).map(d => d.vmName)
  ).size;

  // Large memory check - VPC profile limits
  const vmsWithLargeMemory = poweredOnVMs.filter(vm => mibToGiB(vm.memory) > 512).length;
  const vmsWithVeryLargeMemory = poweredOnVMs.filter(vm => mibToGiB(vm.memory) > 1024).length;

  // ===== OS COMPATIBILITY =====
  const osCompatibilityResults = poweredOnVMs.map(vm => ({
    vmName: vm.vmName,
    guestOS: vm.guestOS,
    compatibility: getIBMCloudOSSupport(vm.guestOS)
  }));

  const osStatusCounts = osCompatibilityResults.reduce((acc, result) => {
    acc[result.compatibility.status] = (acc[result.compatibility.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const osCompatibilityChartData = [
    { label: 'Supported', value: osStatusCounts['supported'] || 0 },
    { label: 'Community', value: osStatusCounts['community'] || 0 },
    { label: 'Unsupported', value: osStatusCounts['unsupported'] || 0 },
  ].filter(d => d.value > 0);

  // ===== READINESS SCORE CALCULATION =====
  const blockerCount = vmsWithRDM + vmsWithSharedDisks + vmsWithVeryLargeMemory;
  const warningCount = vmsWithoutTools + vmsWithOldSnapshots + vmsWithLargeDisks + vmsWithLargeMemory - vmsWithVeryLargeMemory;

  const totalVMsToCheck = poweredOnVMs.length || 1;
  const blockerPenalty = (blockerCount / totalVMsToCheck) * 50;
  const warningPenalty = (warningCount / totalVMsToCheck) * 30;
  const unsupportedOSPenalty = ((osStatusCounts['unsupported'] || 0) / totalVMsToCheck) * 20;

  const readinessScore = Math.max(0, Math.round(100 - blockerPenalty - warningPenalty - unsupportedOSPenalty));

  // ===== VPC VSI PROFILE MAPPING =====
  const { vpcProfiles } = ibmCloudProfiles;

  function mapVMToVSIProfile(vcpus: number, memoryGiB: number) {
    const memToVcpuRatio = memoryGiB / vcpus;

    let family: 'balanced' | 'compute' | 'memory' = 'balanced';
    if (memToVcpuRatio <= 2.5) {
      family = 'compute';
    } else if (memToVcpuRatio >= 6) {
      family = 'memory';
    }

    const profiles = vpcProfiles[family];
    const bestFit = profiles.find(p => p.vcpus >= vcpus && p.memoryGiB >= memoryGiB);
    return bestFit || profiles[profiles.length - 1];
  }

  const vmProfileMappings = poweredOnVMs.map(vm => ({
    vmName: vm.vmName,
    vcpus: vm.cpus,
    memoryGiB: Math.round(mibToGiB(vm.memory)),
    profile: mapVMToVSIProfile(vm.cpus, mibToGiB(vm.memory)),
  }));

  const profileCounts = vmProfileMappings.reduce((acc, mapping) => {
    acc[mapping.profile.name] = (acc[mapping.profile.name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topProfiles = Object.entries(profileCounts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const familyCounts = vmProfileMappings.reduce((acc, mapping) => {
    const prefix = mapping.profile.name.split('-')[0];
    const familyName = prefix === 'bx2' ? 'Balanced' :
                       prefix === 'cx2' ? 'Compute' :
                       prefix === 'mx2' ? 'Memory' : 'Other';
    acc[familyName] = (acc[familyName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const familyChartData = Object.entries(familyCounts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const totalVSIs = poweredOnVMs.length;
  const uniqueProfiles = Object.keys(profileCounts).length;
  const vsiTotalVCPUs = vmProfileMappings.reduce((sum, m) => sum + m.profile.vcpus, 0);
  const vsiTotalMemory = vmProfileMappings.reduce((sum, m) => sum + m.profile.memoryGiB, 0);

  // ===== COMPLEXITY DISTRIBUTION =====
  const complexityScores = poweredOnVMs.map(vm => {
    let score = 0;
    const compat = getIBMCloudOSSupport(vm.guestOS);
    if (compat.status === 'unsupported') score += 40;
    else if (compat.status === 'community') score += 15;

    const vmNics = networks.filter(n => n.vmName === vm.vmName).length;
    if (vmNics > 3) score += 25;
    else if (vmNics > 1) score += 10;

    const vmDisks = disks.filter(d => d.vmName === vm.vmName);
    const largeDisks = vmDisks.filter(d => mibToGiB(d.capacityMiB) > 2000).length;
    if (largeDisks > 0) score += 30;
    if (vmDisks.length > 5) score += 20;
    else if (vmDisks.length > 2) score += 10;

    const memGiB = mibToGiB(vm.memory);
    if (memGiB > 1024) score += 40;
    else if (memGiB > 512) score += 20;

    if (vm.cpus > 64) score += 30;
    else if (vm.cpus > 32) score += 15;

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

  // ===== VSI SIZING FOR COST ESTIMATION =====
  const vsiSizing = useMemo<VSISizingInput>(() => {
    // Calculate storage from disks
    const totalStorageGiB = disks.reduce((sum, d) => sum + mibToGiB(d.capacityMiB), 0);

    // Group VMs by recommended profile
    const profileGroupings = vmProfileMappings.reduce((acc, mapping) => {
      const profileName = mapping.profile.name;
      if (!acc[profileName]) {
        acc[profileName] = 0;
      }
      acc[profileName]++;
      return acc;
    }, {} as Record<string, number>);

    // Convert to the expected format
    const vmProfiles = Object.entries(profileGroupings).map(([profile, count]) => ({
      profile,
      count,
    }));

    return {
      vmProfiles,
      storageTiB: Math.ceil(totalStorageGiB / 1024),
    };
  }, [vmProfileMappings, disks]);

  // ===== MIGRATION WAVE PLANNING =====
  const vmWaveData = poweredOnVMs.map(vm => {
    const complexityData = complexityScores.find(cs => cs.vmName === vm.vmName);
    const osCompat = getIBMCloudOSSupport(vm.guestOS);
    const hasBlocker = disks.some(d => d.vmName === vm.vmName && (d.raw || (d.sharingMode && d.sharingMode.toLowerCase() !== 'sharingnone')));
    const hasVeryLargeMem = mibToGiB(vm.memory) > 1024;
    const toolStatus = toolsMap.get(vm.vmName);
    const noTools = !toolStatus || toolStatus.toolsStatus === 'toolsNotInstalled';

    // Get primary network info for network-based wave planning
    const vmNetworks = networks.filter(n => n.vmName === vm.vmName);
    const primaryNetwork = vmNetworks[0];
    const networkName = primaryNetwork?.networkName || 'No Network';
    const ipAddress = primaryNetwork?.ipv4Address || '';
    const subnet = ipAddress ? ipAddress.split('.').slice(0, 3).join('.') + '.0/24' : 'Unknown';

    return {
      vmName: vm.vmName,
      complexity: complexityData?.score || 0,
      osStatus: osCompat.status,
      hasBlocker: hasBlocker || hasVeryLargeMem || noTools,
      vcpus: vm.cpus,
      memoryGiB: Math.round(mibToGiB(vm.memory)),
      storageGiB: Math.round(mibToGiB(vm.provisionedMiB)),
      networkName,
      ipAddress,
      subnet,
    };
  });

  // Complexity-based waves (traditional approach)
  const complexityWaves = useMemo(() => {
    const waveList: { name: string; description: string; vms: typeof vmWaveData }[] = [
      { name: 'Wave 1: Pilot', description: 'Simple VMs with supported OS for initial validation', vms: [] },
      { name: 'Wave 2: Quick Wins', description: 'Low complexity VMs ready for migration', vms: [] },
      { name: 'Wave 3: Standard', description: 'Moderate complexity VMs', vms: [] },
      { name: 'Wave 4: Complex', description: 'High complexity VMs requiring careful planning', vms: [] },
      { name: 'Wave 5: Remediation', description: 'VMs with blockers requiring fixes before migration', vms: [] },
    ];

    vmWaveData.forEach(vm => {
      if (vm.hasBlocker) {
        waveList[4].vms.push(vm);
      } else if (vm.complexity <= 15 && vm.osStatus === 'supported') {
        waveList[0].vms.push(vm);
      } else if (vm.complexity <= 30) {
        waveList[1].vms.push(vm);
      } else if (vm.complexity <= 55) {
        waveList[2].vms.push(vm);
      } else {
        waveList[3].vms.push(vm);
      }
    });

    return waveList.filter(w => w.vms.length > 0);
  }, [vmWaveData]);

  // Helper function to calculate IP prefix based on CIDR length
  const getIpPrefix = (ip: string, prefixLength: number): string => {
    if (!ip) return 'Unknown';
    const parts = ip.split('.');
    if (parts.length !== 4) return 'Unknown';

    const octetsToKeep = Math.floor(prefixLength / 8);
    const remainingBits = prefixLength % 8;

    const prefix = parts.slice(0, octetsToKeep).map(Number);

    if (remainingBits > 0 && octetsToKeep < 4) {
      const mask = 256 - Math.pow(2, 8 - remainingBits);
      prefix.push(Number(parts[octetsToKeep]) & mask);
    }

    while (prefix.length < 4) {
      prefix.push(0);
    }

    return `${prefix.join('.')}/${prefixLength}`;
  };

  // Network-based waves: Group by port group or IP prefix
  const networkWaves = useMemo(() => {
    const groups = new Map<string, typeof vmWaveData>();

    vmWaveData.forEach(vm => {
      let key: string;

      if (networkGroupBy === 'portGroup') {
        key = vm.networkName || 'No Network';
      } else {
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

    // Convert to wave format
    const waves = Array.from(groups.entries()).map(([groupName, vms]) => {
      const portGroups = [...new Set(vms.map(v => v.networkName).filter(n => n && n !== 'No Network'))];
      const ipRanges = [...new Set(vms.map(v => v.ipAddress).filter(Boolean))];
      const hasBlockers = vms.some(vm => vm.hasBlocker);
      const avgComplexity = vms.reduce((sum, vm) => sum + vm.complexity, 0) / vms.length;

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
    });

    // Sort: groups without blockers first, then by VM count ascending
    return waves.sort((a, b) => {
      if (a.hasBlockers !== b.hasBlockers) return a.hasBlockers ? 1 : -1;
      return a.vmCount - b.vmCount;
    });
  }, [vmWaveData, networkGroupBy, ipPrefixLength]);

  const waveChartData = wavePlanningMode === 'network'
    ? networkWaves.map((wave) => ({
        label: wave.name.length > 20 ? wave.name.substring(0, 17) + '...' : wave.name,
        value: wave.vmCount,
      })).slice(0, 10)
    : complexityWaves.map((wave, waveIdx) => ({
        label: `Wave ${waveIdx + 1}`,
        value: wave.vms.length,
      }));

  const waveResources = wavePlanningMode === 'network'
    ? networkWaves.map(wave => ({
        name: wave.name,
        description: wave.description,
        vmCount: wave.vmCount,
        vcpus: wave.vcpus,
        memoryGiB: wave.memoryGiB,
        storageGiB: wave.storageGiB,
        hasBlockers: wave.hasBlockers,
      }))
    : complexityWaves.map(wave => ({
        name: wave.name,
        description: wave.description,
        vmCount: wave.vms.length,
        vcpus: wave.vms.reduce((sum, vm) => sum + vm.vcpus, 0),
        memoryGiB: wave.vms.reduce((sum, vm) => sum + vm.memoryGiB, 0),
        storageGiB: wave.vms.reduce((sum, vm) => sum + vm.storageGiB, 0),
        hasBlockers: false,
      }));

  // ===== REMEDIATION ITEMS =====
  const remediationItems: RemediationItem[] = [];

  if (vmsWithoutTools > 0) {
    remediationItems.push({
      id: 'tools-installed',
      name: 'VMware Tools Not Installed',
      severity: 'warning',
      description: 'VMware Tools required for clean VM export',
      remediation: 'Install VMware Tools before exporting the VM',
      documentationLink: mtvRequirements.checks['tools-installed'].documentationLink,
      affectedCount: vmsWithoutTools,
    });
  }

  if (vmsWithRDM > 0) {
    remediationItems.push({
      id: 'no-rdm',
      name: 'RDM Disks Detected',
      severity: 'blocker',
      description: 'Raw Device Mapping disks cannot be migrated to VPC VSI',
      remediation: 'Convert RDM disks to VMDK before migration',
      documentationLink: mtvRequirements.checks['no-rdm'].documentationLink,
      affectedCount: vmsWithRDM,
    });
  }

  if (vmsWithSharedDisks > 0) {
    remediationItems.push({
      id: 'no-shared-disks',
      name: 'Shared Disks Detected',
      severity: 'blocker',
      description: 'Shared disks are not supported on VPC VSIs',
      remediation: 'Reconfigure shared storage to use block storage or file storage',
      documentationLink: mtvRequirements.checks['no-shared-disks'].documentationLink,
      affectedCount: vmsWithSharedDisks,
    });
  }

  if (vmsWithVeryLargeMemory > 0) {
    remediationItems.push({
      id: 'large-memory',
      name: 'Very Large Memory VMs',
      severity: 'blocker',
      description: 'VMs with >1TB memory exceed VPC VSI profile limits',
      remediation: 'Consider using bare metal servers or splitting workloads',
      documentationLink: 'https://cloud.ibm.com/docs/vpc?topic=vpc-profiles',
      affectedCount: vmsWithVeryLargeMemory,
    });
  }

  if (vmsWithLargeMemory - vmsWithVeryLargeMemory > 0) {
    remediationItems.push({
      id: 'large-memory-warning',
      name: 'Large Memory VMs',
      severity: 'warning',
      description: 'VMs with >512GB memory require high-memory profiles',
      remediation: 'Ensure mx2-128x1024 or similar profile is available in your region',
      documentationLink: 'https://cloud.ibm.com/docs/vpc?topic=vpc-profiles',
      affectedCount: vmsWithLargeMemory - vmsWithVeryLargeMemory,
    });
  }

  if (vmsWithLargeDisks > 0) {
    remediationItems.push({
      id: 'large-disks',
      name: 'Large Disks (>2TB)',
      severity: 'warning',
      description: 'Disks larger than 2TB may require multiple block volumes',
      remediation: 'Plan for disk splitting or use file storage for large data',
      documentationLink: 'https://cloud.ibm.com/docs/vpc?topic=vpc-block-storage-profiles',
      affectedCount: vmsWithLargeDisks,
    });
  }

  if (vmsWithOldSnapshots > 0) {
    remediationItems.push({
      id: 'old-snapshots',
      name: 'Old Snapshots',
      severity: 'warning',
      description: 'Snapshots should be consolidated before export',
      remediation: 'Delete or consolidate snapshots before VM export',
      documentationLink: mtvRequirements.checks['old-snapshots'].documentationLink,
      affectedCount: vmsWithOldSnapshots,
    });
  }

  return (
    <div className="migration-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="migration-page__title">VSI Migration</h1>
          <p className="migration-page__subtitle">
            IBM Cloud VPC Virtual Server Instance migration assessment and sizing
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
            <TabList aria-label="VSI migration tabs">
              <Tab>Pre-Flight Checks</Tab>
              <Tab>Sizing</Tab>
              <Tab>Cost Estimation</Tab>
              <Tab>Wave Planning</Tab>
              <Tab>OS Compatibility</Tab>
              <Tab>Complexity</Tab>
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
                          <Tag type={vmsWithoutTools === 0 ? 'green' : 'magenta'}>
                            {formatNumber(vmsWithoutTools)}
                          </Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Tools Not Running</span>
                          <Tag type={vmsWithToolsNotRunning === 0 ? 'green' : 'teal'}>
                            {formatNumber(vmsWithToolsNotRunning)}
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
                          <Tag type={vmsWithOldSnapshots === 0 ? 'green' : 'magenta'}>
                            {formatNumber(vmsWithOldSnapshots)}
                          </Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Warning Snapshots ({SNAPSHOT_WARNING_AGE_DAYS}-{SNAPSHOT_BLOCKER_AGE_DAYS} days)</span>
                          <Tag type={vmsWithWarningSnapshots === 0 ? 'green' : 'teal'}>
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
                          <span>Disks &gt;2TB</span>
                          <Tag type={vmsWithLargeDisks === 0 ? 'green' : 'magenta'}>
                            {formatNumber(vmsWithLargeDisks)}
                          </Tag>
                        </div>
                      </div>
                    </Tile>
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="migration-page__checks-tile">
                      <h3>VPC Profile Limits</h3>
                      <div className="migration-page__check-items">
                        <div className="migration-page__check-item">
                          <span>Memory &gt;512GB (High-Mem)</span>
                          <Tag type={vmsWithLargeMemory === 0 ? 'green' : 'magenta'}>
                            {formatNumber(vmsWithLargeMemory - vmsWithVeryLargeMemory)}
                          </Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Memory &gt;1TB (Blocker)</span>
                          <Tag type={vmsWithVeryLargeMemory === 0 ? 'green' : 'red'}>
                            {formatNumber(vmsWithVeryLargeMemory)}
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
                          <span>HW v{HW_VERSION_RECOMMENDED}+ (Optimal)</span>
                          <Tag type="green">{formatNumber(hwVersionCounts.recommended)}</Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>HW v{HW_VERSION_MINIMUM}-{HW_VERSION_RECOMMENDED - 1}</span>
                          <Tag type="teal">{formatNumber(hwVersionCounts.supported)}</Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>&lt;HW v{HW_VERSION_MINIMUM}</span>
                          <Tag type={hwVersionCounts.outdated === 0 ? 'green' : 'magenta'}>
                            {formatNumber(hwVersionCounts.outdated)}
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
                      <h3>VPC Virtual Server Instance Mapping</h3>
                      <p>Best-fit IBM Cloud VPC VSI profiles for {formatNumber(totalVSIs)} VMs</p>
                    </Tile>
                  </Column>

                  <Column lg={4} md={4} sm={2}>
                    <MetricCard
                      label="Total VSIs"
                      value={formatNumber(totalVSIs)}
                      variant="primary"
                    />
                  </Column>

                  <Column lg={4} md={4} sm={2}>
                    <MetricCard
                      label="Unique Profiles"
                      value={formatNumber(uniqueProfiles)}
                      variant="info"
                    />
                  </Column>

                  <Column lg={4} md={4} sm={2}>
                    <MetricCard
                      label="Total vCPUs"
                      value={formatNumber(vsiTotalVCPUs)}
                      variant="teal"
                    />
                  </Column>

                  <Column lg={4} md={4} sm={2}>
                    <MetricCard
                      label="Total Memory"
                      value={`${formatNumber(vsiTotalMemory)} GiB`}
                      variant="purple"
                    />
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="migration-page__chart-tile">
                      <DoughnutChart
                        title="Profile Family Distribution"
                        subtitle="VMs by instance family type"
                        data={familyChartData}
                        height={280}
                        colors={['#0f62fe', '#8a3ffc', '#009d9a']}
                        formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
                      />
                    </Tile>
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="migration-page__chart-tile">
                      <HorizontalBarChart
                        title="Top 10 Recommended Profiles"
                        subtitle="Most frequently mapped VSI profiles"
                        data={topProfiles}
                        height={280}
                        valueLabel="VMs"
                        formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
                      />
                    </Tile>
                  </Column>

                  <Column lg={16} md={8} sm={4}>
                    <Tile className="migration-page__recommendation-tile">
                      <h4>Profile Family Descriptions</h4>
                      <div className="migration-page__recommendation-grid">
                        <div className="migration-page__recommendation-item">
                          <span className="migration-page__recommendation-key">Balanced (bx2)</span>
                          <span className="migration-page__recommendation-value">1:4 vCPU:Memory ratio - General purpose workloads</span>
                        </div>
                        <div className="migration-page__recommendation-item">
                          <span className="migration-page__recommendation-key">Compute (cx2)</span>
                          <span className="migration-page__recommendation-value">1:2 vCPU:Memory ratio - CPU-intensive workloads</span>
                        </div>
                        <div className="migration-page__recommendation-item">
                          <span className="migration-page__recommendation-key">Memory (mx2)</span>
                          <span className="migration-page__recommendation-value">1:8 vCPU:Memory ratio - Memory-intensive workloads</span>
                        </div>
                      </div>
                    </Tile>
                  </Column>

                  <Column lg={16} md={8} sm={4}>
                    <Tile className="migration-page__cost-tile">
                      <h4>Cost Estimation</h4>
                      <p className="migration-page__cost-description">
                        Estimate costs for {formatNumber(totalVSIs)} VPC Virtual Server Instances using the IBM Cloud Cost Estimator.
                      </p>
                      <RedHatDocLink
                        href="https://cloud.ibm.com/vpc-ext/provision/vs"
                        label="Open IBM Cloud VPC Catalog"
                        description="Configure and estimate costs for VPC virtual servers"
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
                      type="vsi"
                      vsiSizing={vsiSizing}
                      title="VPC VSI Cost Estimation"
                    />
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
                              ? `${waveResources.length} subnets for subnet-based migration with network cutover`
                              : `VMs organized into ${waveResources.length} waves based on complexity and readiness`}
                          </p>
                        </div>
                        <RadioButtonGroup
                          legendText="Planning Mode"
                          name="wave-planning-mode"
                          valueSelected={wavePlanningMode}
                          onChange={(value) => setWavePlanningMode(value as 'complexity' | 'network')}
                          orientation="horizontal"
                        >
                          <RadioButton labelText="Network-Based" value="network" id="wave-network" />
                          <RadioButton labelText="Complexity-Based" value="complexity" id="wave-complexity" />
                        </RadioButtonGroup>
                      </div>
                    </Tile>
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="migration-page__chart-tile">
                      <HorizontalBarChart
                        title={wavePlanningMode === 'network' ? 'VMs by Subnet' : 'VMs by Wave'}
                        subtitle={wavePlanningMode === 'network' ? 'Distribution across subnets' : 'Distribution across migration waves'}
                        data={waveChartData}
                        height={280}
                        valueLabel="VMs"
                        colors={wavePlanningMode === 'network'
                          ? ['#0f62fe', '#009d9a', '#8a3ffc', '#1192e8', '#005d5d', '#6929c4', '#012749', '#9f1853', '#fa4d56', '#570408']
                          : ['#24a148', '#1192e8', '#009d9a', '#ff832b', '#da1e28']}
                        formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
                      />
                    </Tile>
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="migration-page__checks-tile">
                      <h3>{wavePlanningMode === 'network' ? 'Subnets' : 'Wave Descriptions'}</h3>
                      <div className="migration-page__check-items">
                        {waveResources.slice(0, 8).map((wave, idx) => (
                          <div key={idx} className="migration-page__check-item">
                            <span>{wave.name.length > 30 ? wave.name.substring(0, 27) + '...' : wave.name}</span>
                            <Tag type={wave.hasBlockers ? 'red' : wavePlanningMode === 'network' ? 'blue' : (idx === 4 ? 'red' : idx === 3 ? 'magenta' : 'blue')}>
                              {formatNumber(wave.vmCount)}
                            </Tag>
                          </div>
                        ))}
                        {waveResources.length > 8 && (
                          <div className="migration-page__check-item">
                            <span>+ {waveResources.length - 8} more {wavePlanningMode === 'network' ? 'subnets' : 'waves'}</span>
                            <Tag type="gray">{formatNumber(waveResources.slice(8).reduce((sum, w) => sum + w.vmCount, 0))}</Tag>
                          </div>
                        )}
                      </div>
                    </Tile>
                  </Column>

                  {waveResources.slice(0, 10).map((wave, idx) => (
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
                        {wave.hasBlockers && (
                          <Tag type="red" style={{ marginTop: '0.5rem' }}>Contains blockers</Tag>
                        )}
                      </Tile>
                    </Column>
                  ))}

                  <Column lg={16} md={8} sm={4}>
                    <Tile className="migration-page__workflow-resources">
                      <h4>VSI Migration Workflow</h4>
                      <div className="migration-page__recommendation-grid">
                        <div className="migration-page__recommendation-item">
                          <span className="migration-page__recommendation-key">1. Export VM</span>
                          <span className="migration-page__recommendation-value">Export VM as OVA or VMDK from vSphere</span>
                        </div>
                        <div className="migration-page__recommendation-item">
                          <span className="migration-page__recommendation-key">2. Upload Image</span>
                          <span className="migration-page__recommendation-value">Upload to IBM Cloud Object Storage</span>
                        </div>
                        <div className="migration-page__recommendation-item">
                          <span className="migration-page__recommendation-key">3. Import Image</span>
                          <span className="migration-page__recommendation-value">Import custom image into VPC</span>
                        </div>
                        <div className="migration-page__recommendation-item">
                          <span className="migration-page__recommendation-key">4. Create VSI</span>
                          <span className="migration-page__recommendation-value">Create VSI from imported image</span>
                        </div>
                      </div>
                      <div className="migration-page__resource-links" style={{ marginTop: '1rem' }}>
                        <RedHatDocLink
                          href="https://cloud.ibm.com/docs/vpc?topic=vpc-importing-custom-images-vpc"
                          label="Import Custom Images"
                          description="Guide for importing custom images into IBM Cloud VPC"
                        />
                        <RedHatDocLink
                          href="https://cloud.ibm.com/docs/vpc?topic=vpc-migrate-vsi-to-vpc"
                          label="Migration Guide"
                          description="Migrating virtual servers to VPC"
                        />
                      </div>
                    </Tile>
                  </Column>
                </Grid>
              </TabPanel>

              {/* OS Compatibility Panel */}
              <TabPanel>
                <Grid className="migration-page__tab-content">
                  <Column lg={8} md={8} sm={4}>
                    <Tile className="migration-page__chart-tile">
                      <DoughnutChart
                        title="OS Compatibility Distribution"
                        subtitle="IBM Cloud VPC supported guest OSes"
                        data={osCompatibilityChartData}
                        height={280}
                        colors={['#24a148', '#1192e8', '#da1e28']}
                        formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
                      />
                    </Tile>
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="migration-page__checks-tile">
                      <h3>Compatibility Summary</h3>
                      <div className="migration-page__check-items">
                        <div className="migration-page__check-item">
                          <span>Supported</span>
                          <Tag type="green">{formatNumber(osStatusCounts['supported'] || 0)}</Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Community Supported</span>
                          <Tag type="blue">{formatNumber(osStatusCounts['community'] || 0)}</Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Unsupported</span>
                          <Tag type="red">{formatNumber(osStatusCounts['unsupported'] || 0)}</Tag>
                        </div>
                      </div>
                      <p className="migration-page__os-note">
                        Based on IBM Cloud VPC custom image support matrix
                      </p>
                    </Tile>
                  </Column>

                  <Column lg={16} md={8} sm={4}>
                    <Tile className="migration-page__recommendation-tile">
                      <h4>IBM Cloud VPC Supported Operating Systems</h4>
                      <div className="migration-page__recommendation-grid">
                        <div className="migration-page__recommendation-item">
                          <span className="migration-page__recommendation-key">RHEL</span>
                          <span className="migration-page__recommendation-value">RHEL 7.x, 8.x, 9.x - Fully supported with license included options</span>
                        </div>
                        <div className="migration-page__recommendation-item">
                          <span className="migration-page__recommendation-key">Windows Server</span>
                          <span className="migration-page__recommendation-value">2016, 2019, 2022 - Fully supported with license included options</span>
                        </div>
                        <div className="migration-page__recommendation-item">
                          <span className="migration-page__recommendation-key">Ubuntu</span>
                          <span className="migration-page__recommendation-value">18.04, 20.04, 22.04 LTS - Fully supported</span>
                        </div>
                        <div className="migration-page__recommendation-item">
                          <span className="migration-page__recommendation-key">SLES</span>
                          <span className="migration-page__recommendation-value">SUSE Linux Enterprise Server - Fully supported</span>
                        </div>
                        <div className="migration-page__recommendation-item">
                          <span className="migration-page__recommendation-key">CentOS/Rocky/Alma</span>
                          <span className="migration-page__recommendation-value">Community supported with custom images</span>
                        </div>
                      </div>
                      <div className="migration-page__resource-links" style={{ marginTop: '1rem' }}>
                        <RedHatDocLink
                          href="https://cloud.ibm.com/docs/vpc?topic=vpc-about-images"
                          label="VPC Image Documentation"
                          description="Complete list of supported operating systems for VPC"
                        />
                      </div>
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
                        subtitle="Based on OS, resources, and storage"
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

                  <Column lg={16} md={8} sm={4}>
                    <Tile className="migration-page__recommendation-tile">
                      <h4>VSI Complexity Factors</h4>
                      <div className="migration-page__recommendation-grid">
                        <div className="migration-page__recommendation-item">
                          <span className="migration-page__recommendation-key">OS Compatibility</span>
                          <span className="migration-page__recommendation-value">Unsupported OS adds significant complexity</span>
                        </div>
                        <div className="migration-page__recommendation-item">
                          <span className="migration-page__recommendation-key">Memory Size</span>
                          <span className="migration-page__recommendation-value">&gt;512GB requires high-memory profiles, &gt;1TB is a blocker</span>
                        </div>
                        <div className="migration-page__recommendation-item">
                          <span className="migration-page__recommendation-key">Disk Size</span>
                          <span className="migration-page__recommendation-value">&gt;2TB disks may need splitting across volumes</span>
                        </div>
                        <div className="migration-page__recommendation-item">
                          <span className="migration-page__recommendation-key">Network Complexity</span>
                          <span className="migration-page__recommendation-value">Multiple NICs require VPC network planning</span>
                        </div>
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
