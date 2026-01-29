// VSI (IBM Cloud VPC Virtual Server) Migration page - Refactored with shared hooks and components

import { useState, useMemo, lazy, Suspense } from 'react';
import { Grid, Column, Tile, Tag, Tabs, TabList, Tab, TabPanels, TabPanel, Button, InlineNotification, Loading, Tooltip } from '@carbon/react';
import { Navigate } from 'react-router-dom';
import { Settings, Reset, ArrowUp, ArrowDown, Information } from '@carbon/icons-react';
import { useData, useAllVMs, useCustomProfiles, usePreflightChecks, useMigrationAssessment, useWavePlanning, useVMOverrides, useAIRightsizing, useAutoExclusion } from '@/hooks';
import { ROUTES, HW_VERSION_MINIMUM, HW_VERSION_RECOMMENDED, SNAPSHOT_WARNING_AGE_DAYS, SNAPSHOT_BLOCKER_AGE_DAYS } from '@/utils/constants';
import { formatNumber, mibToGiB } from '@/utils/formatters';
import { getVMIdentifier, getEnvironmentFingerprint } from '@/utils/vmIdentifier';
import { DoughnutChart, HorizontalBarChart } from '@/components/charts';
import { EnhancedDataTable } from '@/components/tables';
import type { ColumnDef } from '@tanstack/react-table';
import { MetricCard, RedHatDocLink, RemediationPanel } from '@/components/common';
import { CostEstimation } from '@/components/cost';
import { ProfileSelector } from '@/components/sizing';
import { ComplexityAssessmentPanel, WavePlanningPanel, OSCompatibilityPanel } from '@/components/migration';
import { AIInsightsPanel } from '@/components/ai/AIInsightsPanel';
import { AIWaveAnalysisPanel } from '@/components/ai/AIWaveAnalysisPanel';
import { AICostAnalysisPanel } from '@/components/ai/AICostAnalysisPanel';
import { AIRemediationPanel } from '@/components/ai/AIRemediationPanel';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import type { InsightsInput, NetworkSummaryForAI, WaveSuggestionInput, CostOptimizationInput, RemediationInput } from '@/services/ai/types';

// Lazy load CustomProfileEditor - only loaded when user opens the modal
const CustomProfileEditor = lazy(() =>
  import('@/components/sizing/CustomProfileEditor').then(m => ({ default: m.CustomProfileEditor }))
);
import type { VSISizingInput } from '@/services/costEstimation';
import type { VMDetail } from '@/services/export';
import { mapVMToVSIProfile, getVSIProfiles, classifyVMForBurstable, findBurstableProfile, isBurstableProfile } from '@/services/migration';
import './MigrationPage.scss';

