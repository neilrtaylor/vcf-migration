// Network analysis page
import { Grid, Column, Tile } from '@carbon/react';
import { Navigate } from 'react-router-dom';
import { useData } from '@/hooks';
import { ROUTES } from '@/utils/constants';
import { formatNumber } from '@/utils/formatters';
import { HorizontalBarChart, DoughnutChart, VerticalBarChart, Sunburst, NetworkTopology } from '@/components/charts';
import type { HierarchyNode, TopologyNode, TopologyLink } from '@/components/charts';
import { RedHatDocLinksGroup } from '@/components/common';
import './NetworkPage.scss';

export function NetworkPage() {
  const { rawData } = useData();

  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  const networks = rawData.vNetwork;
  const vms = rawData.vInfo.filter(vm => !vm.template);

  // Calculate network metrics
  const uniqueNetworks = new Set(networks.map(n => n.networkName)).size;
  const uniqueSwitches = new Set(networks.map(n => n.switchName).filter(Boolean)).size;
  const connectedNICs = networks.filter(n => n.connected).length;
  const disconnectedNICs = networks.filter(n => !n.connected).length;

  // NIC adapter type distribution
  const adapterTypes = networks.reduce((acc, nic) => {
    const type = nic.adapterType || 'Unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const adapterChartData = Object.entries(adapterTypes)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // Network/Port group distribution
  const networkDistribution = networks.reduce((acc, nic) => {
    const network = nic.networkName || 'Unknown';
    acc[network] = (acc[network] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topNetworks = Object.entries(networkDistribution)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  // VMs by NIC count
  const vmNicCounts = vms.map(vm => {
    const nicCount = networks.filter(n => n.vmName === vm.vmName).length;
    return { vmName: vm.vmName, nicCount };
  });

  const nicCountDistribution = vmNicCounts.reduce((acc, vm) => {
    const bucket = vm.nicCount === 0 ? '0' :
                   vm.nicCount === 1 ? '1' :
                   vm.nicCount === 2 ? '2' :
                   vm.nicCount === 3 ? '3' :
                   vm.nicCount <= 5 ? '4-5' : '6+';
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const nicCountChartData = ['0', '1', '2', '3', '4-5', '6+']
    .map(bucket => ({
      label: `${bucket} NICs`,
      value: nicCountDistribution[bucket] || 0,
    }))
    .filter(d => d.value > 0);

  // Top VMs by NIC count
  const topNicVMs = [...vmNicCounts]
    .sort((a, b) => b.nicCount - a.nicCount)
    .slice(0, 15)
    .filter(vm => vm.nicCount > 0)
    .map(vm => ({
      label: vm.vmName,
      value: vm.nicCount,
    }));

  // Connection status
  const connectionStatus = [
    { label: 'Connected', value: connectedNICs },
    { label: 'Disconnected', value: disconnectedNICs },
  ].filter(d => d.value > 0);

  // Legacy adapter detection (E1000 on modern systems)
  const legacyAdapters = networks.filter(n =>
    n.adapterType?.toLowerCase().includes('e1000')
  ).length;

  // VMs without network adapters
  const vmsWithoutNIC = vmNicCounts.filter(vm => vm.nicCount === 0).length;

  // Build network hierarchy for sunburst
  // Structure: Root -> vSwitches -> Port Groups -> VMs count
  const networkHierarchy: HierarchyNode = {
    name: 'Network',
    children: [],
  };

  // Group by switch, then by port group
  const switchMap = new Map<string, Map<string, number>>();
  networks.forEach(nic => {
    const switchName = nic.switchName || 'Standard Switch';
    const portGroup = nic.networkName || 'Default';

    if (!switchMap.has(switchName)) {
      switchMap.set(switchName, new Map());
    }
    const portGroups = switchMap.get(switchName)!;
    portGroups.set(portGroup, (portGroups.get(portGroup) || 0) + 1);
  });

  // Convert to hierarchy
  switchMap.forEach((portGroups, switchName) => {
    const switchNode: HierarchyNode = {
      name: switchName,
      children: [],
    };

    portGroups.forEach((count, portGroupName) => {
      switchNode.children!.push({
        name: portGroupName,
        value: count,
      });
    });

    networkHierarchy.children!.push(switchNode);
  });

  // Build topology nodes and links for force-directed graph
  const topologyNodes: TopologyNode[] = [];
  const topologyLinks: TopologyLink[] = [];
  const nodeIds = new Set<string>();

  // Add switch nodes
  switchMap.forEach((portGroups, switchName) => {
    const switchId = `switch-${switchName}`;
    if (!nodeIds.has(switchId)) {
      topologyNodes.push({
        id: switchId,
        name: switchName,
        type: 'switch',
        value: Array.from(portGroups.values()).reduce((a, b) => a + b, 0),
      });
      nodeIds.add(switchId);
    }

    // Add port group nodes and links to switch
    portGroups.forEach((vmCount, portGroupName) => {
      const pgId = `pg-${switchName}-${portGroupName}`;
      if (!nodeIds.has(pgId)) {
        topologyNodes.push({
          id: pgId,
          name: portGroupName,
          type: 'portgroup',
          group: switchName,
          value: vmCount,
        });
        nodeIds.add(pgId);

        // Link port group to switch
        topologyLinks.push({
          source: switchId,
          target: pgId,
        });
      }
    });
  });

  // Add top VMs as nodes (limit to prevent overcrowding)
  const topVMsForTopology = [...vmNicCounts]
    .sort((a, b) => b.nicCount - a.nicCount)
    .slice(0, 20)
    .filter(vm => vm.nicCount > 0);

  topVMsForTopology.forEach(vm => {
    const vmId = `vm-${vm.vmName}`;
    topologyNodes.push({
      id: vmId,
      name: vm.vmName,
      type: 'vm',
      value: vm.nicCount,
    });

    // Link VM to its port groups
    const vmNetworks = networks.filter(n => n.vmName === vm.vmName);
    vmNetworks.forEach(nic => {
      const switchName = nic.switchName || 'Standard Switch';
      const portGroup = nic.networkName || 'Default';
      const pgId = `pg-${switchName}-${portGroup}`;

      if (nodeIds.has(pgId)) {
        topologyLinks.push({
          source: pgId,
          target: vmId,
        });
      }
    });
  });

  return (
    <div className="network-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="network-page__title">Network Analysis</h1>
          <p className="network-page__subtitle">
            Network adapter and port group analysis
          </p>
        </Column>

        {/* Summary metrics */}
        <Column lg={4} md={4} sm={2}>
          <Tile className="network-page__metric-tile">
            <span className="network-page__metric-label">Total NICs</span>
            <span className="network-page__metric-value">{formatNumber(networks.length)}</span>
            <span className="network-page__metric-detail">{formatNumber(connectedNICs)} connected</span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className="network-page__metric-tile">
            <span className="network-page__metric-label">Port Groups</span>
            <span className="network-page__metric-value">{formatNumber(uniqueNetworks)}</span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className="network-page__metric-tile">
            <span className="network-page__metric-label">Virtual Switches</span>
            <span className="network-page__metric-value">{formatNumber(uniqueSwitches)}</span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className="network-page__metric-tile">
            <span className="network-page__metric-label">Avg NICs/VM</span>
            <span className="network-page__metric-value">
              {vms.length > 0 ? (networks.length / vms.length).toFixed(1) : '0'}
            </span>
          </Tile>
        </Column>

        {/* Adapter Type Distribution */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="network-page__chart-tile">
            <DoughnutChart
              title="NIC Adapter Types"
              subtitle="Distribution of virtual network adapter types"
              data={adapterChartData}
              height={280}
              formatValue={(v) => `${v} NICs`}
            />
          </Tile>
        </Column>

        {/* Connection Status */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="network-page__chart-tile">
            <DoughnutChart
              title="Connection Status"
              subtitle="Connected vs disconnected adapters"
              data={connectionStatus}
              height={280}
              colors={['#24a148', '#da1e28']}
              formatValue={(v) => `${v} NICs`}
            />
          </Tile>
        </Column>

        {/* NIC Count Distribution */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="network-page__chart-tile">
            <VerticalBarChart
              title="VMs by NIC Count"
              subtitle="Distribution of network adapters per VM"
              data={nicCountChartData}
              height={280}
              valueLabel="VMs"
              formatValue={(v) => `${v} VMs`}
            />
          </Tile>
        </Column>

        {/* Top Networks */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="network-page__chart-tile">
            <HorizontalBarChart
              title="Top 15 Port Groups"
              subtitle="Most used network port groups"
              data={topNetworks}
              height={280}
              valueLabel="NICs"
              formatValue={(v) => `${v} NICs`}
            />
          </Tile>
        </Column>

        {/* Top VMs by NIC count */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="network-page__chart-tile">
            <HorizontalBarChart
              title="Top 15 VMs by NIC Count"
              subtitle="VMs with the most network adapters"
              data={topNicVMs}
              height={400}
              valueLabel="NICs"
              formatValue={(v) => `${v} NICs`}
            />
          </Tile>
        </Column>

        {/* Network Hierarchy Sunburst */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="network-page__chart-tile">
            <Sunburst
              title="Network Hierarchy"
              subtitle="vSwitches > Port Groups > NIC Count"
              data={networkHierarchy}
              height={400}
            />
          </Tile>
        </Column>

        {/* Network Topology Force-Directed Graph */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="network-page__chart-tile">
            <NetworkTopology
              title="Network Topology"
              subtitle="Interactive view of switches, port groups, and top VMs (drag to reposition, scroll to zoom)"
              nodes={topologyNodes}
              links={topologyLinks}
              height={500}
            />
          </Tile>
        </Column>

        {/* Health indicators */}
        <Column lg={4} md={4} sm={2}>
          <Tile className={`network-page__secondary-tile ${disconnectedNICs > 0 ? 'network-page__secondary-tile--warning' : ''}`}>
            <span className="network-page__metric-label">Disconnected NICs</span>
            <span className="network-page__secondary-value">{formatNumber(disconnectedNICs)}</span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className={`network-page__secondary-tile ${legacyAdapters > 0 ? 'network-page__secondary-tile--warning' : ''}`}>
            <span className="network-page__metric-label">Legacy Adapters (E1000)</span>
            <span className="network-page__secondary-value">{formatNumber(legacyAdapters)}</span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className={`network-page__secondary-tile ${vmsWithoutNIC > 0 ? 'network-page__secondary-tile--warning' : ''}`}>
            <span className="network-page__metric-label">VMs Without NIC</span>
            <span className="network-page__secondary-value">{formatNumber(vmsWithoutNIC)}</span>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={2}>
          <Tile className="network-page__secondary-tile">
            <span className="network-page__metric-label">VMXNET3 Adapters</span>
            <span className="network-page__secondary-value">
              {formatNumber(adapterTypes['Vmxnet3'] || adapterTypes['VMXNET3'] || 0)}
            </span>
          </Tile>
        </Column>

        {/* Documentation Links */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="network-page__docs-tile">
            <RedHatDocLinksGroup
              title="OpenShift Virtualization Network Resources"
              links={[
                {
                  href: 'https://docs.openshift.com/container-platform/latest/virt/virtual_machines/vm_networking/virt-networking-overview.html',
                  label: 'Networking Overview',
                  description: 'Overview of networking in OpenShift Virtualization',
                },
                {
                  href: 'https://docs.openshift.com/container-platform/latest/networking/multiple_networks/understanding-multiple-networks.html',
                  label: 'Multus CNI Plugin',
                  description: 'Configure multiple networks using Multus CNI',
                },
                {
                  href: 'https://docs.openshift.com/container-platform/latest/virt/virtual_machines/vm_networking/virt-attaching-vm-to-ovn-secondary-network.html',
                  label: 'OVN Secondary Networks',
                  description: 'Attach VMs to OVN secondary networks',
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
