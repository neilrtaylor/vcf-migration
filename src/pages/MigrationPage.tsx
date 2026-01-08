// Migration readiness page with ROKS sizing
import { useState, useCallback } from 'react';
import { Grid, Column, Tile, Tag, Tabs, TabList, Tab, TabPanels, TabPanel, UnorderedList, ListItem, Button, InlineNotification } from '@carbon/react';
import { Download } from '@carbon/icons-react';
import { Navigate } from 'react-router-dom';
import { useData, useVMs } from '@/hooks';
import { ROUTES, HW_VERSION_MINIMUM, HW_VERSION_RECOMMENDED, SNAPSHOT_WARNING_AGE_DAYS, SNAPSHOT_BLOCKER_AGE_DAYS } from '@/utils/constants';
import { formatNumber, mibToGiB, getHardwareVersionNumber } from '@/utils/formatters';
import { HorizontalBarChart, DoughnutChart } from '@/components/charts';
import { MetricCard, RedHatDocLink, RemediationPanel } from '@/components/common';
import { SizingCalculator } from '@/components/sizing';
import type { RemediationItem } from '@/components/common';
import { MTVYAMLGenerator, downloadBlob } from '@/services/export';
import type { MTVExportOptions } from '@/types/mtvYaml';
import osCompatibilityData from '@/data/redhatOSCompatibility.json';
import ibmCloudProfiles from '@/data/ibmCloudProfiles.json';
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

