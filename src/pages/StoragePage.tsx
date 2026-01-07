// Storage analysis page
import { Grid, Column, Tile } from '@carbon/react';
import { Navigate } from 'react-router-dom';
import { useData } from '@/hooks';
import { ROUTES } from '@/utils/constants';
import { mibToGiB, mibToTiB, formatNumber } from '@/utils/formatters';
import { HorizontalBarChart, DoughnutChart } from '@/components/charts';
import './StoragePage.scss';

export function StoragePage() {
  const { rawData } = useData();

  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  const datastores = rawData.vDatastore;
  const vms = rawData.vInfo.filter(vm => !vm.template);

  // Calculate storage metrics
  const totalCapacityTiB = mibToTiB(datastores.reduce((sum, ds) => sum + ds.capacityMiB, 0));
  const totalUsedTiB = mibToTiB(datastores.reduce((sum, ds) => sum + ds.inUseMiB, 0));
  const totalFreeTiB = mibToTiB(datastores.reduce((sum, ds) => sum + ds.freeMiB, 0));
  const avgUtilization = totalCapacityTiB > 0 ? (totalUsedTiB / totalCapacityTiB) * 100 : 0;

  // Datastore type distribution
  const typeDistribution = datastores.reduce((acc, ds) => {
    const type = ds.type || 'Unknown';
    if (!acc[type]) {
      acc[type] = { count: 0, capacityMiB: 0 };
    }
    acc[type].count++;
    acc[type].capacityMiB += ds.capacityMiB;
    return acc;
  }, {} as Record<string, { count: number; capacityMiB: number }>);

  const typeChartData = Object.entries(typeDistribution)
    .map(([type, data]) => ({
      label: `${type} (${data.count})`,
      value: mibToTiB(data.capacityMiB),
    }))
    .sort((a, b) => b.value - a.value);

  // Top datastores by usage
  const topDatastores = [...datastores]
    .sort((a, b) => b.inUseMiB - a.inUseMiB)
    .slice(0, 15)
    .map((ds) => ({
      label: ds.name,
      value: mibToGiB(ds.inUseMiB),
    }));

  // Datastores with high utilization (>80%)
  const highUtilDatastores = datastores
    .filter(ds => {
      const utilization = ds.capacityMiB > 0 ? (ds.inUseMiB / ds.capacityMiB) * 100 : 0;
      return utilization > 80;
    })
    .sort((a, b) => {
      const utilA = a.capacityMiB > 0 ? (a.inUseMiB / a.capacityMiB) * 100 : 0;
      const utilB = b.capacityMiB > 0 ? (b.inUseMiB / b.capacityMiB) * 100 : 0;
      return utilB - utilA;
    })
    .slice(0, 10)
    .map(ds => ({
      label: ds.name,
      value: ds.capacityMiB > 0 ? (ds.inUseMiB / ds.capacityMiB) * 100 : 0,
    }));

  // Top storage consumers (VMs)
  const topStorageVMs = [...vms]
    .sort((a, b) => b.provisionedMiB - a.provisionedMiB)
    .slice(0, 15)
    .map(vm => ({
      label: vm.vmName,
      value: mibToGiB(vm.provisionedMiB),
    }));

  return (
    <div className="storage-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="storage-page__title">Storage Analysis</h1>
          <p className="storage-page__subtitle">
            Datastore capacity and utilization analysis
          </p>
        </Column>

        {/* Summary metrics */}
        <Column lg={4} md={4} sm={2}>
          <Tile className="storage-page__metric-tile">
            <span className="storage-page__metric-label">Total Capacity</span>
            <span className="storage-page__metric-value">{totalCapacityTiB.toFixed(1)} TiB</span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className="storage-page__metric-tile">
            <span className="storage-page__metric-label">Used Storage</span>
            <span className="storage-page__metric-value">{totalUsedTiB.toFixed(1)} TiB</span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className="storage-page__metric-tile">
            <span className="storage-page__metric-label">Free Storage</span>
            <span className="storage-page__metric-value">{totalFreeTiB.toFixed(1)} TiB</span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className="storage-page__metric-tile">
            <span className="storage-page__metric-label">Avg Utilization</span>
            <span className="storage-page__metric-value">{avgUtilization.toFixed(1)}%</span>
          </Tile>
        </Column>

        {/* Datastore Type Distribution */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="storage-page__chart-tile">
            <DoughnutChart
              title="Storage by Type"
              subtitle="Capacity distribution across datastore types"
              data={typeChartData}
              height={280}
              formatValue={(v) => `${v.toFixed(1)} TiB`}
            />
          </Tile>
        </Column>

        {/* High Utilization Datastores */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="storage-page__chart-tile">
            <HorizontalBarChart
              title="High Utilization Datastores"
              subtitle={`${highUtilDatastores.length} datastores over 80% utilized`}
              data={highUtilDatastores}
              height={280}
              valueLabel="Utilization"
              formatValue={(v) => `${v.toFixed(1)}%`}
            />
          </Tile>
        </Column>

        {/* Top Datastores */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="storage-page__chart-tile">
            <HorizontalBarChart
              title="Top 15 Datastores by Usage"
              data={topDatastores}
              height={400}
              valueLabel="Used"
              formatValue={(v) => `${v.toFixed(0)} GiB`}
            />
          </Tile>
        </Column>

        {/* Top VM Storage Consumers */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="storage-page__chart-tile">
            <HorizontalBarChart
              title="Top 15 VMs by Storage"
              data={topStorageVMs}
              height={400}
              valueLabel="Provisioned"
              formatValue={(v) => `${v.toFixed(0)} GiB`}
            />
          </Tile>
        </Column>

        {/* Additional metrics */}
        <Column lg={4} md={4} sm={2}>
          <Tile className="storage-page__secondary-tile">
            <span className="storage-page__metric-label">Datastores</span>
            <span className="storage-page__secondary-value">{formatNumber(datastores.length)}</span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className="storage-page__secondary-tile">
            <span className="storage-page__metric-label">High Util (&gt;80%)</span>
            <span className="storage-page__secondary-value">{formatNumber(highUtilDatastores.length)}</span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className="storage-page__secondary-tile">
            <span className="storage-page__metric-label">VMFS Datastores</span>
            <span className="storage-page__secondary-value">
              {formatNumber(datastores.filter(ds => ds.type === 'VMFS').length)}
            </span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className="storage-page__secondary-tile">
            <span className="storage-page__metric-label">NFS Datastores</span>
            <span className="storage-page__secondary-value">
              {formatNumber(datastores.filter(ds => ds.type === 'NFS').length)}
            </span>
          </Tile>
        </Column>
      </Grid>
    </div>
  );
}
