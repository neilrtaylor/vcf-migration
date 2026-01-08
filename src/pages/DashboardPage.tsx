// Dashboard page - Executive summary
import { Grid, Column, Tile } from '@carbon/react';
import { useData, useVMs, useChartFilter } from '@/hooks';
import { Navigate } from 'react-router-dom';
import { ROUTES } from '@/utils/constants';
import { formatNumber, mibToGiB, mibToTiB } from '@/utils/formatters';
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

        {/* Key Metrics Row */}
        <Column lg={4} md={4} sm={4}>
          <MetricCard
            label="Total VMs"
            value={formatNumber(totalVMs)}
            detail={`${formatNumber(poweredOnVMs)} powered on`}
            variant="primary"
          />
        </Column>

        <Column lg={4} md={4} sm={4}>
          <MetricCard
            label="Total vCPUs"
            value={formatNumber(totalVCPUs)}
            detail={`Avg ${(totalVCPUs / totalVMs).toFixed(1)} per VM`}
            variant="info"
          />
        </Column>

        <Column lg={4} md={4} sm={4}>
          <MetricCard
            label="Total Memory"
            value={`${totalMemoryTiB.toFixed(1)} TiB`}
            detail={`Avg ${(totalMemoryGiB / totalVMs).toFixed(1)} GiB per VM`}
            variant="teal"
          />
        </Column>

        <Column lg={4} md={4} sm={4}>
          <MetricCard
            label="Provisioned Storage"
            value={`${totalProvisionedTiB.toFixed(1)} TiB`}
            detail="Total allocated capacity"
            variant="purple"
          />
        </Column>

        <Column lg={4} md={4} sm={4}>
          <MetricCard
            label="In Use Storage"
            value={`${totalInUseTiB.toFixed(1)} TiB`}
            detail={`${((totalInUseMiB / totalProvisionedMiB) * 100).toFixed(0)}% of provisioned`}
            variant="purple"
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
          />
        </Column>

        <Column lg={3} md={4} sm={2}>
          <MetricCard
            label="Clusters"
            value={formatNumber(uniqueClusters)}
            variant="default"
          />
        </Column>

        <Column lg={3} md={4} sm={2}>
          <MetricCard
            label="Datacenters"
            value={formatNumber(uniqueDatacenters)}
            variant="default"
          />
        </Column>

        <Column lg={3} md={4} sm={2}>
          <MetricCard
            label="Datastores"
            value={formatNumber(rawData.vDatastore.length)}
            variant="default"
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Templates"
            value={formatNumber(templates)}
            variant="default"
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
      </Grid>
    </div>
  );
}