export function MigrationPage() {
  const { rawData } = useData();
  const vms = useVMs();
  const [yamlExporting, setYamlExporting] = useState(false);
  const [yamlExportSuccess, setYamlExportSuccess] = useState(false);

  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  const poweredOnVMs = vms.filter(vm => vm.powerState === 'poweredOn');
  const snapshots = rawData.vSnapshot;
  const tools = rawData.vTools;
  const cdDrives = rawData.vCD;
  const disks = rawData.vDisk;

  // ===== PRE-FLIGHT CHECKS =====

  // VMware Tools checks
  const toolsMap = new Map(tools.map(t => [t.vmName, t]));
  const vmsWithoutTools = poweredOnVMs.filter(vm => {
    const tool = toolsMap.get(vm.vmName);
    return !tool || tool.toolsStatus === 'toolsNotInstalled' || tool.toolsStatus === 'guestToolsNotInstalled';
  }).length;
  const vmsWithToolsNotRunning = poweredOnVMs.filter(vm => {
    const tool = toolsMap.get(vm.vmName);
    return tool && (tool.toolsStatus === 'toolsNotRunning' || tool.toolsStatus === 'guestToolsNotRunning');
  }).length;
  const vmsWithOutdatedTools = poweredOnVMs.filter(vm => {
    const tool = toolsMap.get(vm.vmName);
    return tool && tool.toolsStatus === 'toolsOld';
  }).length;

  // Snapshot checks
  const vmsWithSnapshots = new Set(snapshots.map(s => s.vmName)).size;
  const vmsWithOldSnapshots = new Set(
    snapshots.filter(s => s.ageInDays > SNAPSHOT_BLOCKER_AGE_DAYS).map(s => s.vmName)
  ).size;
  const vmsWithWarningSnapshots = new Set(
    snapshots.filter(s => s.ageInDays > SNAPSHOT_WARNING_AGE_DAYS && s.ageInDays <= SNAPSHOT_BLOCKER_AGE_DAYS).map(s => s.vmName)
  ).size;

  // CD-ROM checks
  const vmsWithCdConnected = new Set(cdDrives.filter(cd => cd.connected).map(cd => cd.vmName)).size;

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

  // Storage checks
  const vmsWithRDM = new Set(disks.filter(d => d.raw).map(d => d.vmName)).size;
  const vmsWithSharedDisks = new Set(disks.filter(d =>
    d.sharingMode && d.sharingMode.toLowerCase() !== 'sharingnone'
  ).map(d => d.vmName)).size;

  // Network checks
  const networks = rawData.vNetwork;
  const vmsWithLegacyNIC = new Set(
    networks.filter(n => n.adapterType?.toLowerCase().includes('e1000')).map(n => n.vmName)
  ).size;

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
  const blockerCount = vmsWithoutTools + vmsWithOldSnapshots + vmsWithRDM + vmsWithSharedDisks;
  const warningCount = vmsWithToolsNotRunning + vmsWithWarningSnapshots + vmsWithCdConnected +
                       hwVersionCounts.outdated + vmsWithLegacyNIC;

  // Calculate score (starts at 100, deduct for issues)
  const totalVMsToCheck = poweredOnVMs.length || 1;
  const blockerPenalty = (blockerCount / totalVMsToCheck) * 50;
  const warningPenalty = (warningCount / totalVMsToCheck) * 30;
  const unsupportedOSPenalty = ((osStatusCounts['unsupported'] || 0) / totalVMsToCheck) * 20;

  const readinessScore = Math.max(0, Math.round(100 - blockerPenalty - warningPenalty - unsupportedOSPenalty));

  // ===== COMPLEXITY DISTRIBUTION =====
  const complexityScores = poweredOnVMs.map(vm => {
    let score = 0;
    const compat = getOSCompatibility(vm.guestOS);
    score += (100 - compat.compatibilityScore) * 0.3; // OS weight

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

  // Top complex VMs
  const topComplexVMs = [...complexityScores]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(cs => ({
      label: cs.vmName.substring(0, 40),
      value: Math.round(cs.score),
    }));

  // ===== VPC VSI PROFILE MAPPING =====
  const { vpcProfiles } = ibmCloudProfiles;

  // Map each VM to best-fit VPC profile
  function mapVMToVSIProfile(vcpus: number, memoryGiB: number) {
    const memToVcpuRatio = memoryGiB / vcpus;

    // Determine profile family based on ratio
    let family: 'balanced' | 'compute' | 'memory' = 'balanced';
    if (memToVcpuRatio <= 2.5) {
      family = 'compute';
    } else if (memToVcpuRatio >= 6) {
      family = 'memory';
    }

    // Find smallest profile that fits
    const profiles = vpcProfiles[family];
    const bestFit = profiles.find(p => p.vcpus >= vcpus && p.memoryGiB >= memoryGiB);
    return bestFit || profiles[profiles.length - 1]; // Return largest if none fit
  }

  const vmProfileMappings = poweredOnVMs.map(vm => ({
    vmName: vm.vmName,
    vcpus: vm.cpus,
    memoryGiB: Math.round(mibToGiB(vm.memory)),
    profile: mapVMToVSIProfile(vm.cpus, mibToGiB(vm.memory)),
  }));

  // Count by profile
  const profileCounts = vmProfileMappings.reduce((acc, mapping) => {
    acc[mapping.profile.name] = (acc[mapping.profile.name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topProfiles = Object.entries(profileCounts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Count by family
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

  // VSI sizing summary
  const totalVSIs = poweredOnVMs.length;
  const uniqueProfiles = Object.keys(profileCounts).length;
  const vsiTotalVCPUs = vmProfileMappings.reduce((sum, m) => sum + m.profile.vcpus, 0);
  const vsiTotalMemory = vmProfileMappings.reduce((sum, m) => sum + m.profile.memoryGiB, 0);

  // ===== MIGRATION WAVE PLANNING =====
  // Create complexity + OS compatibility map for each VM
  const vmWaveData = poweredOnVMs.map(vm => {
    const complexityData = complexityScores.find(cs => cs.vmName === vm.vmName);
    const osCompat = getOSCompatibility(vm.guestOS);
    const hasBlocker = disks.some(d => d.vmName === vm.vmName && (d.raw || (d.sharingMode && d.sharingMode.toLowerCase() !== 'sharingnone')));
    const hasSnapshot = snapshots.some(s => s.vmName === vm.vmName && s.ageInDays > SNAPSHOT_BLOCKER_AGE_DAYS);
    const toolStatus = toolsMap.get(vm.vmName);
    const noTools = !toolStatus || toolStatus.toolsStatus === 'toolsNotInstalled';

    return {
      vmName: vm.vmName,
      complexity: complexityData?.score || 0,
      osStatus: osCompat.compatibilityStatus,
      hasBlocker: hasBlocker || hasSnapshot || noTools,
      vcpus: vm.cpus,
      memoryGiB: Math.round(mibToGiB(vm.memory)),
      storageGiB: Math.round(mibToGiB(vm.provisionedMiB)),
    };
  });

  // Assign to waves
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

  // Wave summary data
  const waveChartData = waves.map((wave, idx) => ({
    label: `Wave ${idx + 1}`,
    value: wave.vms.length,
  })).filter(d => d.value > 0);

  // Wave resources
  const waveResources = waves.map(wave => ({
    name: wave.name,
    vmCount: wave.vms.length,
    vcpus: wave.vms.reduce((sum, vm) => sum + vm.vcpus, 0),
    memoryGiB: wave.vms.reduce((sum, vm) => sum + vm.memoryGiB, 0),
    storageGiB: wave.vms.reduce((sum, vm) => sum + vm.storageGiB, 0),
  })).filter(w => w.vmCount > 0);

  // ===== REMEDIATION ITEMS FOR PRE-FLIGHT =====
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
    });
  }

  // ===== MTV YAML EXPORT =====
  const handleYAMLExport = useCallback(async () => {
    setYamlExporting(true);
    setYamlExportSuccess(false);

    try {
      // Default export options - users can customize these in the generated YAML
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

      // Create wave data for export
      const waveExportData = waves
        .filter(w => w.vms.length > 0)
        .map(wave => ({
          name: wave.name.replace(/Wave \d+: /, '').toLowerCase(),
          vms: wave.vms.map(vmData => {
            // Find the full VM data
            const fullVm = poweredOnVMs.find(v => v.vmName === vmData.vmName);
            return fullVm!;
          }).filter(Boolean),
        }));

      // Generate and download the bundle
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

  return (
    <div className="migration-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="migration-page__title">Migration Readiness</h1>
          <p className="migration-page__subtitle">
            MTV pre-flight validation, ROKS sizing, and migration assessment
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

        {/* Tabs for different sections */}
        <Column lg={16} md={8} sm={4}>
          <Tabs>
            <TabList aria-label="Migration analysis tabs">
              <Tab>Pre-Flight Checks</Tab>
              <Tab>ROKS Sizing</Tab>
              <Tab>VPC VSI</Tab>
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

              {/* ROKS Sizing Panel */}
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
                    <SizingCalculator />
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

              {/* VPC VSI Panel */}
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

              {/* Wave Planning Panel */}
              <TabPanel>
                <Grid className="migration-page__tab-content">
                  <Column lg={16} md={8} sm={4}>
                    <Tile className="migration-page__sizing-header">
                      <h3>Migration Wave Planning</h3>
                      <p>VMs organized into {waveResources.length} waves based on complexity and readiness</p>
                    </Tile>
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="migration-page__chart-tile">
                      <HorizontalBarChart
                        title="VMs by Wave"
                        subtitle="Distribution across migration waves"
                        data={waveChartData}
                        height={280}
                        valueLabel="VMs"
                        colors={['#24a148', '#1192e8', '#009d9a', '#ff832b', '#da1e28']}
                        formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
                      />
                    </Tile>
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="migration-page__checks-tile">
                      <h3>Wave Descriptions</h3>
                      <div className="migration-page__check-items">
                        {waves.filter(w => w.vms.length > 0).map((wave, idx) => (
                          <div key={idx} className="migration-page__check-item">
                            <span>{wave.name}</span>
                            <Tag type={idx === 4 ? 'red' : idx === 3 ? 'magenta' : 'blue'}>
                              {formatNumber(wave.vms.length)}
                            </Tag>
                          </div>
                        ))}
                      </div>
                    </Tile>
                  </Column>

                  {waveResources.map((wave, idx) => (
                    <Column key={idx} lg={8} md={8} sm={4}>
                      <Tile className={`migration-page__wave-tile ${idx === waveResources.length - 1 && wave.name.includes('Remediation') ? 'migration-page__wave-tile--warning' : ''}`}>
                        <h4>{wave.name}</h4>
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
