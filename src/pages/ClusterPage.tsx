// Cluster analysis page
import { Grid, Column, Tile, Tag } from '@carbon/react';
import { Navigate } from 'react-router-dom';
import { useData } from '@/hooks';
import { ROUTES } from '@/utils/constants';
import { formatNumber, formatMiB } from '@/utils/formatters';
import { HorizontalBarChart, DoughnutChart, VerticalBarChart } from '@/components/charts';
import { MetricCard, RedHatDocLinksGroup } from '@/components/common';
import { EnhancedDataTable } from '@/components/tables';
import type { ColumnDef } from '@tanstack/react-table';
import type { VClusterInfo } from '@/types';
import './ClusterPage.scss';

export function ClusterPage() {
  const { rawData } = useData();

  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  const clusters = rawData.vCluster;
  const hosts = rawData.vHost;
  const vms = rawData.vInfo.filter(vm => !vm.template);

  // Summary metrics
  const totalClusters = clusters.length;
  const totalHosts = hosts.length;

  // Cluster resource totals from vCluster data
  const totalClusterCpuMHz = clusters.reduce((sum, c) => sum + c.totalCpuMHz, 0);
  const effectiveClusterCpuMHz = clusters.reduce((sum, c) => sum + c.effectiveCpuMHz, 0);
  const totalClusterMemoryMiB = clusters.reduce((sum, c) => sum + c.totalMemoryMiB, 0);
  const effectiveClusterMemoryMiB = clusters.reduce((sum, c) => sum + c.effectiveMemoryMiB, 0);

  // HA/DRS Status
  const haEnabledClusters = clusters.filter(c => c.haEnabled).length;
  const drsEnabledClusters = clusters.filter(c => c.drsEnabled).length;

  // Cluster HA/DRS chart data
  const clusterFeatures = [
    { label: 'HA Enabled', value: haEnabledClusters },
    { label: 'HA Disabled', value: totalClusters - haEnabledClusters },
  ].filter(d => d.value > 0);

  const drsFeatures = [
    { label: 'DRS Enabled', value: drsEnabledClusters },
    { label: 'DRS Disabled', value: totalClusters - drsEnabledClusters },
  ].filter(d => d.value > 0);

  // Clusters by VM count
  const clustersByVmCount = clusters
    .map(c => ({
      label: c.name,
      value: c.vmCount,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  // Clusters by host count
  const clustersByHostCount = clusters
    .map(c => ({
      label: c.name,
      value: c.hostCount,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  // CPU overcommitment by cluster (from vHost data)
  const clusterCpuData = new Map<string, { totalCores: number; vmCpus: number }>();
  hosts.forEach(host => {
    const cluster = host.cluster || 'No Cluster';
    if (!clusterCpuData.has(cluster)) {
      clusterCpuData.set(cluster, { totalCores: 0, vmCpus: 0 });
    }
    const data = clusterCpuData.get(cluster)!;
    data.totalCores += host.totalCpuCores || 0;
    data.vmCpus += host.vmCpuCount || 0;
  });

  const cpuOvercommitByCluster = Array.from(clusterCpuData.entries())
    .filter(([, data]) => data.totalCores > 0)
    .map(([cluster, data]) => ({
      label: cluster,
      value: parseFloat((data.vmCpus / data.totalCores).toFixed(2)),
    }))
    .sort((a, b) => b.value - a.value);

  // Memory overcommitment by cluster (from vHost data)
  const clusterMemData = new Map<string, { hostMemoryMiB: number; vmMemoryMiB: number }>();
  hosts.forEach(host => {
    const cluster = host.cluster || 'No Cluster';
    if (!clusterMemData.has(cluster)) {
      clusterMemData.set(cluster, { hostMemoryMiB: 0, vmMemoryMiB: 0 });
    }
    const data = clusterMemData.get(cluster)!;
    data.hostMemoryMiB += host.memoryMiB || 0;
    data.vmMemoryMiB += host.vmMemoryMiB || 0;
  });

  const memOvercommitByCluster = Array.from(clusterMemData.entries())
    .filter(([, data]) => data.hostMemoryMiB > 0)
    .map(([cluster, data]) => ({
      label: cluster,
      value: parseFloat((data.vmMemoryMiB / data.hostMemoryMiB).toFixed(2)),
    }))
    .sort((a, b) => b.value - a.value);

  // EVC Mode distribution
  const evcModes = clusters.reduce((acc, cluster) => {
    const mode = cluster.evcMode || 'Disabled';
    acc[mode] = (acc[mode] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const evcModeChartData = Object.entries(evcModes)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // DRS Behavior distribution
  const drsBehaviors = clusters.filter(c => c.drsEnabled).reduce((acc, cluster) => {
    const behavior = cluster.drsBehavior || 'Unknown';
    acc[behavior] = (acc[behavior] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const drsBehaviorChartData = Object.entries(drsBehaviors)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // VM density metrics
  const avgVmsPerCluster = clusters.length > 0
    ? (vms.length / clusters.length).toFixed(1)
    : '0';
  const avgHostsPerCluster = clusters.length > 0
    ? (totalHosts / clusters.length).toFixed(1)
    : '0';

  // Cluster status summary
  const clustersGreen = clusters.filter(c => c.overallStatus === 'green').length;
  const clustersYellow = clusters.filter(c => c.overallStatus === 'yellow').length;
  const clustersRed = clusters.filter(c => c.overallStatus === 'red').length;

  // Cluster HA Risk - clusters with fewer than 3 hosts
  const clustersUnder3Hosts = clusters.filter(c => c.hostCount < 3);

  // Cluster details table columns
  const clusterColumns: ColumnDef<VClusterInfo, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Cluster Name',
      enableSorting: true,
    },
    {
      accessorKey: 'datacenter',
      header: 'Datacenter',
      enableSorting: true,
    },
    {
      accessorKey: 'hostCount',
      header: 'Hosts',
      enableSorting: true,
      cell: (info) => formatNumber(info.getValue() as number),
    },
    {
      accessorKey: 'numEffectiveHosts',
      header: 'Effective Hosts',
      enableSorting: true,
      cell: (info) => formatNumber(info.getValue() as number),
    },
    {
      accessorKey: 'vmCount',
      header: 'VMs',
      enableSorting: true,
      cell: (info) => formatNumber(info.getValue() as number),
    },
    {
      accessorKey: 'numCpuCores',
      header: 'CPU Cores',
      enableSorting: true,
      cell: (info) => formatNumber(info.getValue() as number),
    },
    {
      accessorKey: 'numCpuThreads',
      header: 'CPU Threads',
      enableSorting: true,
      cell: (info) => formatNumber(info.getValue() as number),
    },
    {
      accessorKey: 'totalCpuMHz',
      header: 'Total CPU (GHz)',
      enableSorting: true,
      cell: (info) => `${((info.getValue() as number) / 1000).toFixed(1)}`,
    },
    {
      accessorKey: 'effectiveCpuMHz',
      header: 'Effective CPU (GHz)',
      enableSorting: true,
      cell: (info) => `${((info.getValue() as number) / 1000).toFixed(1)}`,
    },
    {
      accessorKey: 'totalMemoryMiB',
      header: 'Total Memory',
      enableSorting: true,
      cell: (info) => formatMiB(info.getValue() as number, 0),
    },
    {
      accessorKey: 'effectiveMemoryMiB',
      header: 'Effective Memory',
      enableSorting: true,
      cell: (info) => formatMiB(info.getValue() as number, 0),
    },
    {
      accessorKey: 'haEnabled',
      header: 'HA',
      enableSorting: true,
      cell: (info) => (
        <Tag type={info.getValue() ? 'green' : 'gray'} size="sm">
          {info.getValue() ? 'Enabled' : 'Disabled'}
        </Tag>
      ),
    },
    {
      accessorKey: 'drsEnabled',
      header: 'DRS',
      enableSorting: true,
      cell: (info) => (
        <Tag type={info.getValue() ? 'blue' : 'gray'} size="sm">
          {info.getValue() ? 'Enabled' : 'Disabled'}
        </Tag>
      ),
    },
    {
      accessorKey: 'evcMode',
      header: 'EVC Mode',
      enableSorting: true,
      cell: (info) => info.getValue() || 'Disabled',
    },
    {
      accessorKey: 'overallStatus',
      header: 'Status',
      enableSorting: true,
      cell: (info) => {
        const status = info.getValue() as string;
        const statusColors: Record<string, 'green' | 'red' | 'gray' | 'high-contrast'> = {
          'green': 'green',
          'yellow': 'high-contrast',
          'red': 'red',
        };
        return (
          <Tag type={statusColors[status] || 'gray'} size="sm">
            {status || 'Unknown'}
          </Tag>
        );
      },
    },
  ];

  return (
    <div className="cluster-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="cluster-page__title">Cluster Analysis</h1>
          <p className="cluster-page__subtitle">
            Cluster configuration, HA/DRS status, and resource distribution
          </p>
        </Column>

        {/* Summary metrics */}
        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Total Clusters"
            value={formatNumber(totalClusters)}
            detail={`${avgVmsPerCluster} VMs/cluster avg`}
            variant="primary"
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Total Hosts"
            value={formatNumber(totalHosts)}
            detail={`${avgHostsPerCluster} hosts/cluster avg`}
            variant="info"
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Total Cluster CPU"
            value={`${Math.round(totalClusterCpuMHz / 1000)} GHz`}
            detail={`${Math.round(effectiveClusterCpuMHz / 1000)} GHz effective`}
            variant="teal"
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Total Cluster Memory"
            value={formatMiB(totalClusterMemoryMiB, 0)}
            detail={`${formatMiB(effectiveClusterMemoryMiB, 0)} effective`}
            variant="purple"
          />
        </Column>

        {/* HA Status */}
        <Column lg={8} md={4} sm={4}>
          <Tile className="cluster-page__chart-tile">
            <DoughnutChart
              title="High Availability (HA)"
              subtitle="Cluster HA configuration status"
              data={clusterFeatures}
              height={250}
              colors={['#24a148', '#da1e28']}
              formatValue={(v) => `${v} cluster${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>

        {/* DRS Status */}
        <Column lg={8} md={4} sm={4}>
          <Tile className="cluster-page__chart-tile">
            <DoughnutChart
              title="Distributed Resource Scheduler (DRS)"
              subtitle="Cluster DRS configuration status"
              data={drsFeatures}
              height={250}
              colors={['#0f62fe', '#6f6f6f']}
              formatValue={(v) => `${v} cluster${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>

        {/* DRS Behavior Distribution */}
        {drsBehaviorChartData.length > 0 && (
          <Column lg={8} md={8} sm={4}>
            <Tile className="cluster-page__chart-tile">
              <DoughnutChart
                title="DRS Behavior"
                subtitle="DRS automation level for enabled clusters"
                data={drsBehaviorChartData}
                height={280}
                formatValue={(v) => `${v} cluster${v !== 1 ? 's' : ''}`}
              />
            </Tile>
          </Column>
        )}

        {/* EVC Mode Distribution */}
        <Column lg={drsBehaviorChartData.length > 0 ? 8 : 16} md={8} sm={4}>
          <Tile className="cluster-page__chart-tile">
            <DoughnutChart
              title="EVC Mode"
              subtitle="Enhanced vMotion Compatibility mode"
              data={evcModeChartData}
              height={280}
              formatValue={(v) => `${v} cluster${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>

        {/* Clusters by Host Count */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="cluster-page__chart-tile">
            <HorizontalBarChart
              title="Clusters by Host Count"
              subtitle="Number of hosts in each cluster"
              data={clustersByHostCount}
              height={280}
              valueLabel="Hosts"
              formatValue={(v) => `${v} host${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>

        {/* Clusters by VM Count */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="cluster-page__chart-tile">
            <HorizontalBarChart
              title="Clusters by VM Count"
              subtitle="Virtual machines per cluster"
              data={clustersByVmCount}
              height={280}
              valueLabel="VMs"
              formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>

        {/* CPU Overcommitment by Cluster */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="cluster-page__chart-tile">
            <VerticalBarChart
              title="CPU Overcommitment by Cluster"
              subtitle="vCPU to physical core ratio per cluster"
              data={cpuOvercommitByCluster}
              height={280}
              valueLabel="Ratio"
              formatValue={(v) => `${v}:1`}
            />
          </Tile>
        </Column>

        {/* Memory Overcommitment by Cluster */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="cluster-page__chart-tile">
            <VerticalBarChart
              title="Memory Overcommitment by Cluster"
              subtitle="VM memory to host memory ratio per cluster"
              data={memOvercommitByCluster}
              height={280}
              valueLabel="Ratio"
              formatValue={(v) => `${v}:1`}
            />
          </Tile>
        </Column>

        {/* Cluster Health Status */}
        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Healthy Clusters"
            value={formatNumber(clustersGreen)}
            variant="success"
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Warning Status"
            value={formatNumber(clustersYellow)}
            variant={clustersYellow > 0 ? 'warning' : 'success'}
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Critical Status"
            value={formatNumber(clustersRed)}
            variant={clustersRed > 0 ? 'error' : 'success'}
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="HA Failover Level"
            value={clusters.length > 0 ? Math.max(...clusters.map(c => c.haFailoverLevel)).toString() : 'N/A'}
            detail="Maximum configured"
            variant="info"
          />
        </Column>

        {/* Cluster HA Risk - Clusters with fewer than 3 hosts */}
        {clustersUnder3Hosts.length > 0 && (
          <Column lg={16} md={8} sm={4}>
            <Tile className="cluster-page__risk-tile">
              <h4>Cluster HA Risk</h4>
              <p className="cluster-page__risk-description">
                Clusters with fewer than 3 hosts may not provide adequate failover capacity for high availability.
                Consider consolidating workloads or adding hosts before migration.
              </p>
              <div className="cluster-page__risk-list">
                {clustersUnder3Hosts.map((cluster) => (
                  <div key={cluster.name} className="cluster-page__risk-item">
                    <span className="cluster-page__risk-name">{cluster.name}</span>
                    <div className="cluster-page__risk-tags">
                      <Tag type="red" size="sm">{cluster.hostCount} host{cluster.hostCount !== 1 ? 's' : ''}</Tag>
                      <Tag type="gray" size="sm">{cluster.vmCount} VMs</Tag>
                      {!cluster.haEnabled && <Tag type="magenta" size="sm">HA Disabled</Tag>}
                    </div>
                  </div>
                ))}
              </div>
            </Tile>
          </Column>
        )}

        {/* Cluster Details Table */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="cluster-page__table-tile">
            <EnhancedDataTable
              data={clusters}
              columns={clusterColumns}
              title="Cluster Details"
              description="Per-cluster resource statistics including hosts, CPU, memory, and configuration"
              enableSearch
              enablePagination
              enableSorting
              enableExport
              enableColumnVisibility
              defaultPageSize={25}
              exportFilename="cluster-details"
            />
          </Tile>
        </Column>

        {/* Documentation Links */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="cluster-page__docs-tile">
            <RedHatDocLinksGroup
              title="OpenShift Virtualization Cluster Resources"
              links={[
                {
                  href: 'https://github.com/RedHatQuickCourses/architect-the-ocpvirt',
                  label: 'Architecture Course',
                  description: 'Red Hat Quick Course - Architect OpenShift Virtualization',
                },
                {
                  href: 'https://access.redhat.com/articles/4820991',
                  label: 'Resource Requirements',
                  description: 'OpenShift Virtualization resource requirements and guidelines',
                },
                {
                  href: 'https://docs.openshift.com/container-platform/latest/virt/install/preparing-cluster-for-virt.html',
                  label: 'Cluster Preparation',
                  description: 'Preparing your cluster for OpenShift Virtualization',
                },
              ]}
              layout="horizontal"
            />
          </Tile>
        </Column>
      </Grid>
    </div>
  );
}
