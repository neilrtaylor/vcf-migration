// ROKS (OpenShift Virtualization) Migration page - Refactored with shared hooks and components

import { useState, useCallback, useMemo } from 'react';
import { Grid, Column, Tile, Tag, Tabs, TabList, Tab, TabPanels, TabPanel, UnorderedList, ListItem, Button, InlineNotification } from '@carbon/react';
import { Download } from '@carbon/icons-react';
import { Navigate } from 'react-router-dom';
import { useData, useVMs, usePreflightChecks, useMigrationAssessment, useWavePlanning } from '@/hooks';
import { ROUTES, SNAPSHOT_WARNING_AGE_DAYS, SNAPSHOT_BLOCKER_AGE_DAYS, HW_VERSION_MINIMUM, HW_VERSION_RECOMMENDED } from '@/utils/constants';
import { formatNumber, mibToGiB } from '@/utils/formatters';
import { MetricCard, RedHatDocLink, RemediationPanel } from '@/components/common';
import { SizingCalculator } from '@/components/sizing';
import type { SizingResult } from '@/components/sizing';
import { CostEstimation } from '@/components/cost';
import { ComplexityAssessmentPanel, WavePlanningPanel, OSCompatibilityPanel } from '@/components/migration';
import type { ROKSSizingInput } from '@/services/costEstimation';
import type { ROKSNodeDetail } from '@/services/export';
import { MTVYAMLGenerator, downloadBlob } from '@/services/export';
import type { MTVExportOptions } from '@/types/mtvYaml';
import mtvRequirements from '@/data/mtvRequirements.json';
import './MigrationPage.scss';

