// Storage analysis page
import { useMemo, useState } from 'react';
import { Grid, Column, Tile, InlineNotification } from '@carbon/react';
import { Navigate } from 'react-router-dom';
import { useData, useChartFilter } from '@/hooks';
import { ROUTES } from '@/utils/constants';
import { mibToGiB, mibToTiB, formatNumber } from '@/utils/formatters';
import { HorizontalBarChart, DoughnutChart, Heatmap } from '@/components/charts';
import type { HeatmapCell } from '@/components/charts';
import { FilterBadge, MetricCard } from '@/components/common';
import { EnhancedDataTable, FilterableVMTable } from '@/components/tables';
import type { FilterOption } from '@/components/tables';
import type { ColumnDef } from '@tanstack/react-table';
import './StoragePage.scss';

// Interface for datastore utilization table rows
interface DatastoreUtilRow {
  name: string;
  type: string;
  size: number;
  used: number;
  free: number;
  utilization: number;
  vmCount: number;
  hostCount: number;
}

// Extract datastore type from label (format: "TYPE (count)")
const extractTypeFromLabel = (label: string): string => {
  const match = label.match(/^(.+?)\s*\(/);
  return match ? match[1] : label;
};

// Color-coded utilization cell renderer
const getUtilizationColor = (value: number): string => {
  if (value >= 80) return 'var(--cds-support-error, #da1e28)';
  if (value >= 50) return 'var(--cds-support-warning, #f1c21b)';
  return 'var(--cds-support-success, #24a148)';
};

export function StoragePage() {
  const { rawData } = useData();
  const { chartFilter, setFilter, clearFilter } = useChartFilter();
  const [selectedDatastore, setSelectedDatastore] = useState<string | null>(null);

  // Derived data with optional chaining for use in hooks
  const datastores = useMemo(() => rawData?.vDatastore ?? [], [rawData?.vDatastore]);
  const vms = useMemo(() => (rawData?.vInfo ?? []).filter(vm => !vm.template), [rawData?.vInfo]);
  const vDisks = useMemo(() => rawData?.vDisk ?? [], [rawData?.vDisk]);

  // Build VM-to-datastore mapping from vDisk data
  const vmToDatastores = useMemo(() => {
    const map = new Map<string, Set<string>>();
    vDisks.forEach(disk => {
      if (disk.vmName && disk.diskPath) {
        // Extract datastore from diskPath: "[datastore-name] folder/file.vmdk"
        const match = disk.diskPath.match(/^\[([^\]]+)\]/);
        if (match) {
          const dsName = match[1];
          if (!map.has(disk.vmName)) {
            map.set(disk.vmName, new Set());
          }
          map.get(disk.vmName)!.add(dsName);
        }
      }
    });
    return map;
  }, [vDisks]);

  // Build datastore filter options (count VMs per datastore)
  const datastoreFilterOptions: FilterOption[] = useMemo(() => {
    const dsVMCount = new Map<string, number>();
    vmToDatastores.forEach((datastoreSet) => {
      datastoreSet.forEach(ds => {
        dsVMCount.set(ds, (dsVMCount.get(ds) || 0) + 1);
      });
    });

    return Array.from(dsVMCount.entries())
      .map(([name, count]) => ({
        value: name,
        label: name,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [vmToDatastores]);

  // Filter VMs by selected datastore
  const filteredVMsByDatastore = useMemo(() => {
    if (!selectedDatastore) return vms;
    return vms.filter(vm => {
      const vmDatastores = vmToDatastores.get(vm.vmName);
      return vmDatastores && vmDatastores.has(selectedDatastore);
    });
  }, [vms, selectedDatastore, vmToDatastores]);

  // Filter datastores based on active filter
  const filteredDatastores = useMemo(() => {
    if (chartFilter && chartFilter.dimension === 'datastoreType') {
      return datastores.filter(ds => (ds.type || 'Unknown') === extractTypeFromLabel(chartFilter.value));
    }
    return datastores;
  }, [datastores, chartFilter]);

  // Datastore utilization table data
  const datastoreUtilTableData: DatastoreUtilRow[] = useMemo(() =>
    filteredDatastores
      .filter(ds => ds.capacityMiB > 0)
      .map(ds => ({
        name: ds.name,
        type: ds.type || 'Unknown',
        size: mibToGiB(ds.capacityMiB),
        used: mibToGiB(ds.inUseMiB),
        free: mibToGiB(ds.freeMiB),
        utilization: (ds.inUseMiB / ds.capacityMiB) * 100,
        vmCount: ds.vmCount,
        hostCount: ds.hostCount,
      }))
      .sort((a, b) => b.utilization - a.utilization),
    [filteredDatastores]
  );

  const datastoreUtilColumns: ColumnDef<DatastoreUtilRow, unknown>[] = useMemo(() => [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Name',
      cell: ({ getValue }) => getValue() as string,
    },
    {
      id: 'type',
      accessorKey: 'type',
      header: 'Type',
      cell: ({ getValue }) => getValue() as string,
    },
    {
      id: 'size',
      accessorKey: 'size',
      header: 'Size (GiB)',
      cell: ({ getValue }) => formatNumber((getValue() as number), 1),
    },
    {
      id: 'used',
      accessorKey: 'used',
      header: 'Used (GiB)',
      cell: ({ getValue }) => formatNumber((getValue() as number), 1),
    },
    {
      id: 'free',
      accessorKey: 'free',
      header: 'Free (GiB)',
      cell: ({ getValue }) => formatNumber((getValue() as number), 1),
    },
    {
      id: 'vmCount',
      accessorKey: 'vmCount',
      header: 'VMs',
      cell: ({ getValue }) => formatNumber(getValue() as number),
    },
    {
      id: 'hostCount',
      accessorKey: 'hostCount',
      header: 'Hosts',
      cell: ({ getValue }) => formatNumber(getValue() as number),
    },
    {
      id: 'utilization',
      accessorKey: 'utilization',
      header: 'Utilized',
      cell: ({ getValue }) => {
        const value = getValue() as number;
        return (
          <span
            className="storage-page__utilization-cell"
            style={{
              color: getUtilizationColor(value),
              fontWeight: value >= 80 ? 600 : 400,
            }}
          >
            {value.toFixed(1)}%
          </span>
        );
      },
    },
  ], []);

  // Datastore utilization heatmap data (grouped by datacenter)
  const datastoreUtilHeatmap: HeatmapCell[] = useMemo(() =>
    datastores
      .filter(ds => ds.capacityMiB > 0)
      .sort((a, b) => {
        // Sort by datacenter, then by utilization
        const dcCompare = (a.datacenter || '').localeCompare(b.datacenter || '');
        if (dcCompare !== 0) return dcCompare;
        const utilA = (a.inUseMiB / a.capacityMiB) * 100;
        const utilB = (b.inUseMiB / b.capacityMiB) * 100;
        return utilB - utilA;
      })
      .slice(0, 30) // Limit to 30 datastores
      .map(ds => {
        const utilization = (ds.inUseMiB / ds.capacityMiB) * 100;
        const dsName = ds.name.length > 30 ? ds.name.substring(0, 27) + '...' : ds.name;
        return {
          row: dsName,
          col: 'Utilization',
          value: utilization,
          label: `${utilization.toFixed(0)}%`,
        };
      }),
    [datastores]
  );

  // Early return AFTER all hooks have been called
  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  // Calculate datastore-level storage metrics
  const totalCapacityTiB = mibToTiB(datastores.reduce((sum, ds) => sum + ds.capacityMiB, 0));
  const totalUsedTiB = mibToTiB(datastores.reduce((sum, ds) => sum + ds.inUseMiB, 0));
  const totalFreeTiB = mibToTiB(datastores.reduce((sum, ds) => sum + ds.freeMiB, 0));
  const avgUtilization = totalCapacityTiB > 0 ? (totalUsedTiB / totalCapacityTiB) * 100 : 0;

  // Calculate VM-level storage metrics
  const vmProvisionedMiB = vms.reduce((sum, vm) => sum + vm.provisionedMiB, 0);
  const vmInUseMiB = vms.reduce((sum, vm) => sum + vm.inUseMiB, 0);
  const vmProvisionedTiB = mibToTiB(vmProvisionedMiB);
  const vmInUseTiB = mibToTiB(vmInUseMiB);
  const vmStorageEfficiency = vmProvisionedMiB > 0 ? (vmInUseMiB / vmProvisionedMiB) * 100 : 0;

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

  // Top storage consumers (VMs) - all VMs (no direct datastore link)
  const topStorageVMs = [...vms]
    .sort((a, b) => b.provisionedMiB - a.provisionedMiB)
    .slice(0, 15)
    .map(vm => ({
      label: vm.vmName,
      value: mibToGiB(vm.provisionedMiB),
    }));

  // Top datastores by usage - filtered
  const topDatastoresFiltered = [...filteredDatastores]
    .sort((a, b) => b.inUseMiB - a.inUseMiB)
    .slice(0, 15)
    .map((ds) => ({
      label: ds.name,
      value: mibToGiB(ds.inUseMiB),
    }));

  // Click handler for datastore type chart
  const handleTypeClick = (label: string) => {
    if (chartFilter?.value === label && chartFilter?.dimension === 'datastoreType') {
      clearFilter();
    } else {
      setFilter('datastoreType', label, 'typeChart');
    }
  };

  return (
    <div className="storage-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="storage-page__title">Storage Analysis</h1>
          <p className="storage-page__subtitle">
            Datastore capacity and utilization analysis
          </p>
          {chartFilter && chartFilter.dimension === 'datastoreType' && (
            <FilterBadge
              dimension="Datastore Type"
              value={extractTypeFromLabel(chartFilter.value)}
              onClear={clearFilter}
            />
          )}
        </Column>

        {/* Summary metrics */}
        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Total Capacity"
            value={`${totalCapacityTiB.toFixed(1)} TiB`}
            variant="purple"
            tooltip="Total raw capacity of all datastores."
            docSection="storage"
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Used Storage"
            value={`${totalUsedTiB.toFixed(1)} TiB`}
            variant="primary"
            tooltip="Total space consumed across all datastores."
            docSection="storage"
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Free Storage"
            value={`${totalFreeTiB.toFixed(1)} TiB`}
            variant="success"
            tooltip="Available free space across all datastores."
            docSection="storage"
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Avg Utilization"
            value={`${avgUtilization.toFixed(1)}%`}
            variant={avgUtilization > 80 ? 'warning' : 'info'}
            tooltip="Percentage of datastore capacity in use. Above 80% should be monitored."
            docSection="storage"
          />
        </Column>

        {/* VM Storage Metrics Section */}
        <Column lg={16} md={8} sm={4}>
          <h3 className="storage-page__section-title">VM Storage Allocation</h3>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="VM Provisioned"
            value={`${vmProvisionedTiB.toFixed(1)} TiB`}
            detail="Total allocated to VMs"
            variant="purple"
            tooltip="Total storage capacity allocated (thin + thick provisioned) to VMs."
            docSection="dashboard"
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="VM In Use"
            value={`${vmInUseTiB.toFixed(1)} TiB`}
            detail="Actually consumed"
            variant="primary"
            tooltip="Actual storage consumed by VMs on datastores."
            docSection="dashboard"
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Thin Savings"
            value={`${(vmProvisionedTiB - vmInUseTiB).toFixed(1)} TiB`}
            detail="Provisioned - In Use"
            variant="success"
            tooltip="Storage saved through thin provisioning (difference between allocated and used)."
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Storage Efficiency"
            value={`${vmStorageEfficiency.toFixed(0)}%`}
            detail="In Use / Provisioned"
            variant="info"
            tooltip="Percentage of provisioned storage that is actually in use."
            docSection="dashboard"
          />
        </Column>

        {/* Datastore Type Distribution */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="storage-page__chart-tile">
            <DoughnutChart
              title="Storage by Type"
              subtitle="Click a segment to filter datastores and VMs"
              data={typeChartData}
              height={280}
              formatValue={(v) => `${v.toFixed(1)} TiB`}
              onSegmentClick={handleTypeClick}
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
              title={chartFilter?.dimension === 'datastoreType'
                ? `Top Datastores (${filteredDatastores.length} ${extractTypeFromLabel(chartFilter.value)})`
                : 'Top 15 Datastores by Usage'}
              data={topDatastoresFiltered}
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
          <MetricCard
            label="Datastores"
            value={formatNumber(datastores.length)}
            variant="default"
            tooltip="Total number of datastores (VMFS, NFS, vSAN) in the environment."
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="High Util (>80%)"
            value={formatNumber(highUtilDatastores.length)}
            variant={highUtilDatastores.length > 0 ? 'warning' : 'success'}
            tooltip="Datastores with utilization above 80%. Consider freeing space before migration."
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="VMFS Datastores"
            value={formatNumber(datastores.filter(ds => ds.type === 'VMFS').length)}
            variant="default"
            tooltip="VMware File System datastores - traditional block-based storage."
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="NFS Datastores"
            value={formatNumber(datastores.filter(ds => ds.type === 'NFS').length)}
            variant="default"
            tooltip="Network File System datastores - file-based network storage."
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="vSAN Datastores"
            value={formatNumber(datastores.filter(ds => ds.type === 'vsan' || ds.type === 'VSAN').length)}
            variant="default"
            tooltip="VMware vSAN datastores - software-defined hyper-converged storage."
          />
        </Column>

        {/* Datastore Utilization Table */}
        {datastoreUtilTableData.length > 0 && (
          <Column lg={16} md={8} sm={4}>
            <Tile className="storage-page__chart-tile storage-page__table-tile">
              <h3>Datastore Utilization</h3>
              <p className="storage-page__table-subtitle">
                {chartFilter?.dimension === 'datastoreType'
                  ? `Showing ${datastoreUtilTableData.length} ${extractTypeFromLabel(chartFilter.value)} datastores`
                  : `All ${datastoreUtilTableData.length} datastores sorted by utilization`}
                {' '}<span style={{ color: 'var(--cds-support-success)' }}>●</span> &lt;50%
                {' '}<span style={{ color: 'var(--cds-support-warning)' }}>●</span> 50-80%
                {' '}<span style={{ color: 'var(--cds-support-error)' }}>●</span> &gt;80%
              </p>
              <EnhancedDataTable
                data={datastoreUtilTableData}
                columns={datastoreUtilColumns}
                enableSearch={true}
                enablePagination={true}
                enableSorting={true}
                enableExport={true}
                defaultPageSize={25}
                exportFilename="datastore-utilization"
              />
            </Tile>
          </Column>
        )}

        {/* Datastore Utilization Heatmap */}
        {datastoreUtilHeatmap.length > 0 && (
          <Column lg={16} md={8} sm={4}>
            <Tile className="storage-page__chart-tile">
              <Heatmap
                title="Datastore Utilization Heatmap"
                subtitle="Top 30 datastores by utilization (Green <50%, Yellow 50-80%, Red >80%)"
                data={datastoreUtilHeatmap}
                height={Math.min(600, 100 + datastoreUtilHeatmap.length * 28)}
                colorScale="utilization"
              />
            </Tile>
          </Column>
        )}

        {/* VM Table by Datastore */}
        {datastoreFilterOptions.length > 0 && (
          <Column lg={16} md={8} sm={4}>
            <Tile className="storage-page__vm-table-tile">
              <h3>VMs by Datastore</h3>
              <InlineNotification
                kind="info"
                lowContrast
                hideCloseButton
                title="Note:"
                subtitle="VM-datastore mapping is derived from vDisk paths. A VM may appear in multiple datastores if its disks span multiple datastores."
                style={{ marginBottom: '1rem' }}
              />
              <FilterableVMTable
                vms={filteredVMsByDatastore}
                filterOptions={datastoreFilterOptions}
                selectedFilter={selectedDatastore}
                onFilterChange={setSelectedDatastore}
                filterLabel="Datastore"
                title="Virtual Machines"
              />
            </Tile>
          </Column>
        )}
      </Grid>
    </div>
  );
}
