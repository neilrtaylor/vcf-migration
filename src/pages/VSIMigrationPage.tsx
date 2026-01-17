// VSI (IBM Cloud VPC Virtual Server) Migration page - Refactored with shared hooks and components

import { useState, useMemo, lazy, Suspense } from 'react';
import { Grid, Column, Tile, Tag, Tabs, TabList, Tab, TabPanels, TabPanel, Button, InlineNotification, Loading } from '@carbon/react';
import { Navigate } from 'react-router-dom';
import { Settings, Reset } from '@carbon/icons-react';
import { useData, useVMs, useCustomProfiles, usePreflightChecks, useMigrationAssessment, useWavePlanning } from '@/hooks';
import { ROUTES, HW_VERSION_MINIMUM, HW_VERSION_RECOMMENDED, SNAPSHOT_WARNING_AGE_DAYS, SNAPSHOT_BLOCKER_AGE_DAYS } from '@/utils/constants';
import { formatNumber, mibToGiB } from '@/utils/formatters';
import { DoughnutChart, HorizontalBarChart } from '@/components/charts';
import { EnhancedDataTable } from '@/components/tables';
import type { ColumnDef } from '@tanstack/react-table';
import { MetricCard, RedHatDocLink, RemediationPanel } from '@/components/common';
import { CostEstimation } from '@/components/cost';
import { ProfileSelector } from '@/components/sizing';
import { ComplexityAssessmentPanel, WavePlanningPanel, OSCompatibilityPanel } from '@/components/migration';

// Lazy load CustomProfileEditor - only loaded when user opens the modal
const CustomProfileEditor = lazy(() =>
  import('@/components/sizing/CustomProfileEditor').then(m => ({ default: m.CustomProfileEditor }))
);
import type { VSISizingInput } from '@/services/costEstimation';
import type { VMDetail } from '@/services/export';
import { mapVMToVSIProfile, getVSIProfiles } from '@/services/migration';
import './MigrationPage.scss';

export function VSIMigrationPage() {
  const { rawData } = useData();
  const vms = useVMs();
  const [showCustomProfileEditor, setShowCustomProfileEditor] = useState(false);

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

  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  const poweredOnVMs = vms.filter(vm => vm.powerState === 'poweredOn');
  const snapshots = rawData.vSnapshot;
  const tools = rawData.vTools;
  const disks = rawData.vDisk;
  const networks = rawData.vNetwork;

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

  // ===== VPC VSI PROFILE MAPPING =====
  const vsiProfiles = getVSIProfiles();

  const vmProfileMappings = useMemo(() => poweredOnVMs.map(vm => {
    const autoProfile = mapVMToVSIProfile(vm.cpus, mibToGiB(vm.memory));
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
        const standardProfile = allProfiles.find(p => p.name === effectiveProfileName);
        if (standardProfile) effectiveProfile = standardProfile;
      }
    }

    return {
      vmName: vm.vmName,
      vcpus: vm.cpus,
      memoryGiB: Math.round(mibToGiB(vm.memory)),
      autoProfile,
      profile: effectiveProfile,
      effectiveProfileName,
      isOverridden,
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
    const totalStorageGiB = disks.reduce((sum, d) => sum + mibToGiB(d.capacityMiB), 0);
    const profileGroupings = vmProfileMappings.reduce((acc, mapping) => {
      acc[mapping.profile.name] = (acc[mapping.profile.name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const vmProfiles = Object.entries(profileGroupings).map(([profile, count]) => ({ profile, count }));
    return { vmProfiles, storageTiB: Math.ceil(totalStorageGiB / 1024) };
  }, [vmProfileMappings, disks]);

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
    { id: 'profileVcpus', header: 'Target vCPUs', enableSorting: true, accessorFn: (row) => row.profile.vcpus },
    { id: 'profileMemory', header: 'Target Memory (GiB)', enableSorting: true, accessorFn: (row) => row.profile.memoryGiB },
  ];

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
            <span className="migration-page__score-label">Readiness Score</span>
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

                  {remediationItems.length > 0 && (
                    <Column lg={16} md={8} sm={4}>
                      <RemediationPanel items={remediationItems} title="Remediation Required" showAffectedVMs={true} />
                    </Column>
                  )}
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
                />
              </TabPanel>

              {/* OS Compatibility Panel - Using shared component */}
              <TabPanel>
                <OSCompatibilityPanel mode="vsi" osStatusCounts={osStatusCounts} />
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