export function ROKSMigrationPage() {
  const { rawData } = useData();
  const vms = useVMs();
  const [yamlExporting, setYamlExporting] = useState(false);
  const [yamlExportSuccess, setYamlExportSuccess] = useState(false);
  const [calculatorSizing, setCalculatorSizing] = useState<SizingResult | null>(null);

  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  const poweredOnVMs = vms.filter(vm => vm.powerState === 'poweredOn');
  const snapshots = rawData.vSnapshot;
  const tools = rawData.vTools;
  const cdDrives = rawData.vCD;
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
    mode: 'roks',
    vms: poweredOnVMs,
    allVms: vms,
    disks: disks,
    snapshots: snapshots,
    tools: tools,
    networks: networks,
    cdDrives: cdDrives,
    cpuInfo: rawData.vCPU,
    memoryInfo: rawData.vMemory,
  });

  // Additional display-only counts
  const vmsWithSnapshots = new Set(snapshots.map(s => s.vmName)).size;
  const vmsWithWarningSnapshots = new Set(
    snapshots.filter(s => s.ageInDays > SNAPSHOT_WARNING_AGE_DAYS && s.ageInDays <= SNAPSHOT_BLOCKER_AGE_DAYS).map(s => s.vmName)
  ).size;
  const vmsWithOutdatedTools = poweredOnVMs.filter(vm => {
    const tool = tools.find(t => t.vmName === vm.vmName);
    return tool && tool.toolsStatus === 'toolsOld';
  }).length;

  // ===== MIGRATION ASSESSMENT (using hook) =====
  const {
    complexityScores,
    readinessScore,
    chartData: complexityChartData,
    topComplexVMs,
    osStatusCounts,
  } = useMigrationAssessment({
    mode: 'roks',
    vms: poweredOnVMs,
    disks: disks,
    networks: networks,
    blockerCount,
    warningCount,
  });

  // ===== WAVE PLANNING (using hook) =====
  const wavePlanning = useWavePlanning({
    mode: 'roks',
    vms: poweredOnVMs,
    complexityScores,
    disks: disks,
    snapshots: snapshots,
    tools: tools,
    networks: networks,
  });

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

      const waveExportData = wavePlanning.activeWaves
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
  }, [wavePlanning.activeWaves, poweredOnVMs, networks, rawData.vDatastore]);

  // ===== COST ESTIMATION SIZING =====
  const roksSizing = useMemo<ROKSSizingInput>(() => {
    if (calculatorSizing) {
      return {
        computeNodes: calculatorSizing.computeNodes,
        computeProfile: calculatorSizing.computeProfile,
        useNvme: calculatorSizing.useNvme,
        storageTiB: calculatorSizing.storageTiB,
      };
    }

    const totalStorageGiB = poweredOnVMs.reduce((sum, vm) => sum + mibToGiB(vm.inUseMiB), 0);
    return {
      computeNodes: 3,
      computeProfile: 'mx2d.metal.96x768',
      useNvme: true,
      storageTiB: Math.ceil(totalStorageGiB / 1024),
    };
  }, [calculatorSizing, poweredOnVMs]);

  const roksNodeDetails = useMemo<ROKSNodeDetail[]>(() => {
    const nodes: ROKSNodeDetail[] = [];
    for (let i = 0; i < roksSizing.computeNodes; i++) {
      nodes.push({ nodeName: `worker-${i + 1}`, profile: roksSizing.computeProfile, nodeType: 'worker' });
    }
    if (!roksSizing.useNvme && roksSizing.storageNodes && roksSizing.storageProfile) {
      for (let i = 0; i < roksSizing.storageNodes; i++) {
        nodes.push({ nodeName: `storage-${i + 1}`, profile: roksSizing.storageProfile, nodeType: 'storage' });
      }
    }
    return nodes;
  }, [roksSizing]);

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
          <MetricCard label="VMs to Migrate" value={formatNumber(poweredOnVMs.length)} variant="primary" tooltip="Total powered-on VMs eligible for migration." />
        </Column>
        <Column lg={4} md={4} sm={2}>
          <MetricCard label="Blockers" value={formatNumber(blockerCount)} variant={blockerCount > 0 ? 'error' : 'success'} tooltip="Critical issues that must be resolved before migration." />
        </Column>
        <Column lg={4} md={4} sm={2}>
          <MetricCard label="Warnings" value={formatNumber(warningCount)} variant={warningCount > 0 ? 'warning' : 'success'} tooltip="Non-blocking issues that should be reviewed." />
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
                          <Tag type={preflightCounts.vmsWithoutTools === 0 ? 'green' : 'red'}>{formatNumber(preflightCounts.vmsWithoutTools)}</Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Tools Not Running</span>
                          <Tag type={preflightCounts.vmsWithToolsNotRunning === 0 ? 'green' : 'magenta'}>{formatNumber(preflightCounts.vmsWithToolsNotRunning)}</Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Tools Outdated</span>
                          <Tag type={vmsWithOutdatedTools === 0 ? 'green' : 'teal'}>{formatNumber(vmsWithOutdatedTools)}</Tag>
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
                          <Tag type={preflightCounts.vmsWithOldSnapshots === 0 ? 'green' : 'red'}>{formatNumber(preflightCounts.vmsWithOldSnapshots)}</Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Warning Snapshots ({SNAPSHOT_WARNING_AGE_DAYS}-{SNAPSHOT_BLOCKER_AGE_DAYS} days)</span>
                          <Tag type={vmsWithWarningSnapshots === 0 ? 'green' : 'magenta'}>{formatNumber(vmsWithWarningSnapshots)}</Tag>
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
                          <span>CD-ROM Connected</span>
                          <Tag type={(preflightCounts.vmsWithCdConnected || 0) === 0 ? 'green' : 'magenta'}>{formatNumber(preflightCounts.vmsWithCdConnected || 0)}</Tag>
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
                          <Tag type={hwVersionCounts.outdated === 0 ? 'green' : 'red'}>{formatNumber(hwVersionCounts.outdated)}</Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Legacy NICs (E1000)</span>
                          <Tag type={(preflightCounts.vmsWithLegacyNIC || 0) === 0 ? 'green' : 'teal'}>{formatNumber(preflightCounts.vmsWithLegacyNIC || 0)}</Tag>
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
                          <Tag type={(preflightCounts.vmsWithoutCBT || 0) === 0 ? 'green' : 'magenta'}>{formatNumber(preflightCounts.vmsWithoutCBT || 0)}</Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Independent Disks (Blocker)</span>
                          <Tag type={(preflightCounts.vmsWithIndependentDisks || 0) === 0 ? 'green' : 'red'}>{formatNumber(preflightCounts.vmsWithIndependentDisks || 0)}</Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Static IP + Powered Off</span>
                          <Tag type={(preflightCounts.vmsStaticIPPoweredOff || 0) === 0 ? 'green' : 'magenta'}>{formatNumber(preflightCounts.vmsStaticIPPoweredOff || 0)}</Tag>
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
                          <Tag type={(preflightCounts.vmsWithInvalidNames || 0) === 0 ? 'green' : 'magenta'}>{formatNumber(preflightCounts.vmsWithInvalidNames || 0)}</Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>CPU Hot Plug Enabled</span>
                          <Tag type={(preflightCounts.vmsWithCPUHotPlug || 0) === 0 ? 'green' : 'teal'}>{formatNumber(preflightCounts.vmsWithCPUHotPlug || 0)}</Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Memory Hot Plug Enabled</span>
                          <Tag type={(preflightCounts.vmsWithMemoryHotPlug || 0) === 0 ? 'green' : 'teal'}>{formatNumber(preflightCounts.vmsWithMemoryHotPlug || 0)}</Tag>
                        </div>
                        <div className="migration-page__check-item">
                          <span>Hostname Missing/Invalid</span>
                          <Tag type={(preflightCounts.vmsWithInvalidHostname || 0) === 0 ? 'green' : 'magenta'}>{formatNumber(preflightCounts.vmsWithInvalidHostname || 0)}</Tag>
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
                      <h3>ROKS Bare Metal Cluster Sizing</h3>
                      <p>Interactive sizing calculator for OpenShift Virtualization with ODF storage on NVMe drives.</p>
                    </Tile>
                  </Column>
                  <Column lg={16} md={8} sm={4}>
                    <SizingCalculator onSizingChange={setCalculatorSizing} />
                  </Column>
                  <Column lg={16} md={8} sm={4}>
                    <Tile className="migration-page__cost-tile">
                      <h4>Important Notes</h4>
                      <p className="migration-page__cost-description">
                        • OpenShift Virtualization requires bare metal worker nodes with hardware virtualization<br />
                        • Memory overcommitment is NOT recommended for VMs - total memory becomes the leading sizing factor<br />
                        • ODF with 3-way replication provides data protection; 75% operational capacity ensures room for rebalancing
                      </p>
                      <RedHatDocLink href="https://cloud.ibm.com/kubernetes/catalog/create?platformType=openshift" label="Open IBM Cloud ROKS Catalog" description="Configure your bare metal OpenShift cluster" />
                    </Tile>
                  </Column>
                </Grid>
              </TabPanel>

              {/* Cost Estimation Panel */}
              <TabPanel>
                <Grid className="migration-page__tab-content">
                  <Column lg={16} md={8} sm={4}>
                    <CostEstimation type="roks" roksSizing={roksSizing} roksNodeDetails={roksNodeDetails} title="ROKS Cluster Cost Estimation" />
                  </Column>
                  <Column lg={16} md={8} sm={4}>
                    <Tile className="migration-page__cost-tile">
                      <h4>Cost Estimation Notes</h4>
                      <p className="migration-page__cost-description">
                        • Based on {roksSizing.computeNodes} {roksSizing.computeProfile} bare metal nodes with local NVMe storage<br />
                        • 1-year reserved capacity provides 20% discount, 3-year provides 35% discount
                      </p>
                      <RedHatDocLink href="https://cloud.ibm.com/estimator" label="Open IBM Cloud Cost Estimator" description="Create a detailed cost estimate" />
                    </Tile>
                  </Column>
                </Grid>
              </TabPanel>

              {/* Wave Planning Panel - Using shared component */}
              <TabPanel>
                <WavePlanningPanel
                  mode="roks"
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
                <OSCompatibilityPanel mode="roks" osStatusCounts={osStatusCounts} />
              </TabPanel>

              {/* Complexity Panel - Using shared component */}
              <TabPanel>
                <ComplexityAssessmentPanel
                  mode="roks"
                  complexityScores={complexityScores}
                  chartData={complexityChartData}
                  topComplexVMs={topComplexVMs}
                />
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
                        <Button kind="primary" size="md" renderIcon={Download} onClick={handleYAMLExport} disabled={yamlExporting || poweredOnVMs.length === 0}>
                          {yamlExporting ? 'Generating...' : 'Export MTV YAML'}
                        </Button>
                      </div>
                      {yamlExportSuccess && (
                        <InlineNotification kind="success" title="Export complete" subtitle="MTV YAML templates downloaded." lowContrast hideCloseButton style={{ marginTop: '1rem' }} />
                      )}
                      <div className="migration-page__workflow-docs">
                        <RedHatDocLink href="https://docs.openshift.com/container-platform/latest/virt/virtual_machines/importing_vms/virt-importing-vmware-vm.html" label="Official MTV Documentation" description="Complete guide to importing VMware VMs" />
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
                        <RedHatDocLink href="https://github.com/RedHatQuickCourses/architect-the-ocpvirt" label="Architecture Course" description="Red Hat Quick Course - Architect OpenShift Virtualization" />
                        <RedHatDocLink href="https://github.com/RedHatQuickCourses/ocpvirt-migration" label="Migration Course" description="Red Hat Quick Course - OpenShift Virtualization Migration" />
                        <RedHatDocLink href="https://access.redhat.com/articles/973163" label="RHEL Life Cycle" description="Red Hat Enterprise Linux Life Cycle dates" />
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
