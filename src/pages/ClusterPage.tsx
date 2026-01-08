// Cluster and Host analysis page
import { Grid, Column, Tile } from '@carbon/react';
import { Navigate } from 'react-router-dom';
import { useData } from '@/hooks';
import { ROUTES } from '@/utils/constants';
import { formatNumber, formatMiB, mibToGiB } from '@/utils/formatters';
import { HorizontalBarChart, DoughnutChart, VerticalBarChart } from '@/components/charts';
import { MetricCard, RedHatDocLinksGroup } from '@/components/common';
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
  const totalCpuCores = hosts.reduce((sum, h) => sum + h.totalCpuCores, 0);
  const totalMemoryMiB = hosts.reduce((sum, h) => sum + h.memoryMiB, 0);

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

  // ESXi version distribution
  const esxiVersions = hosts.reduce((acc, host) => {
    const version = host.esxiVersion || 'Unknown';
    acc[version] = (acc[version] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const esxiVersionChartData = Object.entries(esxiVersions)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // Host CPU model distribution
  const cpuModels = hosts.reduce((acc, host) => {
    // Simplify CPU model name for display
    const model = host.cpuModel
      ? host.cpuModel.replace(/\(R\)|\(TM\)|CPU|@.*/gi, '').trim().substring(0, 40)
      : 'Unknown';
    acc[model] = (acc[model] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const cpuModelChartData = Object.entries(cpuModels)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Host vendor distribution
  const hostVendors = hosts.reduce((acc, host) => {
    const vendor = host.vendor || 'Unknown';
    acc[vendor] = (acc[vendor] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const vendorChartData = Object.entries(hostVendors)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

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

  // Top hosts by VM count
  const topHostsByVmCount = hosts
    .map(h => ({
      label: `${h.name} (${h.cluster})`,
      value: h.vmCount,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  // Top hosts by memory
  const topHostsByMemory = hosts
    .map(h => ({
      label: `${h.name}`,
      value: Math.round(mibToGiB(h.memoryMiB)),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  // Top hosts by CPU cores
  const topHostsByCores = hosts
    .map(h => ({
      label: `${h.name}`,
      value: h.totalCpuCores,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  // Host CPU utilization distribution
  const cpuUtilBuckets = hosts.reduce((acc, host) => {
    const utilPercent = host.cpuMHz > 0 ? (host.cpuUsageMHz / (host.cpuMHz * host.totalCpuCores)) * 100 : 0;
    const bucket = utilPercent < 20 ? '0-20%' :
                   utilPercent < 40 ? '20-40%' :
                   utilPercent < 60 ? '40-60%' :
                   utilPercent < 80 ? '60-80%' : '80-100%';
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const cpuUtilChartData = ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%']
    .map(bucket => ({
      label: bucket,
      value: cpuUtilBuckets[bucket] || 0,
    }))
    .filter(d => d.value > 0);

  // Host memory utilization distribution
  const memUtilBuckets = hosts.reduce((acc, host) => {
    const utilPercent = host.memoryMiB > 0 ? (host.memoryUsageMiB / host.memoryMiB) * 100 : 0;
    const bucket = utilPercent < 20 ? '0-20%' :
                   utilPercent < 40 ? '20-40%' :
                   utilPercent < 60 ? '40-60%' :
                   utilPercent < 80 ? '60-80%' : '80-100%';
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const memUtilChartData = ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%']
    .map(bucket => ({
      label: bucket,
      value: memUtilBuckets[bucket] || 0,
    }))
    .filter(d => d.value > 0);

  // Sockets per host distribution
  const socketsDistribution = hosts.reduce((acc, host) => {
    const sockets = `${host.cpuSockets} socket${host.cpuSockets !== 1 ? 's' : ''}`;
    acc[sockets] = (acc[sockets] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const socketsChartData = Object.entries(socketsDistribution)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => {
      const aNum = parseInt(a.label);
      const bNum = parseInt(b.label);
      return aNum - bNum;
    });

  // VM density metrics
  const avgVmsPerHost = hosts.length > 0
    ? (vms.length / hosts.length).toFixed(1)
    : '0';
  const avgVmsPerCluster = clusters.length > 0
    ? (vms.length / clusters.length).toFixed(1)
    : '0';

  // Resource ratios
  const totalVmCpus = vms.reduce((sum, vm) => sum + vm.cpus, 0);
  const totalVmMemoryMiB = vms.reduce((sum, vm) => sum + vm.memory, 0);
  const cpuOvercommitRatio = totalCpuCores > 0
    ? (totalVmCpus / totalCpuCores).toFixed(2)
    : 'N/A';
  const memoryOvercommitRatio = totalMemoryMiB > 0
    ? (totalVmMemoryMiB / totalMemoryMiB).toFixed(2)
    : 'N/A';

  // Health indicators
  const hostsNotConnected = hosts.filter(h => h.connectionState !== 'connected').length;
  const hostsHighCpuUtil = hosts.filter(h => {
    const util = h.cpuMHz > 0 ? (h.cpuUsageMHz / (h.cpuMHz * h.totalCpuCores)) * 100 : 0;
    return util > 80;
  }).length;
  const hostsHighMemUtil = hosts.filter(h => {
    const util = h.memoryMiB > 0 ? (h.memoryUsageMiB / h.memoryMiB) * 100 : 0;
    return util > 80;
  }).length;

  return (
    <div className="cluster-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="cluster-page__title">Cluster & Host Analysis</h1>
          <p className="cluster-page__subtitle">
            Physical infrastructure and cluster configuration analysis
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
            detail={`${avgVmsPerHost} VMs/host avg`}
            variant="info"
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Total CPU Cores"
            value={formatNumber(totalCpuCores)}
            detail={`${cpuOvercommitRatio}:1 vCPU ratio`}
            variant="teal"
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Total Memory"
            value={formatMiB(totalMemoryMiB, 0)}
            detail={`${memoryOvercommitRatio}:1 memory ratio`}
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

        {/* ESXi Version Distribution */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="cluster-page__chart-tile">
            <DoughnutChart
              title="ESXi Version Distribution"
              subtitle="Host operating system versions"
              data={esxiVersionChartData}
              height={280}
              formatValue={(v) => `${v} host${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>

        {/* Host Vendor Distribution */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="cluster-page__chart-tile">
            <DoughnutChart
              title="Host Hardware Vendors"
              subtitle="Server manufacturer distribution"
              data={vendorChartData}
              height={280}
              formatValue={(v) => `${v} host${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>

        {/* CPU Model Distribution */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="cluster-page__chart-tile">
            <HorizontalBarChart
              title="CPU Model Distribution"
              subtitle="Processor types across hosts"
              data={cpuModelChartData}
              height={320}
              valueLabel="Hosts"
              formatValue={(v) => `${v} host${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>

        {/* Socket Configuration */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="cluster-page__chart-tile">
            <VerticalBarChart
              title="Socket Configuration"
              subtitle="CPU sockets per host"
              data={socketsChartData}
              height={280}
              valueLabel="Hosts"
              formatValue={(v) => `${v} host${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>

        {/* CPU Utilization Distribution */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="cluster-page__chart-tile">
            <VerticalBarChart
              title="Host CPU Utilization"
              subtitle="Current CPU utilization distribution"
              data={cpuUtilChartData}
              height={280}
              valueLabel="Hosts"
              formatValue={(v) => `${v} host${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>

        {/* Memory Utilization Distribution */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="cluster-page__chart-tile">
            <VerticalBarChart
              title="Host Memory Utilization"
              subtitle="Current memory utilization distribution"
              data={memUtilChartData}
              height={280}
              valueLabel="Hosts"
              formatValue={(v) => `${v} host${v !== 1 ? 's' : ''}`}
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

        {/* Top Hosts by VM Count */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="cluster-page__chart-tile">
            <HorizontalBarChart
              title="Top 15 Hosts by VM Count"
              subtitle="VM density per host"
              data={topHostsByVmCount}
              height={320}
              valueLabel="VMs"
              formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>

        {/* Top Hosts by Memory */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="cluster-page__chart-tile">
            <HorizontalBarChart
              title="Top 15 Hosts by Memory"
              subtitle="Physical memory capacity"
              data={topHostsByMemory}
              height={320}
              valueLabel="GiB"
              formatValue={(v) => `${v} GiB`}
            />
          </Tile>
        </Column>

        {/* Top Hosts by CPU Cores */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="cluster-page__chart-tile">
            <HorizontalBarChart
              title="Top 15 Hosts by CPU Cores"
              subtitle="Physical CPU core count"
              data={topHostsByCores}
              height={380}
              valueLabel="Cores"
              formatValue={(v) => `${v} core${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>

        {/* Health indicators */}
        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Disconnected Hosts"
            value={formatNumber(hostsNotConnected)}
            variant={hostsNotConnected > 0 ? 'error' : 'success'}
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="High CPU (>80%)"
            value={formatNumber(hostsHighCpuUtil)}
            variant={hostsHighCpuUtil > 0 ? 'warning' : 'success'}
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="High Memory (>80%)"
            value={formatNumber(hostsHighMemUtil)}
            variant={hostsHighMemUtil > 0 ? 'warning' : 'success'}
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Hyperthreading Enabled"
            value={formatNumber(hosts.filter(h => h.hyperthreading).length)}
            variant="info"
          />
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
