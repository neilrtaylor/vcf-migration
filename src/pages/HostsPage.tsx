// Host analysis page
import { Grid, Column, Tile, Tag } from '@carbon/react';
import { Navigate } from 'react-router-dom';
import { useData } from '@/hooks';
import { ROUTES } from '@/utils/constants';
import { formatNumber, formatMiB, mibToGiB } from '@/utils/formatters';
import { HorizontalBarChart, DoughnutChart, VerticalBarChart } from '@/components/charts';
import { MetricCard, RedHatDocLinksGroup, RedHatDocLink } from '@/components/common';
import esxiVersions from '@/data/esxiVersions.json';
import './HostsPage.scss';

// Get ESXi version status
function getEsxiVersionStatus(version: string): { status: string; label: string; color: string } {
  const versions = esxiVersions.versions as Record<string, { status: string; statusLabel: string; color: string }>;

  // Try to match version prefix
  for (const [key, info] of Object.entries(versions)) {
    if (version.includes(key)) {
      return { status: info.status, label: info.statusLabel, color: info.color };
    }
  }

  // Default for unknown versions
  return { status: 'unknown', label: 'Unknown', color: 'gray' };
}

export function HostsPage() {
  const { rawData } = useData();

  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  const hosts = rawData.vHost;
  const vms = rawData.vInfo.filter(vm => !vm.template);

  // Summary metrics
  const totalHosts = hosts.length;
  const totalCpuCores = hosts.reduce((sum, h) => sum + h.totalCpuCores, 0);
  const totalMemoryMiB = hosts.reduce((sum, h) => sum + h.memoryMiB, 0);

  // Resource ratios
  const totalVmCpus = vms.reduce((sum, vm) => sum + vm.cpus, 0);
  const totalVmMemoryMiB = vms.reduce((sum, vm) => sum + vm.memory, 0);
  const cpuOvercommitRatio = totalCpuCores > 0
    ? (totalVmCpus / totalCpuCores).toFixed(2)
    : 'N/A';
  const memoryOvercommitRatio = totalMemoryMiB > 0
    ? (totalVmMemoryMiB / totalMemoryMiB).toFixed(2)
    : 'N/A';

  // VM density metric
  const avgVmsPerHost = hosts.length > 0
    ? (vms.length / hosts.length).toFixed(1)
    : '0';

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

  // Host model distribution
  const hostModels = hosts.reduce((acc, host) => {
    const model = host.model || 'Unknown';
    acc[model] = (acc[model] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const modelChartData = Object.entries(hostModels)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

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
      label: h.name,
      value: Math.round(mibToGiB(h.memoryMiB)),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  // Top hosts by CPU cores
  const topHostsByCores = hosts
    .map(h => ({
      label: h.name,
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

  // ESXi version lifecycle status
  const esxiVersionCounts = hosts.reduce((acc, host) => {
    const version = host.esxiVersion || 'Unknown';
    if (!acc[version]) acc[version] = { count: 0, status: getEsxiVersionStatus(version) };
    acc[version].count++;
    return acc;
  }, {} as Record<string, { count: number; status: { status: string; label: string; color: string } }>);

  const esxiEOLHosts = Object.entries(esxiVersionCounts)
    .filter(([, data]) => data.status.status === 'eol')
    .reduce((sum, [, data]) => sum + data.count, 0);

  // Host core count checks
  const hostsOver64Cores = hosts.filter(h => h.totalCpuCores > 64 && h.totalCpuCores <= 128);
  const hostsOver128Cores = hosts.filter(h => h.totalCpuCores > 128);

  // Memory balloon detection
  const vMemory = rawData.vMemory;
  const poweredOnVMs = vms.filter(vm => vm.powerState === 'poweredOn');
  const vMemoryMap = new Map(vMemory.map(m => [m.vmName, m]));
  const vmsWithBalloon = poweredOnVMs.filter(vm => {
    const memInfo = vMemoryMap.get(vm.vmName);
    return memInfo && (memInfo.ballooned || 0) > 0;
  });

  // Large memory VMs
  const MEMORY_2TB_MIB = 2 * 1024 * 1024; // 2TB in MiB
  const MEMORY_6TB_MIB = 6 * 1024 * 1024; // 6TB in MiB
  const vmsOver2TB = poweredOnVMs.filter(vm => vm.memory >= MEMORY_2TB_MIB && vm.memory < MEMORY_6TB_MIB);
  const vmsOver6TB = poweredOnVMs.filter(vm => vm.memory >= MEMORY_6TB_MIB);

  // Licensing info
  const licenses = rawData.vLicense;

  return (
    <div className="hosts-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="hosts-page__title">Host Analysis</h1>
          <p className="hosts-page__subtitle">
            ESXi host hardware and utilization analysis
          </p>
        </Column>

        {/* Summary metrics */}
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

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Hyperthreading"
            value={formatNumber(hosts.filter(h => h.hyperthreading).length)}
            detail={`of ${totalHosts} hosts enabled`}
            variant="primary"
          />
        </Column>

        {/* ESXi Version Distribution */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="hosts-page__chart-tile">
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
          <Tile className="hosts-page__chart-tile">
            <DoughnutChart
              title="Host Hardware Vendors"
              subtitle="Server manufacturer distribution"
              data={vendorChartData}
              height={280}
              formatValue={(v) => `${v} host${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>

        {/* Host Model Distribution */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="hosts-page__chart-tile">
            <HorizontalBarChart
              title="Host Model Distribution"
              subtitle="Server hardware models"
              data={modelChartData}
              height={320}
              valueLabel="Hosts"
              formatValue={(v) => `${v} host${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>

        {/* CPU Model Distribution */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="hosts-page__chart-tile">
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
          <Tile className="hosts-page__chart-tile">
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
          <Tile className="hosts-page__chart-tile">
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
          <Tile className="hosts-page__chart-tile">
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

        {/* Health indicators */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="hosts-page__health-tile">
            <h4>Host Health Indicators</h4>
            <Grid narrow>
              <Column lg={8} md={4} sm={2}>
                <MetricCard
                  label="Disconnected Hosts"
                  value={formatNumber(hostsNotConnected)}
                  variant={hostsNotConnected > 0 ? 'error' : 'success'}
                />
              </Column>
              <Column lg={8} md={4} sm={2}>
                <MetricCard
                  label="High CPU (>80%)"
                  value={formatNumber(hostsHighCpuUtil)}
                  variant={hostsHighCpuUtil > 0 ? 'warning' : 'success'}
                />
              </Column>
              <Column lg={8} md={4} sm={2}>
                <MetricCard
                  label="High Memory (>80%)"
                  value={formatNumber(hostsHighMemUtil)}
                  variant={hostsHighMemUtil > 0 ? 'warning' : 'success'}
                />
              </Column>
            </Grid>
          </Tile>
        </Column>

        {/* Top Hosts by VM Count */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="hosts-page__chart-tile">
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
          <Tile className="hosts-page__chart-tile">
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
          <Tile className="hosts-page__chart-tile">
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

        {/* ESXi Version Lifecycle Status */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="hosts-page__list-tile">
            <h4>ESXi Version Lifecycle Status</h4>
            <div className="hosts-page__version-list">
              {Object.entries(esxiVersionCounts)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([version, data]) => (
                  <div key={version} className="hosts-page__version-item">
                    <span className="hosts-page__version-name">{version}</span>
                    <div className="hosts-page__version-tags">
                      <Tag type={data.status.color === 'green' ? 'green' : data.status.color === 'red' ? 'red' : 'gray'}>
                        {data.status.label}
                      </Tag>
                      <Tag type="blue">{data.count} host{data.count !== 1 ? 's' : ''}</Tag>
                    </div>
                  </div>
                ))}
            </div>
            {esxiEOLHosts > 0 && (
              <div className="hosts-page__warning-note">
                <strong>Warning:</strong> {esxiEOLHosts} host{esxiEOLHosts !== 1 ? 's are' : ' is'} running end-of-life ESXi versions.
              </div>
            )}
          </Tile>
        </Column>

        {/* Host Core Count Checks */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="hosts-page__checks-tile">
            <h4>Host Core Count Checks</h4>
            <div className="hosts-page__check-items">
              <div className="hosts-page__check-item">
                <span>Hosts with 64-128 Cores</span>
                <Tag type={hostsOver64Cores.length === 0 ? 'green' : 'teal'}>
                  {hostsOver64Cores.length}
                </Tag>
              </div>
              <div className="hosts-page__check-item">
                <span>Hosts with &gt;128 Cores</span>
                <Tag type={hostsOver128Cores.length === 0 ? 'green' : 'magenta'}>
                  {hostsOver128Cores.length}
                </Tag>
              </div>
            </div>
            {hostsOver128Cores.length > 0 && (
              <div className="hosts-page__host-list">
                {hostsOver128Cores.slice(0, 5).map(h => (
                  <div key={h.name} className="hosts-page__host-detail">
                    <span>{h.name}</span>
                    <Tag type="gray">{h.totalCpuCores} cores</Tag>
                  </div>
                ))}
              </div>
            )}
          </Tile>
        </Column>

        {/* Memory Checks */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="hosts-page__checks-tile">
            <h4>VM Memory Checks</h4>
            <div className="hosts-page__check-items">
              <div className="hosts-page__check-item">
                <span>VMs with Memory Balloon</span>
                <Tag type={vmsWithBalloon.length === 0 ? 'green' : 'magenta'}>
                  {vmsWithBalloon.length}
                </Tag>
              </div>
              <div className="hosts-page__check-item">
                <span>VMs with 2-6TB Memory</span>
                <Tag type={vmsOver2TB.length === 0 ? 'green' : 'magenta'}>
                  {vmsOver2TB.length}
                </Tag>
              </div>
              <div className="hosts-page__check-item">
                <span>VMs with &gt;6TB Memory</span>
                <Tag type={vmsOver6TB.length === 0 ? 'green' : 'red'}>
                  {vmsOver6TB.length}
                </Tag>
              </div>
            </div>
          </Tile>
        </Column>

        {/* Hardware Compatibility Info */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="hosts-page__info-tile">
            <h4>Hardware Compatibility</h4>
            <p>
              Review your host hardware models against the target platform's compatibility list.
              Some server models may require specific drivers or configurations.
            </p>
            <div className="hosts-page__links">
              <RedHatDocLink
                href="https://catalog.redhat.com/hardware"
                label="Red Hat Hardware Catalog"
                description="Check server compatibility for RHEL and OpenShift"
              />
            </div>
          </Tile>
        </Column>

        {/* VMs with Memory Ballooning List */}
        {vmsWithBalloon.length > 0 && (
          <Column lg={16} md={8} sm={4}>
            <Tile className="hosts-page__list-tile">
              <h4>VMs with Active Memory Ballooning</h4>
              <div className="hosts-page__balloon-list">
                {vmsWithBalloon.slice(0, 20).map(vm => {
                  const memInfo = vMemoryMap.get(vm.vmName);
                  return (
                    <div key={vm.vmName} className="hosts-page__balloon-item">
                      <span className="hosts-page__balloon-name">{vm.vmName}</span>
                      <div className="hosts-page__balloon-tags">
                        <Tag type="gray">{mibToGiB(vm.memory).toFixed(0)} GiB configured</Tag>
                        <Tag type="magenta">{mibToGiB(memInfo?.ballooned || 0).toFixed(0)} GiB ballooned</Tag>
                      </div>
                    </div>
                  );
                })}
                {vmsWithBalloon.length > 20 && (
                  <p className="hosts-page__more">
                    ... and {vmsWithBalloon.length - 20} more VMs
                  </p>
                )}
              </div>
            </Tile>
          </Column>
        )}

        {/* VMware Licensing */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="hosts-page__list-tile">
            <h4>VMware Licensing</h4>
            {licenses.length > 0 ? (
              <div className="hosts-page__license-list">
                {licenses.map((license, idx) => (
                  <div key={idx} className="hosts-page__license-item">
                    <div className="hosts-page__license-name">
                      <strong>{license.productName || license.name}</strong>
                      {license.productVersion && (
                        <span className="hosts-page__license-version">
                          v{license.productVersion}
                        </span>
                      )}
                    </div>
                    <div className="hosts-page__license-details">
                      <Tag type="blue">{license.used}/{license.total} used</Tag>
                      {license.expirationDate && (
                        <Tag type={new Date(license.expirationDate) < new Date() ? 'red' : 'green'}>
                          Expires: {new Date(license.expirationDate).toLocaleDateString()}
                        </Tag>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="hosts-page__empty">
                No license information available in the RVTools export.
                Ensure the vLicense tab is included in the export.
              </p>
            )}
            <div className="hosts-page__info-note">
              VMware licenses are not transferable to OpenShift Virtualization.
              Windows and other guest OS licenses may need to be re-evaluated.
            </div>
          </Tile>
        </Column>

        {/* Documentation Links */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="hosts-page__docs-tile">
            <RedHatDocLinksGroup
              title="OpenShift Virtualization Host Resources"
              links={[
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
                {
                  href: 'https://access.redhat.com/documentation/en-us/openshift_container_platform/latest/html/virtualization/getting-started',
                  label: 'Getting Started',
                  description: 'Getting started with OpenShift Virtualization',
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
