// Configuration analysis page
import { Grid, Column, Tile, Tag } from '@carbon/react';
import { Navigate } from 'react-router-dom';
import { useData } from '@/hooks';
import { ROUTES, HW_VERSION_MINIMUM, HW_VERSION_RECOMMENDED, SNAPSHOT_WARNING_AGE_DAYS, SNAPSHOT_BLOCKER_AGE_DAYS } from '@/utils/constants';
import { formatNumber, getHardwareVersionNumber, formatHardwareVersion } from '@/utils/formatters';
import { HorizontalBarChart, DoughnutChart, VerticalBarChart } from '@/components/charts';
import { MetricCard } from '@/components/common';
import './ConfigPage.scss';

export function ConfigPage() {
  const { rawData } = useData();

  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  const vms = rawData.vInfo.filter(vm => !vm.template);
  const tools = rawData.vTools;
  const snapshots = rawData.vSnapshot;
  const cdDrives = rawData.vCD;

  // Hardware version distribution
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

  // Hardware version compliance
  const outdatedHWCount = vms.filter(vm =>
    getHardwareVersionNumber(vm.hardwareVersion) < HW_VERSION_MINIMUM
  ).length;
  const recommendedHWCount = vms.filter(vm =>
    getHardwareVersionNumber(vm.hardwareVersion) >= HW_VERSION_RECOMMENDED
  ).length;

  // VMware Tools status distribution
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

  // Guest OS distribution (grouped by family)
  const osDistribution = vms.reduce((acc, vm) => {
    const os = vm.guestOS || 'Unknown';
    // Group by OS family
    let family = 'Other';
    if (os.toLowerCase().includes('windows')) {
      family = 'Windows';
    } else if (os.toLowerCase().includes('rhel') || os.toLowerCase().includes('red hat')) {
      family = 'RHEL';
    } else if (os.toLowerCase().includes('centos')) {
      family = 'CentOS';
    } else if (os.toLowerCase().includes('ubuntu')) {
      family = 'Ubuntu';
    } else if (os.toLowerCase().includes('suse') || os.toLowerCase().includes('sles')) {
      family = 'SUSE';
    } else if (os.toLowerCase().includes('debian')) {
      family = 'Debian';
    } else if (os.toLowerCase().includes('oracle') && os.toLowerCase().includes('linux')) {
      family = 'Oracle Linux';
    } else if (os.toLowerCase().includes('linux')) {
      family = 'Other Linux';
    }
    acc[family] = (acc[family] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const osChartData = Object.entries(osDistribution)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // Firmware type distribution (BIOS vs UEFI)
  const firmwareDistribution = vms.reduce((acc, vm) => {
    const firmware = vm.firmwareType || 'BIOS';
    const normalizedFirmware = firmware.toLowerCase().includes('efi') ? 'UEFI' : 'BIOS';
    acc[normalizedFirmware] = (acc[normalizedFirmware] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const firmwareChartData = Object.entries(firmwareDistribution)
    .map(([label, value]) => ({ label, value }))
    .filter(d => d.value > 0);

  // CD-ROM connected status
  const vmsWithCdConnected = new Set(cdDrives.filter(cd => cd.connected).map(cd => cd.vmName)).size;

  // Snapshot analysis
  const snapshotsByAge = snapshots.reduce((acc, snap) => {
    const age = snap.ageInDays;
    const bucket = age <= 7 ? '0-7 days' :
                   age <= 30 ? '8-30 days' :
                   age <= 90 ? '31-90 days' :
                   age <= 365 ? '91-365 days' : '365+ days';
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const snapshotAgeChartData = ['0-7 days', '8-30 days', '31-90 days', '91-365 days', '365+ days']
    .map(bucket => ({
      label: bucket,
      value: snapshotsByAge[bucket] || 0,
    }))
    .filter(d => d.value > 0);

  // VMs with snapshots
  const vmsWithSnapshots = new Set(snapshots.map(s => s.vmName)).size;
  const snapshotsBlockers = snapshots.filter(s => s.ageInDays > SNAPSHOT_BLOCKER_AGE_DAYS).length;
  const snapshotsWarnings = snapshots.filter(s => s.ageInDays > SNAPSHOT_WARNING_AGE_DAYS && s.ageInDays <= SNAPSHOT_BLOCKER_AGE_DAYS).length;

  // Largest snapshots (by size)
  const topSnapshotsBySize = [...snapshots]
    .sort((a, b) => b.sizeTotalMiB - a.sizeTotalMiB)
    .slice(0, 10)
    .map(s => ({
      label: `${s.vmName}: ${s.snapshotName}`.substring(0, 50),
      value: Math.round(s.sizeTotalMiB / 1024), // Convert to GiB
    }));

  // Oldest snapshots
  const topSnapshotsByAge = [...snapshots]
    .sort((a, b) => b.ageInDays - a.ageInDays)
    .slice(0, 10)
    .map(s => ({
      label: `${s.vmName}: ${s.snapshotName}`.substring(0, 50),
      value: s.ageInDays,
    }));

  // Power state distribution
  const powerStateDistribution = vms.reduce((acc, vm) => {
    const state = vm.powerState === 'poweredOn' ? 'Powered On' :
                  vm.powerState === 'poweredOff' ? 'Powered Off' : 'Suspended';
    acc[state] = (acc[state] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const powerStateChartData = Object.entries(powerStateDistribution)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // VMs without annotations
  const vmsWithoutAnnotation = vms.filter(vm => !vm.annotation || vm.annotation.trim() === '').length;

  // Connection state issues
  const vmsDisconnected = vms.filter(vm => vm.connectionState !== 'connected').length;

  // Consolidation needed
  const vmsNeedConsolidation = vms.filter(vm => vm.consolidationNeeded).length;

  // CBT enabled count (using vmtools data)
  const vmsWithCBRC = vms.filter(vm => vm.cbrcEnabled).length;

  // Fault tolerance
  const vmsWithFT = vms.filter(vm => vm.ftState && vm.ftState !== 'notConfigured').length;

  // Latency sensitivity
  const vmsWithLatencySensitivity = vms.filter(vm =>
    vm.latencySensitivity && vm.latencySensitivity !== 'normal'
  ).length;

  return (
    <div className="config-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="config-page__title">Configuration Analysis</h1>
          <p className="config-page__subtitle">
            VM configuration standards, compliance checks, and snapshot analysis
          </p>
        </Column>

        {/* Summary metrics */}
        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Total VMs"
            value={formatNumber(vms.length)}
            detail={`${formatNumber(recommendedHWCount)} at HW v${HW_VERSION_RECOMMENDED}+`}
            variant="primary"
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="VMware Tools Current"
            value={formatNumber(toolsStatusMap['Current'] || 0)}
            detail={tools.length > 0
              ? `${Math.round(((toolsStatusMap['Current'] || 0) / tools.length) * 100)}% current`
              : 'N/A'}
            variant="success"
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="VMs with Snapshots"
            value={formatNumber(vmsWithSnapshots)}
            detail={`${formatNumber(snapshots.length)} total snapshots`}
            variant={vmsWithSnapshots > 0 ? 'warning' : 'success'}
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="CD-ROM Connected"
            value={formatNumber(vmsWithCdConnected)}
            detail="VMs need disconnection"
            variant={vmsWithCdConnected > 0 ? 'warning' : 'success'}
          />
        </Column>

        {/* Hardware Version Distribution */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="config-page__chart-tile">
            <DoughnutChart
              title="Hardware Version Distribution"
              subtitle="VM hardware compatibility versions"
              data={hwVersionChartData}
              height={280}
              formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>

        {/* VMware Tools Status */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="config-page__chart-tile">
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

        {/* Guest OS Distribution */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="config-page__chart-tile">
            <DoughnutChart
              title="Guest OS Families"
              subtitle="Operating system distribution by family"
              data={osChartData}
              height={280}
              formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>

        {/* Power State Distribution */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="config-page__chart-tile">
            <DoughnutChart
              title="Power State Distribution"
              subtitle="VM power state overview"
              data={powerStateChartData}
              height={280}
              colors={['#24a148', '#6f6f6f', '#f1c21b']}
              formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>

        {/* Firmware Type */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="config-page__chart-tile">
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

        {/* Snapshot Age Distribution */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="config-page__chart-tile">
            <VerticalBarChart
              title="Snapshots by Age"
              subtitle="Snapshot age distribution"
              data={snapshotAgeChartData}
              height={280}
              valueLabel="Snapshots"
              formatValue={(v) => `${v} snapshot${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>

        {/* Largest Snapshots */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="config-page__chart-tile">
            <HorizontalBarChart
              title="Top 10 Largest Snapshots"
              subtitle="By total size (GiB)"
              data={topSnapshotsBySize}
              height={320}
              valueLabel="GiB"
              formatValue={(v) => `${v} GiB`}
            />
          </Tile>
        </Column>

        {/* Oldest Snapshots */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="config-page__chart-tile">
            <HorizontalBarChart
              title="Top 10 Oldest Snapshots"
              subtitle="By age in days"
              data={topSnapshotsByAge}
              height={320}
              valueLabel="Days"
              formatValue={(v) => `${v} day${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>

        {/* Compliance Section Header */}
        <Column lg={16} md={8} sm={4}>
          <h2 className="config-page__section-title">Compliance & Health Indicators</h2>
        </Column>

        {/* Compliance indicators */}
        <Column lg={4} md={4} sm={2}>
          <Tile className={`config-page__compliance-tile ${outdatedHWCount > 0 ? 'config-page__compliance-tile--warning' : 'config-page__compliance-tile--success'}`}>
            <div className="config-page__compliance-header">
              <span className="config-page__compliance-label">Outdated HW Version</span>
              <Tag type={outdatedHWCount > 0 ? 'red' : 'green'}>
                {outdatedHWCount > 0 ? 'Needs Action' : 'OK'}
              </Tag>
            </div>
            <span className="config-page__compliance-value">{formatNumber(outdatedHWCount)}</span>
            <span className="config-page__compliance-detail">
              VMs below v{HW_VERSION_MINIMUM}
            </span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className={`config-page__compliance-tile ${(toolsStatusMap['Not Installed'] || 0) > 0 ? 'config-page__compliance-tile--error' : 'config-page__compliance-tile--success'}`}>
            <div className="config-page__compliance-header">
              <span className="config-page__compliance-label">Tools Not Installed</span>
              <Tag type={(toolsStatusMap['Not Installed'] || 0) > 0 ? 'red' : 'green'}>
                {(toolsStatusMap['Not Installed'] || 0) > 0 ? 'Blocker' : 'OK'}
              </Tag>
            </div>
            <span className="config-page__compliance-value">
              {formatNumber(toolsStatusMap['Not Installed'] || 0)}
            </span>
            <span className="config-page__compliance-detail">Required for migration</span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className={`config-page__compliance-tile ${snapshotsBlockers > 0 ? 'config-page__compliance-tile--error' : snapshotsWarnings > 0 ? 'config-page__compliance-tile--warning' : 'config-page__compliance-tile--success'}`}>
            <div className="config-page__compliance-header">
              <span className="config-page__compliance-label">Old Snapshots</span>
              <Tag type={snapshotsBlockers > 0 ? 'red' : snapshotsWarnings > 0 ? 'magenta' : 'green'}>
                {snapshotsBlockers > 0 ? 'Blocker' : snapshotsWarnings > 0 ? 'Warning' : 'OK'}
              </Tag>
            </div>
            <span className="config-page__compliance-value">
              {formatNumber(snapshotsBlockers + snapshotsWarnings)}
            </span>
            <span className="config-page__compliance-detail">
              &gt;{SNAPSHOT_WARNING_AGE_DAYS} days old
            </span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className={`config-page__compliance-tile ${vmsWithCdConnected > 0 ? 'config-page__compliance-tile--warning' : 'config-page__compliance-tile--success'}`}>
            <div className="config-page__compliance-header">
              <span className="config-page__compliance-label">CD-ROM Connected</span>
              <Tag type={vmsWithCdConnected > 0 ? 'magenta' : 'green'}>
                {vmsWithCdConnected > 0 ? 'Needs Action' : 'OK'}
              </Tag>
            </div>
            <span className="config-page__compliance-value">{formatNumber(vmsWithCdConnected)}</span>
            <span className="config-page__compliance-detail">Disconnect before migration</span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className={`config-page__compliance-tile ${vmsDisconnected > 0 ? 'config-page__compliance-tile--warning' : 'config-page__compliance-tile--success'}`}>
            <div className="config-page__compliance-header">
              <span className="config-page__compliance-label">Disconnected VMs</span>
              <Tag type={vmsDisconnected > 0 ? 'magenta' : 'green'}>
                {vmsDisconnected > 0 ? 'Review' : 'OK'}
              </Tag>
            </div>
            <span className="config-page__compliance-value">{formatNumber(vmsDisconnected)}</span>
            <span className="config-page__compliance-detail">Not connected to vCenter</span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className={`config-page__compliance-tile ${vmsNeedConsolidation > 0 ? 'config-page__compliance-tile--warning' : 'config-page__compliance-tile--success'}`}>
            <div className="config-page__compliance-header">
              <span className="config-page__compliance-label">Need Consolidation</span>
              <Tag type={vmsNeedConsolidation > 0 ? 'magenta' : 'green'}>
                {vmsNeedConsolidation > 0 ? 'Warning' : 'OK'}
              </Tag>
            </div>
            <span className="config-page__compliance-value">{formatNumber(vmsNeedConsolidation)}</span>
            <span className="config-page__compliance-detail">Disk consolidation needed</span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className="config-page__compliance-tile">
            <div className="config-page__compliance-header">
              <span className="config-page__compliance-label">CBRC Enabled</span>
              <Tag type="blue">Info</Tag>
            </div>
            <span className="config-page__compliance-value">{formatNumber(vmsWithCBRC)}</span>
            <span className="config-page__compliance-detail">Content-Based Read Cache</span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className={`config-page__compliance-tile ${vmsWithFT > 0 ? 'config-page__compliance-tile--warning' : 'config-page__compliance-tile--success'}`}>
            <div className="config-page__compliance-header">
              <span className="config-page__compliance-label">Fault Tolerance</span>
              <Tag type={vmsWithFT > 0 ? 'magenta' : 'green'}>
                {vmsWithFT > 0 ? 'Review' : 'None'}
              </Tag>
            </div>
            <span className="config-page__compliance-value">{formatNumber(vmsWithFT)}</span>
            <span className="config-page__compliance-detail">May need reconfiguration</span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className={`config-page__compliance-tile ${vmsWithLatencySensitivity > 0 ? 'config-page__compliance-tile--warning' : 'config-page__compliance-tile--success'}`}>
            <div className="config-page__compliance-header">
              <span className="config-page__compliance-label">Latency Sensitive</span>
              <Tag type={vmsWithLatencySensitivity > 0 ? 'magenta' : 'green'}>
                {vmsWithLatencySensitivity > 0 ? 'Review' : 'None'}
              </Tag>
            </div>
            <span className="config-page__compliance-value">{formatNumber(vmsWithLatencySensitivity)}</span>
            <span className="config-page__compliance-detail">Non-normal latency settings</span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className="config-page__compliance-tile">
            <div className="config-page__compliance-header">
              <span className="config-page__compliance-label">Without Annotation</span>
              <Tag type="gray">Info</Tag>
            </div>
            <span className="config-page__compliance-value">{formatNumber(vmsWithoutAnnotation)}</span>
            <span className="config-page__compliance-detail">Missing documentation</span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className="config-page__compliance-tile">
            <div className="config-page__compliance-header">
              <span className="config-page__compliance-label">Tools Outdated</span>
              <Tag type={toolsStatusMap['Outdated'] ? 'magenta' : 'green'}>
                {(toolsStatusMap['Outdated'] || 0) > 0 ? 'Update' : 'OK'}
              </Tag>
            </div>
            <span className="config-page__compliance-value">
              {formatNumber(toolsStatusMap['Outdated'] || 0)}
            </span>
            <span className="config-page__compliance-detail">Update recommended</span>
          </Tile>
        </Column>
      </Grid>
    </div>
  );
}
