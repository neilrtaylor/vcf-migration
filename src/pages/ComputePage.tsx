// Compute analysis page
import { Grid, Column, Tile } from '@carbon/react';
import { Navigate } from 'react-router-dom';
import { useData, useVMs, useChartFilter } from '@/hooks';
import { ROUTES } from '@/utils/constants';
import { formatNumber, mibToGiB } from '@/utils/formatters';
import { HorizontalBarChart, VerticalBarChart, Heatmap } from '@/components/charts';
import type { HeatmapCell } from '@/components/charts';
import { FilterBadge } from '@/components/common/FilterBadge';
import './ComputePage.scss';

// Helper to get CPU bucket for a VM
function getCPUBucket(cpus: number): string {
  if (cpus >= 1 && cpus <= 2) return '1-2 vCPUs';
  if (cpus >= 3 && cpus <= 4) return '3-4 vCPUs';
  if (cpus >= 5 && cpus <= 8) return '5-8 vCPUs';
  if (cpus >= 9 && cpus <= 16) return '9-16 vCPUs';
  if (cpus >= 17 && cpus <= 32) return '17-32 vCPUs';
  return '33+ vCPUs';
}

// Helper to get memory bucket for a VM
function getMemoryBucket(memoryMiB: number): string {
  const memGiB = mibToGiB(memoryMiB);
  if (memGiB >= 0 && memGiB <= 4) return '0-4 GiB';
  if (memGiB > 4 && memGiB <= 8) return '5-8 GiB';
  if (memGiB > 8 && memGiB <= 16) return '9-16 GiB';
  if (memGiB > 16 && memGiB <= 32) return '17-32 GiB';
  if (memGiB > 32 && memGiB <= 64) return '33-64 GiB';
  return '65+ GiB';
}

