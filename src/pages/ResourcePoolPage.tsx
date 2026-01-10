// Resource Pool analysis page
import { Grid, Column, Tile, Tag } from '@carbon/react';
import { Navigate } from 'react-router-dom';
import { useData } from '@/hooks';
import { ROUTES } from '@/utils/constants';
import { formatNumber, formatMiB } from '@/utils/formatters';
import { HorizontalBarChart, DoughnutChart } from '@/components/charts';
import { MetricCard } from '@/components/common';
import { EnhancedDataTable } from '@/components/tables';
import type { ColumnDef } from '@tanstack/react-table';
import type { VResourcePoolInfo } from '@/types';
import './ResourcePoolPage.scss';

export function ResourcePoolPage() {
  const { rawData } = useData();

  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  const resourcePools = rawData.vResourcePool || [];

  // Show message if no resource pool data
  if (resourcePools.length === 0) {
    return (
      <div className="resource-pool-page">
        <Grid>
          <Column lg={16} md={8} sm={4}>
            <h1 className="resource-pool-page__title">Resource Pools</h1>
            <p className="resource-pool-page__subtitle">
              Resource pool configuration and allocation analysis
            </p>
          </Column>
          <Column lg={16} md={8} sm={4}>
            <Tile className="resource-pool-page__empty-tile">
              <h3>No Resource Pool Data Available</h3>
              <p>
                The uploaded RVTools file does not contain resource pool information.
                This can happen if:
              </p>
              <ul>
                <li>The vRP tab was not included in the RVTools export</li>
                <li>No resource pools are configured in your vSphere environment</li>
                <li>The vRP tab has a different format than expected</li>
              </ul>
              <p>
                To include resource pool data, ensure you export the vRP tab when running RVTools.
              </p>
            </Tile>
          </Column>
        </Grid>
      </div>
    );
  }

  // Summary metrics
  const totalResourcePools = resourcePools.length;
  const totalVMsInPools = resourcePools.reduce((sum, rp) => sum + rp.vmCount, 0);

  // CPU reservations and limits
  const totalCpuReservation = resourcePools.reduce((sum, rp) => sum + rp.cpuReservation, 0);
  const poolsWithCpuLimit = resourcePools.filter(rp => rp.cpuLimit > 0 && rp.cpuLimit !== -1);
  const poolsWithCpuReservation = resourcePools.filter(rp => rp.cpuReservation > 0);

  // Memory reservations and limits
  const totalMemoryReservation = resourcePools.reduce((sum, rp) => sum + rp.memoryReservation, 0);
  const poolsWithMemoryLimit = resourcePools.filter(rp => rp.memoryLimit > 0 && rp.memoryLimit !== -1);
  const poolsWithMemoryReservation = resourcePools.filter(rp => rp.memoryReservation > 0);

  // Expandable reservations
  const cpuExpandable = resourcePools.filter(rp => rp.cpuExpandable).length;
  const memoryExpandable = resourcePools.filter(rp => rp.memoryExpandable).length;

  // Resource pools by cluster
  const poolsByCluster = resourcePools.reduce((acc, rp) => {
    const cluster = rp.cluster || 'No Cluster';
    acc[cluster] = (acc[cluster] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const poolsByClusterData = Object.entries(poolsByCluster)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  // Resource pools by VM count
  const poolsByVMCount = resourcePools
    .map(rp => ({
      label: rp.name,
      value: rp.vmCount,
    }))
    .filter(rp => rp.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  // CPU reservation distribution
  const cpuReservationData = [
    { label: 'With Reservation', value: poolsWithCpuReservation.length },
    { label: 'No Reservation', value: totalResourcePools - poolsWithCpuReservation.length },
  ].filter(d => d.value > 0);

  // Memory reservation distribution
  const memoryReservationData = [
    { label: 'With Reservation', value: poolsWithMemoryReservation.length },
    { label: 'No Reservation', value: totalResourcePools - poolsWithMemoryReservation.length },
  ].filter(d => d.value > 0);

  // Hierarchy analysis - pools with parents vs root pools
  const rootPools = resourcePools.filter(rp => !rp.parent || rp.parent === 'Resources');
  const childPools = resourcePools.filter(rp => rp.parent && rp.parent !== 'Resources');

  // Resource pool table columns
  const resourcePoolColumns: ColumnDef<VResourcePoolInfo, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Resource Pool',
      enableSorting: true,
    },
    {
      accessorKey: 'cluster',
      header: 'Cluster',
      enableSorting: true,
    },
    {
      accessorKey: 'datacenter',
      header: 'Datacenter',
      enableSorting: true,
    },
    {
      accessorKey: 'parent',
      header: 'Parent',
      enableSorting: true,
      cell: (info) => info.getValue() || 'Root',
    },
    {
      accessorKey: 'vmCount',
      header: 'VMs',
      enableSorting: true,
      cell: (info) => formatNumber(info.getValue() as number),
    },
    {
      accessorKey: 'cpuReservation',
      header: 'CPU Reservation (MHz)',
      enableSorting: true,
      cell: (info) => formatNumber(info.getValue() as number),
    },
    {
      accessorKey: 'cpuLimit',
      header: 'CPU Limit (MHz)',
      enableSorting: true,
      cell: (info) => {
        const value = info.getValue() as number;
        return value === -1 ? 'Unlimited' : formatNumber(value);
      },
    },
    {
      accessorKey: 'cpuExpandable',
      header: 'CPU Expandable',
      enableSorting: true,
      cell: (info) => (
        <Tag type={info.getValue() ? 'green' : 'gray'} size="sm">
          {info.getValue() ? 'Yes' : 'No'}
        </Tag>
      ),
    },
    {
      accessorKey: 'cpuShares',
      header: 'CPU Shares',
      enableSorting: true,
      cell: (info) => formatNumber(info.getValue() as number),
    },
    {
      accessorKey: 'memoryReservation',
      header: 'Memory Reservation',
      enableSorting: true,
      cell: (info) => formatMiB(info.getValue() as number, 0),
    },
    {
      accessorKey: 'memoryLimit',
      header: 'Memory Limit',
      enableSorting: true,
      cell: (info) => {
        const value = info.getValue() as number;
        return value === -1 ? 'Unlimited' : formatMiB(value, 0);
      },
    },
    {
      accessorKey: 'memoryExpandable',
      header: 'Memory Expandable',
      enableSorting: true,
      cell: (info) => (
        <Tag type={info.getValue() ? 'green' : 'gray'} size="sm">
          {info.getValue() ? 'Yes' : 'No'}
        </Tag>
      ),
    },
    {
      accessorKey: 'memoryShares',
      header: 'Memory Shares',
      enableSorting: true,
      cell: (info) => formatNumber(info.getValue() as number),
    },
    {
      accessorKey: 'configStatus',
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
    <div className="resource-pool-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="resource-pool-page__title">Resource Pools</h1>
          <p className="resource-pool-page__subtitle">
            Resource pool configuration, CPU and memory reservations, and hierarchy
          </p>
        </Column>

        {/* Summary metrics */}
        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Total Resource Pools"
            value={formatNumber(totalResourcePools)}
            detail={`${rootPools.length} root, ${childPools.length} nested`}
            variant="primary"
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="VMs in Pools"
            value={formatNumber(totalVMsInPools)}
            detail={`${(totalVMsInPools / totalResourcePools).toFixed(1)} VMs/pool avg`}
            variant="info"
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Total CPU Reservation"
            value={`${(totalCpuReservation / 1000).toFixed(1)} GHz`}
            detail={`${poolsWithCpuReservation.length} pools with reservations`}
            variant="teal"
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Total Memory Reservation"
            value={formatMiB(totalMemoryReservation, 0)}
            detail={`${poolsWithMemoryReservation.length} pools with reservations`}
            variant="purple"
          />
        </Column>

        {/* Secondary metrics */}
        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="CPU Expandable"
            value={formatNumber(cpuExpandable)}
            detail={`${((cpuExpandable / totalResourcePools) * 100).toFixed(0)}% of pools`}
            variant="success"
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Memory Expandable"
            value={formatNumber(memoryExpandable)}
            detail={`${((memoryExpandable / totalResourcePools) * 100).toFixed(0)}% of pools`}
            variant="success"
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Pools with CPU Limit"
            value={formatNumber(poolsWithCpuLimit.length)}
            variant={poolsWithCpuLimit.length > 0 ? 'warning' : 'info'}
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Pools with Memory Limit"
            value={formatNumber(poolsWithMemoryLimit.length)}
            variant={poolsWithMemoryLimit.length > 0 ? 'warning' : 'info'}
          />
        </Column>

        {/* CPU Reservation Distribution */}
        <Column lg={8} md={4} sm={4}>
          <Tile className="resource-pool-page__chart-tile">
            <DoughnutChart
              title="CPU Reservation Status"
              subtitle="Pools with CPU reservations configured"
              data={cpuReservationData}
              height={250}
              colors={['#24a148', '#6f6f6f']}
              formatValue={(v) => `${v} pool${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>

        {/* Memory Reservation Distribution */}
        <Column lg={8} md={4} sm={4}>
          <Tile className="resource-pool-page__chart-tile">
            <DoughnutChart
              title="Memory Reservation Status"
              subtitle="Pools with memory reservations configured"
              data={memoryReservationData}
              height={250}
              colors={['#8a3ffc', '#6f6f6f']}
              formatValue={(v) => `${v} pool${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>

        {/* Resource Pools by Cluster */}
        {poolsByClusterData.length > 0 && (
          <Column lg={8} md={8} sm={4}>
            <Tile className="resource-pool-page__chart-tile">
              <HorizontalBarChart
                title="Resource Pools by Cluster"
                subtitle="Number of resource pools per cluster"
                data={poolsByClusterData}
                height={280}
                valueLabel="Pools"
                formatValue={(v) => `${v} pool${v !== 1 ? 's' : ''}`}
              />
            </Tile>
          </Column>
        )}

        {/* Resource Pools by VM Count */}
        {poolsByVMCount.length > 0 && (
          <Column lg={poolsByClusterData.length > 0 ? 8 : 16} md={8} sm={4}>
            <Tile className="resource-pool-page__chart-tile">
              <HorizontalBarChart
                title="Resource Pools by VM Count"
                subtitle="Top pools by number of VMs"
                data={poolsByVMCount}
                height={280}
                valueLabel="VMs"
                formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
              />
            </Tile>
          </Column>
        )}

        {/* Resource Pool Details Table */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="resource-pool-page__table-tile">
            <EnhancedDataTable
              data={resourcePools}
              columns={resourcePoolColumns}
              title="Resource Pool Details"
              description="Complete resource pool configuration including reservations, limits, and shares"
              enableSearch
              enablePagination
              enableSorting
              enableExport
              enableColumnVisibility
              defaultPageSize={25}
              exportFilename="resource-pool-details"
            />
          </Tile>
        </Column>
      </Grid>
    </div>
  );
}
