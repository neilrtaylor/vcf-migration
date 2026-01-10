// Dashboard page - Executive summary
import { Grid, Column, Tile, Tag, Tooltip } from '@carbon/react';
import { Information } from '@carbon/icons-react';
import { useData, useVMs, useChartFilter } from '@/hooks';
import { Navigate } from 'react-router-dom';
import { ROUTES, HW_VERSION_MINIMUM, SNAPSHOT_BLOCKER_AGE_DAYS } from '@/utils/constants';
import { formatNumber, mibToGiB, mibToTiB, getHardwareVersionNumber, formatHardwareVersion } from '@/utils/formatters';
import { DoughnutChart, HorizontalBarChart, VerticalBarChart } from '@/components/charts';
import { FilterBadge, MetricCard } from '@/components/common';
import { POWER_STATE_CHART_COLORS } from '@/utils/chartConfig';
import './DashboardPage.scss';

// Map label to power state
const labelToPowerState: Record<string, string> = {
  'Powered On': 'poweredOn',
  'Powered Off': 'poweredOff',
  'Suspended': 'suspended',
};

export function DashboardPage() {
  const { rawData } = useData();
  const vms = useVMs();
  const { chartFilter, setFilter, clearFilter } = useChartFilter();

  // Redirect to landing if no data
  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  // Calculate basic metrics
  const totalVMs = vms.length;
  const poweredOnVMs = vms.filter(vm => vm.powerState === 'poweredOn').length;
  const poweredOffVMs = vms.filter(vm => vm.powerState === 'poweredOff').length;
  const suspendedVMs = vms.filter(vm => vm.powerState === 'suspended').length;
  const templates = rawData.vInfo.filter(vm => vm.template).length;

  const totalVCPUs = vms.reduce((sum, vm) => sum + vm.cpus, 0);
  const totalMemoryMiB = vms.reduce((sum, vm) => sum + vm.memory, 0);
  const totalMemoryGiB = mibToGiB(totalMemoryMiB);
  const totalMemoryTiB = mibToTiB(totalMemoryMiB);

  const totalProvisionedMiB = vms.reduce((sum, vm) => sum + vm.provisionedMiB, 0);
  const totalProvisionedTiB = mibToTiB(totalProvisionedMiB);
  const totalInUseMiB = vms.reduce((sum, vm) => sum + vm.inUseMiB, 0);
  const totalInUseTiB = mibToTiB(totalInUseMiB);

  const uniqueClusters = new Set(vms.map(vm => vm.cluster).filter(Boolean)).size;
  const uniqueDatacenters = new Set(vms.map(vm => vm.datacenter).filter(Boolean)).size;

  // Cluster metrics from vHost data
  const hosts = rawData.vHost || [];
  const clusterData = new Map<string, { vmCount: number; totalCores: number; vmCpus: number; hostMemoryMiB: number; vmMemoryMiB: number }>();

  // Aggregate host data by cluster
  hosts.forEach(host => {
    const cluster = host.cluster || 'No Cluster';
    if (!clusterData.has(cluster)) {
      clusterData.set(cluster, { vmCount: 0, totalCores: 0, vmCpus: 0, hostMemoryMiB: 0, vmMemoryMiB: 0 });
    }
    const data = clusterData.get(cluster)!;
    data.totalCores += host.totalCpuCores || 0;
    data.vmCpus += host.vmCpuCount || 0;
    data.hostMemoryMiB += host.memoryMiB || 0;
    data.vmMemoryMiB += host.vmMemoryMiB || 0;
  });

  // Count VMs per cluster
  vms.forEach(vm => {
    const cluster = vm.cluster || 'No Cluster';
    if (clusterData.has(cluster)) {
      clusterData.get(cluster)!.vmCount++;
    } else {
      clusterData.set(cluster, { vmCount: 1, totalCores: 0, vmCpus: 0, hostMemoryMiB: 0, vmMemoryMiB: 0 });
    }
  });

  // VM distribution by cluster
  const vmsByClusterData = Array.from(clusterData.entries())
    .map(([cluster, data]) => ({ label: cluster, value: data.vmCount }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // CPU overcommitment by cluster
  const cpuOvercommitData = Array.from(clusterData.entries())
    .filter(([, data]) => data.totalCores > 0)
    .map(([cluster, data]) => ({
      label: cluster,
      value: parseFloat((data.vmCpus / data.totalCores).toFixed(2)),
    }))
    .sort((a, b) => b.value - a.value);

  // Memory overcommitment by cluster
  const memOvercommitData = Array.from(clusterData.entries())
    .filter(([, data]) => data.hostMemoryMiB > 0)
    .map(([cluster, data]) => ({
      label: cluster,
      value: parseFloat((data.vmMemoryMiB / data.hostMemoryMiB).toFixed(2)),
    }))
    .sort((a, b) => b.value - a.value);

  // Power state chart data
  const powerStateData = [
    { label: 'Powered On', value: poweredOnVMs },
    { label: 'Powered Off', value: poweredOffVMs },
    { label: 'Suspended', value: suspendedVMs },
  ].filter(d => d.value > 0);

  const powerStateColors = [
    POWER_STATE_CHART_COLORS.poweredOn,
    POWER_STATE_CHART_COLORS.poweredOff,
    POWER_STATE_CHART_COLORS.suspended,
  ];

  // Filter VMs based on active chart filter
  const filteredVMs = chartFilter && chartFilter.dimension === 'powerState'
    ? vms.filter(vm => vm.powerState === labelToPowerState[chartFilter.value])
    : vms;

  // OS distribution data (from filtered VMs)
  const osDistribution = filteredVMs.reduce((acc, vm) => {
    const os = vm.guestOS || 'Unknown';
    // Simplify OS names
    let category = os;
    if (os.toLowerCase().includes('windows server 2019')) category = 'Windows Server 2019';
    else if (os.toLowerCase().includes('windows server 2016')) category = 'Windows Server 2016';
    else if (os.toLowerCase().includes('windows server 2022')) category = 'Windows Server 2022';
    else if (os.toLowerCase().includes('windows server')) category = 'Windows Server (Other)';
    else if (os.toLowerCase().includes('windows 10')) category = 'Windows 10';
    else if (os.toLowerCase().includes('windows 11')) category = 'Windows 11';
    else if (os.toLowerCase().includes('rhel') || os.toLowerCase().includes('red hat')) category = 'RHEL';
    else if (os.toLowerCase().includes('centos')) category = 'CentOS';
    else if (os.toLowerCase().includes('ubuntu')) category = 'Ubuntu';
    else if (os.toLowerCase().includes('debian')) category = 'Debian';
    else if (os.toLowerCase().includes('sles') || os.toLowerCase().includes('suse')) category = 'SLES';
    else if (os.toLowerCase().includes('linux')) category = 'Linux (Other)';
    else if (os.toLowerCase().includes('freebsd')) category = 'FreeBSD';
    else if (!os || os === 'Unknown') category = 'Unknown';

    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const osChartData = Object.entries(osDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, value]) => ({ label, value }));

  // Click handler for power state chart
  const handlePowerStateClick = (label: string) => {
    if (chartFilter?.value === label && chartFilter?.dimension === 'powerState') {
      clearFilter();
    } else {
      setFilter('powerState', label, 'powerStateChart');
    }
  };

  // vCenter source info
  const vSources = rawData.vSource || [];

  // ===== CONFIGURATION ANALYSIS =====
  const tools = rawData.vTools || [];
  const snapshots = rawData.vSnapshot || [];
  const cdDrives = rawData.vCD || [];

  // VMware Tools status
  const toolsNotInstalled = tools.filter(t =>
    t.toolsStatus?.toLowerCase().includes('notinstalled')
  ).length;
  const toolsCurrent = tools.filter(t =>
    t.toolsStatus?.toLowerCase().includes('ok') ||
    t.toolsStatus?.toLowerCase() === 'toolsok'
  ).length;

  // Hardware version compliance
  const outdatedHWCount = vms.filter(vm =>
    getHardwareVersionNumber(vm.hardwareVersion) < HW_VERSION_MINIMUM
  ).length;

  // Snapshot issues
  const snapshotsBlockers = snapshots.filter(s => s.ageInDays > SNAPSHOT_BLOCKER_AGE_DAYS).length;
  const vmsWithSnapshots = new Set(snapshots.map(s => s.vmName)).size;

  // CD-ROM connected
  const vmsWithCdConnected = new Set(cdDrives.filter(cd => cd.connected).map(cd => cd.vmName)).size;

  // Consolidation needed
  const vmsNeedConsolidation = vms.filter(vm => vm.consolidationNeeded).length;

  // Count of issues (for summary)
  const configIssuesCount = toolsNotInstalled + snapshotsBlockers + vmsWithCdConnected + outdatedHWCount;

  // Hardware version distribution for chart
  const hwVersions = vms.reduce((acc, vm) => {
    const version = formatHardwareVersion(vm.hardwareVersion);
    acc[version] = (acc[version] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const hwVersionChartData = Object.entries(hwVersions)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => {
      const aNum = parseInt(a.label.replace('v', ''));
      const bNum = parseInt(b.label.replace('v', ''));
      return bNum - aNum;
    });

  // VMware Tools status distribution for chart
  const toolsStatusMap = tools.reduce((acc, t) => {
    const status = t.toolsStatus || 'unknown';
    const normalizedStatus = status.toLowerCase().includes('ok') ? 'Current' :
                            status.toLowerCase().includes('old') ? 'Outdated' :
                            status.toLowerCase().includes('notrunning') ? 'Not Running' :
                            status.toLowerCase().includes('notinstalled') ? 'Not Installed' : 'Unknown';
    acc[normalizedStatus] = (acc[normalizedStatus] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const toolsChartData = Object.entries(toolsStatusMap)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // Firmware type distribution for chart
  const firmwareDistribution = vms.reduce((acc, vm) => {
    const firmware = vm.firmwareType || 'BIOS';
    const normalizedFirmware = firmware.toLowerCase().includes('efi') ? 'UEFI' : 'BIOS';
    acc[normalizedFirmware] = (acc[normalizedFirmware] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const firmwareChartData = Object.entries(firmwareDistribution)
    .map(([label, value]) => ({ label, value }))
    .filter(d => d.value > 0);

  return (
    <div className="dashboard-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="dashboard-page__title">Executive Dashboard</h1>
          <p className="dashboard-page__subtitle">
            Overview of {rawData.metadata.fileName}
            {rawData.metadata.collectionDate && (
              <> collected on {rawData.metadata.collectionDate.toLocaleDateString()}</>
            )}
          </p>
          {chartFilter && chartFilter.dimension === 'powerState' && (
            <FilterBadge
              dimension="Power State"
              value={chartFilter.value}
              onClear={clearFilter}
            />
          )}
        </Column>

        {/* vCenter Source Info */}
        {vSources.length > 0 && (
          <Column lg={16} md={8} sm={4}>
            <Tile className="dashboard-page__source-tile">
              <h3 className="dashboard-page__source-title">Source Environment</h3>
              <div className="dashboard-page__source-grid">
                {vSources.map((source, idx) => (
                  <div key={idx} className="dashboard-page__source-item">
                    <div className="dashboard-page__source-row">
                      <span className="dashboard-page__source-label">vCenter Server:</span>
                      <span className="dashboard-page__source-value">{source.server}</span>
                    </div>
                    {source.version && (
                      <div className="dashboard-page__source-row">
                        <span className="dashboard-page__source-label">Version:</span>
                        <span className="dashboard-page__source-value">{source.version}{source.build ? ` (Build ${source.build})` : ''}</span>
                      </div>
                    )}
                    {source.fullName && (
                      <div className="dashboard-page__source-row">
                        <span className="dashboard-page__source-label">Product:</span>
                        <span className="dashboard-page__source-value">{source.fullName}</span>
                      </div>
                    )}
                    {source.ipAddress && (
                      <div className="dashboard-page__source-row">
                        <span className="dashboard-page__source-label">IP Address:</span>
                        <span className="dashboard-page__source-value">{source.ipAddress}</span>
                      </div>
                    )}
                    {source.apiVersion && (
                      <div className="dashboard-page__source-row">
                        <span className="dashboard-page__source-label">API Version:</span>
                        <span className="dashboard-page__source-value">{source.apiVersion}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Tile>
          </Column>
        )}

        {/* Key Metrics Row */}
        <Column lg={4} md={4} sm={4}>
          <MetricCard
            label="Total VMs"
            value={formatNumber(totalVMs)}
            detail={`${formatNumber(poweredOnVMs)} powered on`}
            variant="primary"
            tooltip="Count of all virtual machines in the environment, excluding templates."
            docSection="dashboard"
          />
        </Column>

        <Column lg={4} md={4} sm={4}>
          <MetricCard
            label="Total vCPUs"
            value={formatNumber(totalVCPUs)}
            detail={`Avg ${(totalVCPUs / totalVMs).toFixed(1)} per VM`}
            variant="info"
            tooltip="Sum of all virtual CPU cores allocated across all VMs."
            docSection="dashboard"
          />
        </Column>

        <Column lg={4} md={4} sm={4}>
          <MetricCard
            label="Total Memory"
            value={`${totalMemoryTiB.toFixed(1)} TiB`}
            detail={`Avg ${(totalMemoryGiB / totalVMs).toFixed(1)} GiB per VM`}
            variant="teal"
            tooltip="Total memory allocated to all VMs, displayed in TiB."
            docSection="dashboard"
          />
        </Column>

        <Column lg={4} md={4} sm={4}>
          <MetricCard
            label="Provisioned Storage"
            value={`${totalProvisionedTiB.toFixed(1)} TiB`}
            detail="Total allocated capacity"
            variant="purple"
            tooltip="Total storage capacity allocated (thin + thick provisioned) to VMs."
            docSection="dashboard"
          />
        </Column>

        {/* Storage metrics row - side by side */}
        <Column lg={4} md={4} sm={4}>
          <MetricCard
            label="In Use Storage"
            value={`${totalInUseTiB.toFixed(1)} TiB`}
            detail={`${((totalInUseMiB / totalProvisionedMiB) * 100).toFixed(0)}% of provisioned`}
            variant="purple"
            tooltip="Actual storage consumed by VMs on datastores."
            docSection="dashboard"
          />
        </Column>

        <Column lg={4} md={4} sm={4}>
          <MetricCard
            label="Storage Efficiency"
            value={`${((totalInUseMiB / totalProvisionedMiB) * 100).toFixed(0)}%`}
            detail={`${(totalProvisionedTiB - totalInUseTiB).toFixed(1)} TiB unallocated`}
            variant="success"
            tooltip="Percentage of provisioned storage that is actually in use. Higher values indicate less over-provisioning."
            docSection="dashboard"
          />
        </Column>

        {/* Spacer between primary and secondary metrics */}
        <Column lg={16} md={8} sm={4}>
          <div className="dashboard-page__section-divider" />
        </Column>

        {/* Secondary Metrics */}
        <Column lg={3} md={4} sm={2}>
          <MetricCard
            label="ESXi Hosts"
            value={formatNumber(rawData.vHost.length)}
            variant="default"
            tooltip="Total number of ESXi hypervisor hosts in the environment."
          />
        </Column>

        <Column lg={3} md={4} sm={2}>
          <MetricCard
            label="Clusters"
            value={formatNumber(uniqueClusters)}
            variant="default"
            tooltip="Number of distinct VMware clusters containing VMs."
            docSection="cluster"
          />
        </Column>

        <Column lg={3} md={4} sm={2}>
          <MetricCard
            label="Datacenters"
            value={formatNumber(uniqueDatacenters)}
            variant="default"
            tooltip="Number of distinct datacenters in the vCenter hierarchy."
          />
        </Column>

        <Column lg={3} md={4} sm={2}>
          <MetricCard
            label="Datastores"
            value={formatNumber(rawData.vDatastore.length)}
            variant="default"
            tooltip="Total number of storage datastores available to VMs."
            docSection="storage"
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Templates"
            value={formatNumber(templates)}
            variant="default"
            tooltip="VM templates (not counted in Total VMs) used for cloning new VMs."
          />
        </Column>

        {/* Charts */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="dashboard-page__chart-tile">
            <DoughnutChart
              title="Power State Distribution"
              subtitle="Click a segment to filter OS distribution"
              data={powerStateData}
              colors={powerStateColors}
              height={280}
              formatValue={(v) => `${v} VMs`}
              onSegmentClick={handlePowerStateClick}
            />
          </Tile>
        </Column>

        <Column lg={8} md={8} sm={4}>
          <Tile className="dashboard-page__chart-tile">
            <HorizontalBarChart
              title={chartFilter?.dimension === 'powerState'
                ? `Top Operating Systems (${filteredVMs.length} ${chartFilter.value} VMs)`
                : 'Top 10 Operating Systems'}
              data={osChartData}
              height={280}
              valueLabel="VMs"
              formatValue={(v) => `${v} VMs`}
            />
          </Tile>
        </Column>

        {/* Cluster Section */}
        <Column lg={16} md={8} sm={4}>
          <h2 className="dashboard-page__section-title">Cluster Overview</h2>
        </Column>

        {/* VMs by Cluster */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="dashboard-page__chart-tile">
            <HorizontalBarChart
              title="VMs by Cluster"
              subtitle="Distribution of VMs across clusters"
              data={vmsByClusterData}
              height={280}
              valueLabel="VMs"
              formatValue={(v) => `${v} VMs`}
            />
          </Tile>
        </Column>

        {/* CPU Overcommitment by Cluster */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="dashboard-page__chart-tile">
            <VerticalBarChart
              title="CPU Overcommitment by Cluster"
              subtitle="vCPU to physical core ratio"
              data={cpuOvercommitData}
              height={280}
              valueLabel="Ratio"
              formatValue={(v) => `${v}:1`}
            />
          </Tile>
        </Column>

        {/* Memory Overcommitment by Cluster */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="dashboard-page__chart-tile">
            <VerticalBarChart
              title="Memory Overcommitment by Cluster"
              subtitle="VM memory to host memory ratio"
              data={memOvercommitData}
              height={280}
              valueLabel="Ratio"
              formatValue={(v) => `${v}:1`}
            />
          </Tile>
        </Column>

        {/* Configuration Analysis Section */}
        <Column lg={16} md={8} sm={4}>
          <h2 className="dashboard-page__section-title">Configuration Analysis</h2>
        </Column>

        {/* Configuration Summary Card */}
        <Column lg={4} md={4} sm={4}>
          <Tile className={`dashboard-page__config-tile ${configIssuesCount > 0 ? 'dashboard-page__config-tile--warning' : 'dashboard-page__config-tile--success'}`}>
            <div className="dashboard-page__config-header">
              <span className="dashboard-page__config-label">
                Configuration Issues
                <Tooltip label="Sum of blocking and warning configuration issues that need attention before migration." align="top">
                  <button type="button" className="dashboard-page__info-button"><Information size={14} /></button>
                </Tooltip>
              </span>
              <Tag type={configIssuesCount > 0 ? 'red' : 'green'} size="sm">
                {configIssuesCount > 0 ? 'Action Needed' : 'OK'}
              </Tag>
            </div>
            <span className="dashboard-page__config-value">{formatNumber(configIssuesCount)}</span>
            <span className="dashboard-page__config-detail">
              Items requiring attention
            </span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={4}>
          <Tile className={`dashboard-page__config-tile ${toolsNotInstalled > 0 ? 'dashboard-page__config-tile--error' : 'dashboard-page__config-tile--success'}`}>
            <div className="dashboard-page__config-header">
              <span className="dashboard-page__config-label">
                Tools Not Installed
                <Tooltip label="VMs without VMware Tools installed. Tools are required for proper guest OS interaction during migration." align="top">
                  <button type="button" className="dashboard-page__info-button"><Information size={14} /></button>
                </Tooltip>
              </span>
              <Tag type={toolsNotInstalled > 0 ? 'red' : 'green'} size="sm">
                {toolsNotInstalled > 0 ? 'Blocker' : 'OK'}
              </Tag>
            </div>
            <span className="dashboard-page__config-value">{formatNumber(toolsNotInstalled)}</span>
            <span className="dashboard-page__config-detail">
              Required for migration
            </span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={4}>
          <Tile className={`dashboard-page__config-tile ${snapshotsBlockers > 0 ? 'dashboard-page__config-tile--warning' : 'dashboard-page__config-tile--success'}`}>
            <div className="dashboard-page__config-header">
              <span className="dashboard-page__config-label">
                Old Snapshots
                <Tooltip label="Snapshots older than the threshold can cause disk chain issues. Delete or consolidate before migration." align="top">
                  <button type="button" className="dashboard-page__info-button"><Information size={14} /></button>
                </Tooltip>
              </span>
              <Tag type={snapshotsBlockers > 0 ? 'red' : 'green'} size="sm">
                {snapshotsBlockers > 0 ? 'Blocker' : 'OK'}
              </Tag>
            </div>
            <span className="dashboard-page__config-value">{formatNumber(snapshotsBlockers)}</span>
            <span className="dashboard-page__config-detail">
              Over {SNAPSHOT_BLOCKER_AGE_DAYS} days old
            </span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={4}>
          <Tile className={`dashboard-page__config-tile ${outdatedHWCount > 0 ? 'dashboard-page__config-tile--warning' : 'dashboard-page__config-tile--success'}`}>
            <div className="dashboard-page__config-header">
              <span className="dashboard-page__config-label">
                Outdated HW Version
                <Tooltip label="VMs with hardware version below minimum. Upgrade to ensure compatibility with target platform." align="top">
                  <button type="button" className="dashboard-page__info-button"><Information size={14} /></button>
                </Tooltip>
              </span>
              <Tag type={outdatedHWCount > 0 ? 'magenta' : 'green'} size="sm">
                {outdatedHWCount > 0 ? 'Upgrade' : 'OK'}
              </Tag>
            </div>
            <span className="dashboard-page__config-value">{formatNumber(outdatedHWCount)}</span>
            <span className="dashboard-page__config-detail">
              Below HW v{HW_VERSION_MINIMUM}
            </span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={4}>
          <Tile className={`dashboard-page__config-tile ${vmsWithCdConnected > 0 ? 'dashboard-page__config-tile--warning' : 'dashboard-page__config-tile--success'}`}>
            <div className="dashboard-page__config-header">
              <span className="dashboard-page__config-label">
                CD-ROM Connected
                <Tooltip label="VMs with CD/DVD drives connected. Disconnect virtual media before migration to avoid issues." align="top">
                  <button type="button" className="dashboard-page__info-button"><Information size={14} /></button>
                </Tooltip>
              </span>
              <Tag type={vmsWithCdConnected > 0 ? 'magenta' : 'green'} size="sm">
                {vmsWithCdConnected > 0 ? 'Disconnect' : 'OK'}
              </Tag>
            </div>
            <span className="dashboard-page__config-value">{formatNumber(vmsWithCdConnected)}</span>
            <span className="dashboard-page__config-detail">
              Disconnect before migration
            </span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={4}>
          <Tile className={`dashboard-page__config-tile ${vmsNeedConsolidation > 0 ? 'dashboard-page__config-tile--warning' : 'dashboard-page__config-tile--success'}`}>
            <div className="dashboard-page__config-header">
              <span className="dashboard-page__config-label">
                Need Consolidation
                <Tooltip label="VMs with disk chains needing consolidation. Run disk consolidation in vSphere before migration." align="top">
                  <button type="button" className="dashboard-page__info-button"><Information size={14} /></button>
                </Tooltip>
              </span>
              <Tag type={vmsNeedConsolidation > 0 ? 'magenta' : 'green'} size="sm">
                {vmsNeedConsolidation > 0 ? 'Warning' : 'OK'}
              </Tag>
            </div>
            <span className="dashboard-page__config-value">{formatNumber(vmsNeedConsolidation)}</span>
            <span className="dashboard-page__config-detail">
              Disk consolidation needed
            </span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={4}>
          <Tile className="dashboard-page__config-tile dashboard-page__config-tile--info">
            <div className="dashboard-page__config-header">
              <span className="dashboard-page__config-label">
                VMware Tools Current
                <Tooltip label="VMs with up-to-date VMware Tools installed. Current tools ensure best compatibility." align="top">
                  <button type="button" className="dashboard-page__info-button"><Information size={14} /></button>
                </Tooltip>
              </span>
              <Tag type="blue" size="sm">Info</Tag>
            </div>
            <span className="dashboard-page__config-value">{formatNumber(toolsCurrent)}</span>
            <span className="dashboard-page__config-detail">
              {tools.length > 0 ? `${Math.round((toolsCurrent / tools.length) * 100)}% of VMs` : 'N/A'}
            </span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={4}>
          <Tile className="dashboard-page__config-tile dashboard-page__config-tile--info">
            <div className="dashboard-page__config-header">
              <span className="dashboard-page__config-label">
                VMs with Snapshots
                <Tooltip label="Total VMs that have one or more snapshots. Review and clean up unnecessary snapshots." align="top">
                  <button type="button" className="dashboard-page__info-button"><Information size={14} /></button>
                </Tooltip>
              </span>
              <Tag type={vmsWithSnapshots > 0 ? 'high-contrast' : 'green'} size="sm">
                {vmsWithSnapshots > 0 ? 'Review' : 'None'}
              </Tag>
            </div>
            <span className="dashboard-page__config-value">{formatNumber(vmsWithSnapshots)}</span>
            <span className="dashboard-page__config-detail">
              {formatNumber(snapshots.length)} total snapshots
            </span>
          </Tile>
        </Column>

        {/* Configuration Charts */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="dashboard-page__chart-tile">
            <DoughnutChart
              title="Hardware Version Distribution"
              subtitle="VM hardware compatibility versions"
              data={hwVersionChartData}
              height={280}
              formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>

        <Column lg={8} md={8} sm={4}>
          <Tile className="dashboard-page__chart-tile">
            <DoughnutChart
              title="VMware Tools Status"
              subtitle="Tools installation and running status"
              data={toolsChartData}
              height={280}
              colors={['#24a148', '#f1c21b', '#ff832b', '#da1e28', '#6f6f6f']}
              formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>

        <Column lg={8} md={8} sm={4}>
          <Tile className="dashboard-page__chart-tile">
            <DoughnutChart
              title="Firmware Type"
              subtitle="BIOS vs UEFI boot firmware"
              data={firmwareChartData}
              height={280}
              colors={['#0f62fe', '#8a3ffc']}
              formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>
      </Grid>
    </div>
  );
}