export function VSIMigrationPage() {
  const { rawData } = useData();
  const allVmsRaw = useAllVMs();
  const [showCustomProfileEditor, setShowCustomProfileEditor] = useState(false);

  // VM overrides for exclusions
  const vmOverrides = useVMOverrides();
  const { getAutoExclusionById } = useAutoExclusion();

  // Custom profiles state
  const {
    setProfileOverride,
    removeProfileOverride,
    clearAllOverrides,
    getEffectiveProfile,
    hasOverride,
    customProfiles,
    addCustomProfile,
    updateCustomProfile,
    removeCustomProfile,
  } = useCustomProfiles();

  // Filter out excluded VMs using unified three-tier exclusion
  const vms = useMemo(() => {
    return allVmsRaw.filter(vm => {
      const vmId = getVMIdentifier(vm);
      const autoResult = getAutoExclusionById(vmId);
      return !vmOverrides.isEffectivelyExcluded(vmId, autoResult.isAutoExcluded);
    });
  }, [allVmsRaw, vmOverrides, getAutoExclusionById]);

  // AI rightsizing - environment fingerprint for cache scoping
  const envFingerprint = useMemo(() => {
    return rawData ? getEnvironmentFingerprint(rawData) : '';
  }, [rawData]);

  // Derive data from rawData - these are used by hooks below
  const snapshots = useMemo(() => rawData?.vSnapshot ?? [], [rawData?.vSnapshot]);
  const tools = useMemo(() => rawData?.vTools ?? [], [rawData?.vTools]);
  const disks = useMemo(() => rawData?.vDisk ?? [], [rawData?.vDisk]);
  const networks = useMemo(() => rawData?.vNetwork ?? [], [rawData?.vNetwork]);
  const poweredOnVMs = useMemo(() => vms.filter(vm => vm.powerState === 'poweredOn'), [vms]);

  // AI rightsizing inputs
  const aiRightsizingInputs = useMemo(() => {
    return poweredOnVMs.map(vm => ({
      vmName: vm.vmName,
      vCPUs: vm.cpus,
      memoryMB: vm.memory,
      storageMB: 0,
      guestOS: vm.guestOS || undefined,
      powerState: vm.powerState,
    }));
  }, [poweredOnVMs]);

  const aiProfileSummaries = useMemo(() => {
    const profiles = getVSIProfiles();
    const all = [...profiles.balanced, ...profiles.compute, ...profiles.memory];
    return all.map(p => ({
      name: p.name,
      vcpus: p.vcpus,
      memoryGiB: p.memoryGiB,
      family: p.name.split('-')[0] || 'balanced',
    }));
  }, []);

  const { recommendations: aiRecommendations } = useAIRightsizing(
    aiRightsizingInputs,
    aiProfileSummaries,
    envFingerprint
  );

  // ===== PRE-FLIGHT CHECKS (using hook) =====
  const {
    counts: preflightCounts,
    remediationItems,
    blockerCount,
    warningCount,
    hwVersionCounts,
  } = usePreflightChecks({
    mode: 'vsi',
    vms: poweredOnVMs,
    allVms: vms,
    disks: disks,
    snapshots: snapshots,
    tools: tools,
    networks: networks,
    includeAllChecks: true, // Show all VPC checks as dropdowns
  });

  // ===== MIGRATION ASSESSMENT (using hook) =====
  const {
    complexityScores,
    readinessScore,
    chartData: complexityChartData,
    topComplexVMs,
    osStatusCounts,
  } = useMigrationAssessment({
    mode: 'vsi',
    vms: poweredOnVMs,
    disks: disks,
    networks: networks,
    blockerCount,
    warningCount,
  });

  // ===== WAVE PLANNING (using hook) =====
  const wavePlanning = useWavePlanning({
    mode: 'vsi',
    vms: poweredOnVMs,
    complexityScores,
    disks: disks,
    snapshots: snapshots,
    tools: tools,
    networks: networks,
  });

  // Additional display-only counts
  const vmsWithSnapshots = new Set(snapshots.map(s => s.vmName)).size;
  const vmsWithWarningSnapshots = new Set(
    snapshots.filter(s => s.ageInDays > SNAPSHOT_WARNING_AGE_DAYS && s.ageInDays <= SNAPSHOT_BLOCKER_AGE_DAYS).map(s => s.vmName)
  ).size;
  const vmsWithToolsNotRunning = poweredOnVMs.filter(vm => {
    const tool = tools.find(t => t.vmName === vm.vmName);
    return tool && (tool.toolsStatus === 'toolsNotRunning' || tool.toolsStatus === 'guestToolsNotRunning');
  }).length;

  // ===== VPC VSI PROFILE MAPPING =====
  const vsiProfiles = getVSIProfiles();

  const vmProfileMappings = useMemo(() => poweredOnVMs.map(vm => {
    const memoryGiB = mibToGiB(vm.memory);

    // Classify VM for burstable eligibility
    const classification = classifyVMForBurstable(vm.vmName, vm.guestOS, vm.nics);

    // Get both standard and burstable profiles
    const standardProfile = mapVMToVSIProfile(vm.cpus, memoryGiB);
    const burstableProfile = findBurstableProfile(vm.cpus, memoryGiB);

    // Default auto profile based on classification
    const autoProfile = classification.recommendation === 'burstable' && burstableProfile
      ? burstableProfile
      : standardProfile;

    const effectiveProfileName = getEffectiveProfile(vm.vmName, autoProfile.name);
    const isOverridden = hasOverride(vm.vmName);

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
        const allProfiles = [...vsiProfiles.balanced, ...vsiProfiles.compute, ...vsiProfiles.memory];
        const matchedProfile = allProfiles.find(p => p.name === effectiveProfileName);
        if (matchedProfile) effectiveProfile = matchedProfile;
      }
    }

    return {
      vmName: vm.vmName,
      vcpus: vm.cpus,
      memoryGiB: Math.round(memoryGiB),
      nics: vm.nics,
      guestOS: vm.guestOS,
      autoProfile,
      burstableProfile,
      profile: effectiveProfile,
      effectiveProfileName,
      isOverridden,
      classification,
    };
  }), [poweredOnVMs, customProfiles, getEffectiveProfile, hasOverride, vsiProfiles]);

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
    const familyName = prefix === 'bx2' ? 'Balanced' : prefix === 'cx2' ? 'Compute' : prefix === 'mx2' ? 'Memory' : 'Other';
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
  const overriddenVMCount = vmProfileMappings.filter(m => m.isOverridden).length;

  // ===== VSI SIZING FOR COST ESTIMATION =====
  const vsiSizing = useMemo<VSISizingInput>(() => {
    // Only include disks from non-excluded powered-on VMs
    const poweredOnVMNames = new Set(poweredOnVMs.map(vm => vm.vmName));
    const filteredDisks = disks.filter(d => poweredOnVMNames.has(d.vmName));
    const totalStorageGiB = filteredDisks.reduce((sum, d) => sum + mibToGiB(d.capacityMiB), 0);
    const profileGroupings = vmProfileMappings.reduce((acc, mapping) => {
      acc[mapping.profile.name] = (acc[mapping.profile.name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const vmProfiles = Object.entries(profileGroupings).map(([profile, count]) => ({ profile, count }));
    return { vmProfiles, storageTiB: Math.ceil(totalStorageGiB / 1024) };
  }, [vmProfileMappings, disks, poweredOnVMs]);

  // ===== AI INSIGHTS DATA =====
  const insightsData = useMemo<InsightsInput | null>(() => {
    if (!isAIProxyConfigured()) return null;
    const totalStorageGiB = poweredOnVMs.reduce((sum, vm) => sum + mibToGiB(vm.inUseMiB), 0);
    const scores = Array.isArray(complexityScores) ? complexityScores : [];
    const complexSimple = scores.filter(s => s.score < 3).length;
    const complexModerate = scores.filter(s => s.score >= 3 && s.score < 6).length;
    const complexHigh = scores.filter(s => s.score >= 6 && s.score < 9).length;
    const complexBlocker = scores.filter(s => s.score >= 9).length;
    const blockerSummary: string[] = [];
    if (blockerCount > 0) blockerSummary.push(`${blockerCount} pre-flight blockers`);
    if (warningCount > 0) blockerSummary.push(`${warningCount} warnings`);
    // Build network summary
    const networkSummary: NetworkSummaryForAI[] = [];
    const pgMap = new Map<string, { ips: Set<string>; vmNames: Set<string> }>();
    networks.forEach(nic => {
      const pg = nic.networkName || 'Unknown';
      if (!pgMap.has(pg)) pgMap.set(pg, { ips: new Set(), vmNames: new Set() });
      const entry = pgMap.get(pg)!;
      entry.vmNames.add(nic.vmName);
      if (nic.ipv4Address) entry.ips.add(nic.ipv4Address);
    });
    pgMap.forEach((data, portGroup) => {
      const prefixes = new Set<string>();
      data.ips.forEach(ip => {
        const parts = ip.split('.');
        if (parts.length >= 3) prefixes.add(`${parts[0]}.${parts[1]}.${parts[2]}.0/24`);
      });
      networkSummary.push({ portGroup, subnet: prefixes.size > 0 ? Array.from(prefixes).sort().join(', ') : 'N/A', vmCount: data.vmNames.size });
    });

    return {
      totalVMs: poweredOnVMs.length,
      totalExcluded: allVmsRaw.length - vms.length,
      totalVCPUs: vsiTotalVCPUs,
      totalMemoryGiB: vsiTotalMemory,
      totalStorageTiB: Math.ceil(totalStorageGiB / 1024),
      clusterCount: new Set(poweredOnVMs.map(vm => vm.cluster).filter(Boolean)).size,
      hostCount: rawData?.vHost.length ?? 0,
      datastoreCount: rawData?.vDatastore.length ?? 0,
      workloadBreakdown: familyCounts,
      complexitySummary: { simple: complexSimple, moderate: complexModerate, complex: complexHigh, blocker: complexBlocker },
      blockerSummary,
      networkSummary,
      migrationTarget: 'vsi',
    };
  }, [poweredOnVMs, allVmsRaw.length, vms.length, vsiTotalVCPUs, vsiTotalMemory, complexityScores, blockerCount, warningCount, familyCounts, networks, rawData]);

  // ===== AI WAVE SUGGESTIONS DATA =====
  const waveSuggestionData = useMemo<WaveSuggestionInput | null>(() => {
    if (!isAIProxyConfigured()) return null;
    const activeWaves = wavePlanning.wavePlanningMode === 'network' ? wavePlanning.networkWaves : wavePlanning.complexityWaves;
    if (!activeWaves || activeWaves.length === 0) return null;
    return {
      waves: wavePlanning.waveResources.map(w => ({
        name: w.name,
        vmCount: w.vmCount,
        totalVCPUs: w.vcpus,
        totalMemoryGiB: w.memoryGiB,
        totalStorageGiB: w.storageGiB,
        avgComplexity: 0,
        hasBlockers: w.hasBlockers,
        workloadTypes: [],
      })),
      totalVMs: poweredOnVMs.length,
      migrationTarget: 'vsi',
    };
  }, [wavePlanning.wavePlanningMode, wavePlanning.networkWaves, wavePlanning.complexityWaves, wavePlanning.waveResources, poweredOnVMs.length]);

  // ===== AI COST OPTIMIZATION DATA =====
  const costOptimizationData = useMemo<CostOptimizationInput | null>(() => {
    if (!isAIProxyConfigured()) return null;
    if (vmProfileMappings.length === 0) return null;
    const profileCounts = new Map<string, { count: number; workloadType: string }>();
    vmProfileMappings.forEach(m => {
      const key = m.profile.name;
      const existing = profileCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        const family = key.startsWith('mx') ? 'memory' : key.startsWith('cx') ? 'compute' : 'balanced';
        profileCounts.set(key, { count: 1, workloadType: family });
      }
    });
    return {
      vmProfiles: Array.from(profileCounts.entries()).map(([profile, data]) => ({
        profile,
        count: data.count,
        workloadType: data.workloadType,
      })),
      totalMonthlyCost: 0,
      migrationTarget: 'vsi',
      region: 'us-south',
    };
  }, [vmProfileMappings]);

  // ===== AI REMEDIATION DATA =====
  const remediationAIData = useMemo<RemediationInput | null>(() => {
    if (!isAIProxyConfigured()) return null;
    if (remediationItems.length === 0) return null;
    return {
      blockers: remediationItems.map(item => ({
        type: item.name,
        affectedVMCount: item.affectedCount,
        details: item.description,
      })),
      migrationTarget: 'vsi',
    };
  }, [remediationItems]);

  // ===== VM DETAILS FOR BOM EXPORT =====
  const vmDetails = useMemo<VMDetail[]>(() => poweredOnVMs.map(vm => {
    const mapping = vmProfileMappings.find(m => m.vmName === vm.vmName);
    const vmDisks = disks.filter(d => d.vmName === vm.vmName);
    const sortedDisks = [...vmDisks].sort((a, b) => (a.diskKey || 0) - (b.diskKey || 0));
    const bootDisk = sortedDisks[0];
    const dataDisks = sortedDisks.slice(1);
    const isWindows = vm.guestOS.toLowerCase().includes('windows');
    const bootVolumeGiB = bootDisk
      ? Math.max(Math.round(mibToGiB(bootDisk.capacityMiB)), isWindows ? 120 : 100)
      : (isWindows ? 120 : 100);
    const dataVolumes = dataDisks.map(d => ({ sizeGiB: Math.round(mibToGiB(d.capacityMiB)) }));

    return {
      vmName: vm.vmName,
      guestOS: vm.guestOS,
      profile: mapping?.profile.name || 'bx2-2x8',
      vcpus: mapping?.profile.vcpus || vm.cpus,
      memoryGiB: mapping?.profile.memoryGiB || Math.round(mibToGiB(vm.memory)),
      bootVolumeGiB,
      dataVolumes,
    };
  }), [poweredOnVMs, vmProfileMappings, disks]);

  // Table columns
  type ProfileMappingRow = typeof vmProfileMappings[0];
  const profileMappingColumns: ColumnDef<ProfileMappingRow, unknown>[] = [
    { accessorKey: 'vmName', header: 'VM Name', enableSorting: true },
    { accessorKey: 'vcpus', header: 'Source vCPUs', enableSorting: true },
    { accessorKey: 'memoryGiB', header: 'Source Memory (GiB)', enableSorting: true },
    { accessorKey: 'nics', header: 'NICs', enableSorting: true },
    {
      id: 'recommendation',
      header: 'Recommendation',
      enableSorting: true,
      accessorFn: (row) => row.classification.recommendation,
      cell: ({ row }) => {
        const { recommendation, reasons } = row.original.classification;
        const isBurstable = recommendation === 'burstable';
        const currentIsBurstable = isBurstableProfile(row.original.profile.name);
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
            <Tag
              type={isBurstable ? 'cyan' : 'purple'}
              size="sm"
              title={row.original.classification.note}
            >
              {isBurstable ? 'Burstable' : 'Standard'}
            </Tag>
            {!isBurstable && reasons.length > 0 && (
              <Tag type="gray" size="sm" title={reasons.join(', ')}>
                {reasons[0]}
              </Tag>
            )}
            {currentIsBurstable !== isBurstable && row.original.isOverridden && (
              <Tag type="teal" size="sm">Override</Tag>
            )}
            {aiRecommendations[row.original.vmName]?.source === 'ai' && (() => {
              const aiRec = aiRecommendations[row.original.vmName];
              const tooltipText = aiRec.reasoning + (aiRec.isOverprovisioned ? ' (Overprovisioned)' : '');
              return (
                <>
                  <Tooltip label={tooltipText} align="bottom">
                    <button type="button" style={{ all: 'unset', cursor: 'help' }}>
                      <Tag type="purple" size="sm">AI: {aiRec.recommendedProfile}</Tag>
                    </button>
                  </Tooltip>
                  {aiRec.isOverprovisioned && (
                    <Tag type="warm-gray" size="sm">Overprovisioned</Tag>
                  )}
                </>
              );
            })()}
          </span>
        );
      },
    },
    {
      id: 'profile', header: 'Target Profile', enableSorting: true,
      accessorFn: (row) => row.profile.name,
      cell: ({ row }) => (
        <ProfileSelector
          vmName={row.original.vmName}
          autoMappedProfile={row.original.autoProfile.name}
          currentProfile={row.original.profile.name}
          isOverridden={row.original.isOverridden}
          customProfiles={customProfiles}
          onProfileChange={(vmName, newProfile, originalProfile) => setProfileOverride(vmName, newProfile, originalProfile)}
          onResetToAuto={removeProfileOverride}
          compact
        />
      ),
    },
    {
      id: 'profileVcpus',
      header: 'Target vCPUs',
      enableSorting: true,
      accessorFn: (row) => row.profile.vcpus,
      cell: ({ row }) => {
        const source = row.original.vcpus;
        const target = row.original.profile.vcpus;
        const diff = target - source;
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {target}
            {diff > 0 && <ArrowUp size={16} style={{ color: '#24a148' }} />}
            {diff < 0 && <ArrowDown size={16} style={{ color: '#da1e28' }} />}
          </span>
        );
      },
    },
    {
      id: 'profileMemory',
      header: 'Target Memory (GiB)',
      enableSorting: true,
      accessorFn: (row) => row.profile.memoryGiB,
      cell: ({ row }) => {
        const source = row.original.memoryGiB;
        const target = row.original.profile.memoryGiB;
        const diff = target - source;
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {target}
            {diff > 0 && <ArrowUp size={16} style={{ color: '#24a148' }} />}
            {diff < 0 && <ArrowDown size={16} style={{ color: '#da1e28' }} />}
          </span>
        );
      },
    },
  ];

  // Early return if no data - placed after all hooks
  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  return (
    <div className="migration-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="migration-page__title">VSI Migration</h1>
          <p className="migration-page__subtitle">IBM Cloud VPC Virtual Server Instance migration assessment and sizing</p>
        </Column>

        {/* Readiness Score */}
        <Column lg={4} md={4} sm={4}>
          <Tile className="migration-page__score-tile">
            <div className="migration-page__score-header">
              <span className="migration-page__score-label">Readiness Score</span>
              <Tooltip
                label={
                  <span>
                    Measures migration readiness based on pre-flight check results.
                    <br /><br />
                    <strong>Scoring:</strong>
                    <br />• Blockers: -50 points per affected VM
                    <br />• Warnings: -30 points per affected VM
                    <br />• Unsupported OS: -20 points per VM
                    <br /><br />
                    <strong>Thresholds:</strong>
                    <br />• Green (≥80%): Ready for migration
                    <br />• Orange (60-79%): Preparation needed
                    <br />• Red (&lt;60%): Blockers must be resolved
                  </span>
                }
                align="bottom"
              >
                <button type="button" className="migration-page__score-info-button" aria-label="More information about Readiness Score">
                  <Information size={16} aria-hidden="true" />
                </button>
              </Tooltip>
            </div>
            <span className={`migration-page__score-value migration-page__score-value--${readinessScore >= 80 ? 'good' : readinessScore >= 60 ? 'warning' : 'critical'}`}>
              {readinessScore}%
            </span>
            <span className="migration-page__score-detail">
              {blockerCount > 0 ? `${blockerCount} blocker${blockerCount !== 1 ? 's' : ''} found` : readinessScore >= 80 ? 'Ready for migration' : 'Preparation needed'}
            </span>
          </Tile>
        </Column>

        {/* Quick Stats */}
        <Column lg={4} md={4} sm={2}>
          <MetricCard label="VMs to Migrate" value={formatNumber(poweredOnVMs.length)} variant="primary" tooltip="Total powered-on VMs eligible for migration." />
        </Column>
        <Column lg={4} md={4} sm={2}>
          <MetricCard label="Blockers" value={formatNumber(blockerCount)} variant={blockerCount > 0 ? 'error' : 'success'} tooltip="Critical issues that prevent migration." />
        </Column>
        <Column lg={4} md={4} sm={2}>
          <MetricCard label="Warnings" value={formatNumber(warningCount)} variant={warningCount > 0 ? 'warning' : 'success'} tooltip="Non-blocking issues to review." />
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
              <Tab>AI Insights</Tab>
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
                          <Tag type={preflightCounts.vmsWithoutTools === 0 ? 'green' : 'magenta'}>{formatNumber(preflightCounts.vmsWithoutTools)}</Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Tools Not Running</span>
                          <Tag type={vmsWithToolsNotRunning === 0 ? 'green' : 'teal'}>{formatNumber(vmsWithToolsNotRunning)}</Tag>
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
                          <Tag type={vmsWithSnapshots === 0 ? 'green' : 'teal'}>{formatNumber(vmsWithSnapshots)}</Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Old Snapshots (&gt;{SNAPSHOT_BLOCKER_AGE_DAYS} days)</span>
                          <Tag type={preflightCounts.vmsWithOldSnapshots === 0 ? 'green' : 'magenta'}>{formatNumber(preflightCounts.vmsWithOldSnapshots)}</Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Warning Snapshots ({SNAPSHOT_WARNING_AGE_DAYS}-{SNAPSHOT_BLOCKER_AGE_DAYS} days)</span>
                          <Tag type={vmsWithWarningSnapshots === 0 ? 'green' : 'teal'}>{formatNumber(vmsWithWarningSnapshots)}</Tag>
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
                          <Tag type={preflightCounts.vmsWithRDM === 0 ? 'green' : 'red'}>{formatNumber(preflightCounts.vmsWithRDM)}</Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>VMs with Shared Disks</span>
                          <Tag type={preflightCounts.vmsWithSharedDisks === 0 ? 'green' : 'red'}>{formatNumber(preflightCounts.vmsWithSharedDisks)}</Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Disks &gt;2TB</span>
                          <Tag type={preflightCounts.vmsWithLargeDisks === 0 ? 'green' : 'magenta'}>{formatNumber(preflightCounts.vmsWithLargeDisks)}</Tag>
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
                          <Tag type={(preflightCounts.vmsWithLargeMemory || 0) === 0 ? 'green' : 'magenta'}>{formatNumber((preflightCounts.vmsWithLargeMemory || 0) - (preflightCounts.vmsWithVeryLargeMemory || 0))}</Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Memory &gt;1TB (Blocker)</span>
                          <Tag type={(preflightCounts.vmsWithVeryLargeMemory || 0) === 0 ? 'green' : 'red'}>{formatNumber(preflightCounts.vmsWithVeryLargeMemory || 0)}</Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Boot Disk &lt;10GB</span>
                          <Tag type={(preflightCounts.vmsWithSmallBootDisk || 0) === 0 ? 'green' : 'red'}>{formatNumber(preflightCounts.vmsWithSmallBootDisk || 0)}</Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Boot Disk &gt;250GB</span>
                          <Tag type={(preflightCounts.vmsWithLargeBootDisk || 0) === 0 ? 'green' : 'red'}>{formatNumber(preflightCounts.vmsWithLargeBootDisk || 0)}</Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>&gt;12 Disks per VM</span>
                          <Tag type={(preflightCounts.vmsWithTooManyDisks || 0) === 0 ? 'green' : 'red'}>{formatNumber(preflightCounts.vmsWithTooManyDisks || 0)}</Tag>
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
                          <Tag type={hwVersionCounts.outdated === 0 ? 'green' : 'magenta'}>{formatNumber(hwVersionCounts.outdated)}</Tag>
                        </div>
                      </div>
                    </Tile>
                  </Column>

                  <Column lg={16} md={8} sm={4}>
                    <RemediationPanel items={remediationItems} title="Remediation" showAffectedVMs={true} />
                  </Column>

                  <Column lg={16} md={8} sm={4}>
                    <AIRemediationPanel data={remediationAIData} title="AI Remediation Guidance (VSI)" />
                  </Column>
                </Grid>
              </TabPanel>

              {/* Sizing Panel */}
              <TabPanel>
                <Grid className="migration-page__tab-content">
                  <Column lg={16} md={8} sm={4}>
                    <Tile className="migration-page__sizing-header">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                          <h3>VPC Virtual Server Instance Mapping</h3>
                          <p>Best-fit IBM Cloud VPC VSI profiles for {formatNumber(totalVSIs)} VMs</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <Button kind="tertiary" size="sm" renderIcon={Settings} onClick={() => setShowCustomProfileEditor(true)}>
                            Custom Profiles {customProfiles.length > 0 && `(${customProfiles.length})`}
                          </Button>
                          {overriddenVMCount > 0 && (
                            <Button kind="ghost" size="sm" renderIcon={Reset} onClick={clearAllOverrides}>Clear All Overrides</Button>
                          )}
                        </div>
                      </div>
                    </Tile>
                  </Column>

                  {overriddenVMCount > 0 && (
                    <Column lg={16} md={8} sm={4}>
                      <InlineNotification kind="info" title="Profile Overrides Active" subtitle={`${overriddenVMCount} VM${overriddenVMCount !== 1 ? 's have' : ' has'} custom profile assignments.`} lowContrast hideCloseButton />
                    </Column>
                  )}

                  <Column lg={4} md={4} sm={2}>
                    <MetricCard label="Total VSIs" value={formatNumber(totalVSIs)} variant="primary" tooltip="Number of VPC Virtual Server Instances needed." />
                  </Column>
                  <Column lg={4} md={4} sm={2}>
                    <MetricCard label="Unique Profiles" value={formatNumber(uniqueProfiles)} variant="info" tooltip="Number of distinct VSI profile types." />
                  </Column>
                  <Column lg={4} md={4} sm={2}>
                    <MetricCard label="Total vCPUs" value={formatNumber(vsiTotalVCPUs)} variant="teal" tooltip="Sum of vCPUs across all recommended VSI profiles." />
                  </Column>
                  <Column lg={4} md={4} sm={2}>
                    <MetricCard label="Total Memory" value={`${formatNumber(vsiTotalMemory)} GiB`} variant="purple" tooltip="Sum of memory across all recommended VSI profiles." />
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="migration-page__chart-tile">
                      <DoughnutChart title="Profile Family Distribution" subtitle="VMs by instance family type" data={familyChartData} height={280} colors={['#0f62fe', '#8a3ffc', '#009d9a']} formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`} />
                    </Tile>
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="migration-page__chart-tile">
                      <HorizontalBarChart title="Top 10 Recommended Profiles" subtitle="Most frequently mapped VSI profiles" data={topProfiles} height={280} valueLabel="VMs" formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`} />
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
                        <div className="migration-page__recommendation-item">
                          <span className="migration-page__recommendation-key">Burstable (bxf, cxf, mxf)</span>
                          <span className="migration-page__recommendation-value">Flex profiles with burstable CPU - Cost-effective for variable workloads that don't require sustained high CPU performance. Not recommended for enterprise apps, network appliances, or VMs with multiple NICs.</span>
                        </div>
                      </div>
                    </Tile>
                  </Column>

                  <Column lg={16} md={8} sm={4}>
                    <Tile className="migration-page__cost-tile">
                      <h4>Cost Estimation</h4>
                      <p className="migration-page__cost-description">Estimate costs for {formatNumber(totalVSIs)} VPC Virtual Server Instances.</p>
                      <RedHatDocLink href="https://cloud.ibm.com/vpc-ext/provision/vs" label="Open IBM Cloud VPC Catalog" description="Configure and estimate costs for VPC virtual servers" />
                    </Tile>
                  </Column>

                  <Column lg={16} md={8} sm={4}>
                    <Tile className="migration-page__table-tile">
                      <EnhancedDataTable data={vmProfileMappings} columns={profileMappingColumns} title="VM to VSI Profile Mapping" description="Click the edit icon to override the auto-mapped profile." enableSearch enablePagination enableSorting enableExport enableColumnVisibility defaultPageSize={25} exportFilename="vm-profile-mapping" />
                    </Tile>
                  </Column>
                </Grid>
              </TabPanel>

              {/* Cost Estimation Panel */}
              <TabPanel>
                <Grid className="migration-page__tab-content">
                  <Column lg={16} md={8} sm={4}>
                    <CostEstimation type="vsi" vsiSizing={vsiSizing} vmDetails={vmDetails} title="VPC VSI Cost Estimation" />
                  </Column>
                  <Column lg={16} md={8} sm={4}>
                    <AICostAnalysisPanel data={costOptimizationData} title="AI Cost Optimization (VSI)" />
                  </Column>
                </Grid>
              </TabPanel>

              {/* Wave Planning Panel - Using shared component */}
              <TabPanel>
                <WavePlanningPanel
                  mode="vsi"
                  wavePlanningMode={wavePlanning.wavePlanningMode}
                  networkGroupBy={wavePlanning.networkGroupBy}
                  onWavePlanningModeChange={wavePlanning.setWavePlanningMode}
                  onNetworkGroupByChange={wavePlanning.setNetworkGroupBy}
                  networkWaves={wavePlanning.networkWaves}
                  complexityWaves={wavePlanning.complexityWaves}
                  waveChartData={wavePlanning.waveChartData}
                  waveResources={wavePlanning.waveResources}
                  vmDetails={vmDetails}
                />
                <div style={{ marginTop: '1rem' }}>
                  <AIWaveAnalysisPanel data={waveSuggestionData} title="AI Wave Analysis (VSI)" />
                </div>
              </TabPanel>

              {/* OS Compatibility Panel - Using shared component */}
              <TabPanel>
                <OSCompatibilityPanel mode="vsi" osStatusCounts={osStatusCounts} vms={poweredOnVMs} />
              </TabPanel>

              {/* Complexity Panel - Using shared component */}
              <TabPanel>
                <ComplexityAssessmentPanel
                  mode="vsi"
                  complexityScores={complexityScores}
                  chartData={complexityChartData}
                  topComplexVMs={topComplexVMs}
                />
              </TabPanel>

              {/* AI Insights Panel */}
              <TabPanel>
                <Grid className="migration-page__tab-content">
                  <Column lg={16} md={8} sm={4}>
                    <AIInsightsPanel data={insightsData} title="AI Migration Insights (VSI)" />
                  </Column>
                </Grid>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Column>
      </Grid>

      {/* Custom Profile Editor Modal - Lazy loaded */}
      {showCustomProfileEditor && (
        <Suspense fallback={<Loading description="Loading profile editor..." withOverlay />}>
          <CustomProfileEditor
            isOpen={showCustomProfileEditor}
            onClose={() => setShowCustomProfileEditor(false)}
            customProfiles={customProfiles}
            onAddProfile={addCustomProfile}
            onUpdateProfile={updateCustomProfile}
            onRemoveProfile={removeCustomProfile}
          />
        </Suspense>
      )}
    </div>
  );
}
