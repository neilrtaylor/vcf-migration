// Dashboard page - Executive summary
import { Grid, Column, Tile } from '@carbon/react';
import { useData, useVMs } from '@/hooks';
import { Navigate } from 'react-router-dom';
import { ROUTES } from '@/utils/constants';
import { formatNumber, mibToGiB } from '@/utils/formatters';
import { DoughnutChart, HorizontalBarChart } from '@/components/charts';
import { POWER_STATE_CHART_COLORS } from '@/utils/chartConfig';
import './DashboardPage.scss';

export function DashboardPage() {
  const { rawData } = useData();
  const vms = useVMs();

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

  const totalProvisionedMiB = vms.reduce((sum, vm) => sum + vm.provisionedMiB, 0);
  const totalProvisionedTiB = totalProvisionedMiB / 1024 / 1024;

  const uniqueClusters = new Set(vms.map(vm => vm.cluster).filter(Boolean)).size;
  const uniqueDatacenters = new Set(vms.map(vm => vm.datacenter).filter(Boolean)).size;

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

  // OS distribution data
  const osDistribution = vms.reduce((acc, vm) => {
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
        </Column>

        {/* Key Metrics Row */}
        <Column lg={4} md={4} sm={4}>
          <Tile className="dashboard-page__metric-tile">
            <span className="dashboard-page__metric-label">Total VMs</span>
            <span className="dashboard-page__metric-value">{formatNumber(totalVMs)}</span>
            <span className="dashboard-page__metric-detail">
              {formatNumber(poweredOnVMs)} powered on
            </span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={4}>
          <Tile className="dashboard-page__metric-tile">
            <span className="dashboard-page__metric-label">Total vCPUs</span>
            <span className="dashboard-page__metric-value">{formatNumber(totalVCPUs)}</span>
            <span className="dashboard-page__metric-detail">
              Avg {(totalVCPUs / totalVMs).toFixed(1)} per VM
            </span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={4}>
          <Tile className="dashboard-page__metric-tile">
            <span className="dashboard-page__metric-label">Total Memory</span>
            <span className="dashboard-page__metric-value">{totalMemoryGiB.toFixed(0)} GiB</span>
            <span className="dashboard-page__metric-detail">
              Avg {(totalMemoryGiB / totalVMs).toFixed(1)} GiB per VM
            </span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={4}>
          <Tile className="dashboard-page__metric-tile">
            <span className="dashboard-page__metric-label">Total Storage</span>
            <span className="dashboard-page__metric-value">{totalProvisionedTiB.toFixed(1)} TiB</span>
            <span className="dashboard-page__metric-detail">
              Provisioned capacity
            </span>
          </Tile>
        </Column>

        {/* Secondary Metrics */}
        <Column lg={4} md={4} sm={2}>
          <Tile className="dashboard-page__secondary-tile">
            <span className="dashboard-page__metric-label">Templates</span>
            <span className="dashboard-page__secondary-value">{formatNumber(templates)}</span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className="dashboard-page__secondary-tile">
            <span className="dashboard-page__metric-label">Clusters</span>
            <span className="dashboard-page__secondary-value">{formatNumber(uniqueClusters)}</span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className="dashboard-page__secondary-tile">
            <span className="dashboard-page__metric-label">Datacenters</span>
            <span className="dashboard-page__secondary-value">{formatNumber(uniqueDatacenters)}</span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className="dashboard-page__secondary-tile">
            <span className="dashboard-page__metric-label">Datastores</span>
            <span className="dashboard-page__secondary-value">{formatNumber(rawData.vDatastore.length)}</span>
          </Tile>
        </Column>

        {/* Charts */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="dashboard-page__chart-tile">
            <DoughnutChart
              title="Power State Distribution"
              data={powerStateData}
              colors={powerStateColors}
              height={280}
              formatValue={(v) => `${v} VMs`}
            />
          </Tile>
        </Column>

        <Column lg={8} md={8} sm={4}>
          <Tile className="dashboard-page__chart-tile">
            <HorizontalBarChart
              title="Top 10 Operating Systems"
              data={osChartData}
              height={280}
              valueLabel="VMs"
              formatValue={(v) => `${v} VMs`}
            />
          </Tile>
        </Column>
      </Grid>
    </div>
  );
}