export function ComputePage() {
  const { rawData } = useData();
  const vms = useVMs();
  const { chartFilter, setFilter, clearFilter } = useChartFilter();

  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  // Calculate compute metrics
  const poweredOnVMs = vms.filter(vm => vm.powerState === 'poweredOn');
  const totalVCPUs = vms.reduce((sum, vm) => sum + vm.cpus, 0);
  const poweredOnVCPUs = poweredOnVMs.reduce((sum, vm) => sum + vm.cpus, 0);
  const totalMemoryGiB = mibToGiB(vms.reduce((sum, vm) => sum + vm.memory, 0));
  const poweredOnMemoryGiB = mibToGiB(poweredOnVMs.reduce((sum, vm) => sum + vm.memory, 0));

  // CPU distribution
  const cpuBuckets = ['1-2', '3-4', '5-8', '9-16', '17-32', '33+'];
  const cpuDistribution = cpuBuckets.map(bucket => {
    const count = vms.filter(vm => {
      const cpus = vm.cpus;
      switch (bucket) {
        case '1-2': return cpus >= 1 && cpus <= 2;
        case '3-4': return cpus >= 3 && cpus <= 4;
        case '5-8': return cpus >= 5 && cpus <= 8;
        case '9-16': return cpus >= 9 && cpus <= 16;
        case '17-32': return cpus >= 17 && cpus <= 32;
        case '33+': return cpus > 32;
        default: return false;
      }
    }).length;
    return { label: `${bucket} vCPUs`, value: count };
  }).filter(d => d.value > 0);

  // Memory distribution
  const memBuckets = ['0-4', '5-8', '9-16', '17-32', '33-64', '65+'];
  const memoryDistribution = memBuckets.map(bucket => {
    const count = vms.filter(vm => {
      const memGiB = mibToGiB(vm.memory);
      switch (bucket) {
        case '0-4': return memGiB >= 0 && memGiB <= 4;
        case '5-8': return memGiB > 4 && memGiB <= 8;
        case '9-16': return memGiB > 8 && memGiB <= 16;
        case '17-32': return memGiB > 16 && memGiB <= 32;
        case '33-64': return memGiB > 32 && memGiB <= 64;
        case '65+': return memGiB > 64;
        default: return false;
      }
    }).length;
    return { label: `${bucket} GiB`, value: count };
  }).filter(d => d.value > 0);

  // Filter VMs based on active chart filter
  const filteredVMs = chartFilter
    ? vms.filter(vm => {
        if (chartFilter.dimension === 'cpuBucket') {
          return getCPUBucket(vm.cpus) === chartFilter.value;
        }
        if (chartFilter.dimension === 'memoryBucket') {
          return getMemoryBucket(vm.memory) === chartFilter.value;
        }
        return true;
      })
    : vms;

  // Top CPU consumers (filtered)
  const topCPUConsumers = [...filteredVMs]
    .sort((a, b) => b.cpus - a.cpus)
    .slice(0, 15)
    .map(vm => ({ label: vm.vmName, value: vm.cpus }));

  // Top memory consumers (filtered)
  const topMemoryConsumers = [...filteredVMs]
    .sort((a, b) => b.memory - a.memory)
    .slice(0, 15)
    .map(vm => ({ label: vm.vmName, value: mibToGiB(vm.memory) }));

  // Click handlers for drill-down
  const handleCPUBarClick = (label: string) => {
    if (chartFilter?.value === label && chartFilter?.dimension === 'cpuBucket') {
      clearFilter();
    } else {
      setFilter('cpuBucket', label, 'cpuDistribution');
    }
  };

  const handleMemoryBarClick = (label: string) => {
    if (chartFilter?.value === label && chartFilter?.dimension === 'memoryBucket') {
      clearFilter();
    } else {
      setFilter('memoryBucket', label, 'memoryDistribution');
    }
  };

  // Host overcommitment heatmap data
  const hosts = rawData.vHost || [];
  const hostOvercommitData: HeatmapCell[] = hosts
    .filter(host => host.totalCpuCores > 0 && host.memoryMiB > 0)
    .slice(0, 20) // Limit to 20 hosts for readability
    .flatMap(host => {
      const cpuRatio = host.vmCpuCount / host.totalCpuCores;
      const memRatio = host.vmMemoryMiB / host.memoryMiB;
      const hostName = host.name.length > 25 ? host.name.substring(0, 22) + '...' : host.name;
      return [
        {
          row: hostName,
          col: 'CPU',
          value: cpuRatio,
          label: `${cpuRatio.toFixed(1)}x`,
        },
        {
          row: hostName,
          col: 'Memory',
          value: memRatio,
          label: `${memRatio.toFixed(1)}x`,
        },
      ];
    });

  return (
    <div className="compute-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="compute-page__title">Compute Analysis</h1>
          <p className="compute-page__subtitle">
            CPU and memory resource analysis
          </p>
          {chartFilter && (
            <FilterBadge
              dimension={chartFilter.dimension === 'cpuBucket' ? 'vCPU Range' : 'Memory Range'}
              value={chartFilter.value}
              onClear={clearFilter}
            />
          )}
        </Column>

        {/* Summary metrics */}
        <Column lg={4} md={4} sm={2}>
          <Tile className="compute-page__metric-tile">
            <span className="compute-page__metric-label">Total vCPUs</span>
            <span className="compute-page__metric-value">{formatNumber(totalVCPUs)}</span>
            <span className="compute-page__metric-detail">{formatNumber(poweredOnVCPUs)} powered on</span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className="compute-page__metric-tile">
            <span className="compute-page__metric-label">Total Memory</span>
            <span className="compute-page__metric-value">{totalMemoryGiB.toFixed(0)} GiB</span>
            <span className="compute-page__metric-detail">{poweredOnMemoryGiB.toFixed(0)} GiB powered on</span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className="compute-page__metric-tile">
            <span className="compute-page__metric-label">Avg vCPUs/VM</span>
            <span className="compute-page__metric-value">{(totalVCPUs / vms.length).toFixed(1)}</span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className="compute-page__metric-tile">
            <span className="compute-page__metric-label">Avg Memory/VM</span>
            <span className="compute-page__metric-value">{(totalMemoryGiB / vms.length).toFixed(1)} GiB</span>
          </Tile>
        </Column>

        {/* CPU Distribution */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="compute-page__chart-tile">
            <VerticalBarChart
              title="vCPU Distribution"
              subtitle="Click a bar to filter top consumers"
              data={cpuDistribution}
              height={280}
              valueLabel="VMs"
              formatValue={(v) => `${v} VMs`}
              onBarClick={handleCPUBarClick}
            />
          </Tile>
        </Column>

        {/* Memory Distribution */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="compute-page__chart-tile">
            <VerticalBarChart
              title="Memory Distribution"
              subtitle="Click a bar to filter top consumers"
              data={memoryDistribution}
              height={280}
              valueLabel="VMs"
              formatValue={(v) => `${v} VMs`}
              onBarClick={handleMemoryBarClick}
            />
          </Tile>
        </Column>

        {/* Top CPU Consumers */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="compute-page__chart-tile">
            <HorizontalBarChart
              title={chartFilter ? `Top CPU Consumers (${filteredVMs.length} VMs)` : 'Top 15 CPU Consumers'}
              data={topCPUConsumers}
              height={400}
              valueLabel="vCPUs"
              formatValue={(v) => `${v} vCPUs`}
            />
          </Tile>
        </Column>

        {/* Top Memory Consumers */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="compute-page__chart-tile">
            <HorizontalBarChart
              title={chartFilter ? `Top Memory Consumers (${filteredVMs.length} VMs)` : 'Top 15 Memory Consumers'}
              data={topMemoryConsumers}
              height={400}
              valueLabel="Memory"
              formatValue={(v) => `${v.toFixed(1)} GiB`}
            />
          </Tile>
        </Column>

        {/* Host Overcommitment Heatmap */}
        {hostOvercommitData.length > 0 && (
          <Column lg={16} md={8} sm={4}>
            <Tile className="compute-page__chart-tile">
              <Heatmap
                title="Host Overcommitment Ratios"
                subtitle="CPU and memory overcommit ratios per host (Green <1.5x, Yellow 1.5-2.5x, Red >2.5x)"
                data={hostOvercommitData}
                height={Math.min(500, 100 + hosts.length * 30)}
                colorScale="overcommit"
              />
            </Tile>
          </Column>
        )}
      </Grid>
    </div>
  );
}
