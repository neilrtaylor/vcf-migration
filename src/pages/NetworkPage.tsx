// Network analysis page
import { useMemo } from 'react';
import { Grid, Column, Tile, Tag } from '@carbon/react';
import { Navigate } from 'react-router-dom';
import { useData } from '@/hooks';
import { ROUTES } from '@/utils/constants';
import { formatNumber } from '@/utils/formatters';
import { HorizontalBarChart, DoughnutChart, VerticalBarChart, Sunburst, NetworkTopology } from '@/components/charts';
import type { HierarchyNode, TopologyNode, TopologyLink } from '@/components/charts';
import { MetricCard, RedHatDocLinksGroup } from '@/components/common';
import { EnhancedDataTable } from '@/components/tables';
import type { ColumnDef } from '@tanstack/react-table';
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

  // Connection status - check both connected and disconnected NICs
  // The Connected column shows adapter connection state (connected to virtual switch)
  const connectedNICs = networks.filter(n => n.connected === true).length;
  const disconnectedNICs = networks.filter(n => n.connected === false).length;
  // If all NICs show as disconnected, it might be a data issue or all NICs are genuinely disconnected
  // We show the counts regardless to give visibility into the data
  const hasConnectedData = connectedNICs > 0 || (networks.length > 0 && disconnectedNICs < networks.length);

  // NIC adapter type distribution (normalize to handle case variations)
  const adapterTypes = networks.reduce((acc, nic) => {
    const type = nic.adapterType || 'Unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Case-insensitive adapter type counts for display
  const vmxnet3Count = networks.filter(n =>
    n.adapterType?.toLowerCase().includes('vmxnet3') ||
    n.adapterType?.toLowerCase().includes('vmxnet 3')
  ).length;

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

  // Network Summary Table: Port groups with VM counts and IP subnet guessing
  interface NetworkSummaryRow {
    [key: string]: unknown;
    portGroup: string;
    vSwitch: string;
    vmCount: number;
    nicCount: number;
    guessedSubnet: string;
    sampleIPs: string;
  }

  const networkSummaryData = useMemo(() => {
    // Group NICs by port group
    const portGroupMap = new Map<string, {
      vSwitch: string;
      vmNames: Set<string>;
      nicCount: number;
      ips: string[];
    }>();

    networks.forEach(nic => {
      const pg = nic.networkName || 'Unknown';
      if (!portGroupMap.has(pg)) {
        portGroupMap.set(pg, {
          vSwitch: nic.switchName || 'Unknown',
          vmNames: new Set(),
          nicCount: 0,
          ips: [],
        });
      }
      const data = portGroupMap.get(pg)!;
      data.vmNames.add(nic.vmName);
      data.nicCount++;
      if (nic.ipv4Address) {
        data.ips.push(nic.ipv4Address);
      }
    });

    // Convert to array and guess subnets
    const result: NetworkSummaryRow[] = [];
    portGroupMap.forEach((data, portGroup) => {
      // Simple subnet guessing: find most common first 3 octets
      let guessedSubnet = 'N/A';
      if (data.ips.length > 0) {
        const prefixCounts = new Map<string, number>();
        data.ips.forEach(ip => {
          const parts = ip.split('.');
          if (parts.length >= 3) {
            const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
            prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
          }
        });
        // Find most common prefix
        let maxCount = 0;
        let mostCommonPrefix = '';
        prefixCounts.forEach((count, prefix) => {
          if (count > maxCount) {
            maxCount = count;
            mostCommonPrefix = prefix;
          }
        });
        if (mostCommonPrefix) {
          guessedSubnet = `${mostCommonPrefix}.0/24`;
        }
      }

      result.push({
        portGroup,
        vSwitch: data.vSwitch,
        vmCount: data.vmNames.size,
        nicCount: data.nicCount,
        guessedSubnet,
        sampleIPs: data.ips.slice(0, 3).join(', ') || 'N/A',
      });
    });

    return result.sort((a, b) => b.vmCount - a.vmCount);
  }, [networks]);

  const networkSummaryColumns: ColumnDef<NetworkSummaryRow>[] = useMemo(() => [
    { accessorKey: 'portGroup', header: 'Port Group' },
    { accessorKey: 'vSwitch', header: 'vSwitch' },
    { accessorKey: 'vmCount', header: 'VMs' },
    { accessorKey: 'nicCount', header: 'NICs' },
    { accessorKey: 'guessedSubnet', header: 'Subnet (Guess)' },
    { accessorKey: 'sampleIPs', header: 'Sample IPs' },
  ], []);

  // Multi-NIC VMs Table: VMs with more than 1 NIC
  interface MultiNicVMRow {
    [key: string]: unknown;
    vmName: string;
    nicCount: number;
    networks: string;
    powerState: string;
    cluster: string;
  }

  const multiNicVMData = useMemo(() => {
    const result: MultiNicVMRow[] = [];
    const multiNicVMs = vmNicCounts.filter(vm => vm.nicCount > 1);

    multiNicVMs.forEach(({ vmName, nicCount }) => {
      const vmInfo = vms.find(v => v.vmName === vmName);
      const vmNetworks = networks.filter(n => n.vmName.toLowerCase() === vmName.toLowerCase());
      const uniqueNetworkNames = [...new Set(vmNetworks.map(n => n.networkName))];

      result.push({
        vmName,
        nicCount,
        networks: uniqueNetworkNames.join(', '),
        powerState: vmInfo?.powerState || 'Unknown',
        cluster: vmInfo?.cluster || 'Unknown',
      });
    });

    return result.sort((a, b) => b.nicCount - a.nicCount);
  }, [vmNicCounts, vms, networks]);

  const multiNicVMColumns: ColumnDef<MultiNicVMRow>[] = useMemo(() => [
    { accessorKey: 'vmName', header: 'VM Name' },
    { accessorKey: 'nicCount', header: 'NIC Count' },
    { accessorKey: 'networks', header: 'Connected Networks' },
    { accessorKey: 'powerState', header: 'Power State' },
    { accessorKey: 'cluster', header: 'Cluster' },
  ], []);

  // Port Group Subnet Analysis Table: One row per port group showing all unique network prefixes
  interface PortGroupSubnetRow {
    [key: string]: unknown;
    portGroup: string;
    vSwitch: string;
    vmCount: number;
    nicCount: number;
    uniquePrefixes: string[];
    prefixCount: number;
    hasMultiplePrefixes: boolean;
    ipCount: number;
    noIpCount: number;
  }

  // Helper to extract first 3 octets as network prefix
  const getNetworkPrefix = (ip: string): string => {
    if (!ip) return '';
    const parts = ip.split('.');
    if (parts.length >= 3) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
    }
    return '';
  };

  const portGroupSubnetData = useMemo(() => {
    // Group by port group and collect all data
    const portGroupMap = new Map<string, {
      vSwitch: string;
      vmNames: Set<string>;
      nicCount: number;
      prefixes: Set<string>;
      ipCount: number;
      noIpCount: number;
    }>();

    networks.forEach(nic => {
      const pg = nic.networkName || 'Unknown';
      if (!portGroupMap.has(pg)) {
        portGroupMap.set(pg, {
          vSwitch: nic.switchName || 'Unknown',
          vmNames: new Set(),
          nicCount: 0,
          prefixes: new Set(),
          ipCount: 0,
          noIpCount: 0,
        });
      }
      const data = portGroupMap.get(pg)!;
      data.vmNames.add(nic.vmName);
      data.nicCount++;

      if (nic.ipv4Address) {
        const prefix = getNetworkPrefix(nic.ipv4Address);
        if (prefix) {
          data.prefixes.add(prefix);
        }
        data.ipCount++;
      } else {
        data.noIpCount++;
      }
    });

    // Convert to array
    const result: PortGroupSubnetRow[] = [];
    portGroupMap.forEach((data, portGroup) => {
      const uniquePrefixes = Array.from(data.prefixes).sort();
      result.push({
        portGroup,
        vSwitch: data.vSwitch,
        vmCount: data.vmNames.size,
        nicCount: data.nicCount,
        uniquePrefixes,
        prefixCount: uniquePrefixes.length,
        hasMultiplePrefixes: uniquePrefixes.length > 1,
        ipCount: data.ipCount,
        noIpCount: data.noIpCount,
      });
    });

    // Sort: multiple prefixes first (flagged), then by VM count
    return result.sort((a, b) => {
      if (a.hasMultiplePrefixes !== b.hasMultiplePrefixes) {
        return a.hasMultiplePrefixes ? -1 : 1;
      }
      return b.vmCount - a.vmCount;
    });
  }, [networks]);

  // Count port groups with multiple prefixes
  const portGroupsWithMultiplePrefixes = useMemo(() => {
    return portGroupSubnetData.filter(row => row.hasMultiplePrefixes).length;
  }, [portGroupSubnetData]);

  const portGroupSubnetColumns: ColumnDef<PortGroupSubnetRow>[] = useMemo(() => [
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        row.original.hasMultiplePrefixes ? (
          <Tag type="red" size="sm">Multiple</Tag>
        ) : row.original.prefixCount === 1 ? (
          <Tag type="green" size="sm">Single</Tag>
        ) : (
          <Tag type="gray" size="sm">No IPs</Tag>
        )
      ),
    },
    { accessorKey: 'portGroup', header: 'Port Group', enableSorting: true },
    { accessorKey: 'vSwitch', header: 'vSwitch', enableSorting: true },
    { accessorKey: 'vmCount', header: 'VMs', enableSorting: true },
    { accessorKey: 'nicCount', header: 'NICs', enableSorting: true },
    {
      accessorKey: 'uniquePrefixes',
      header: 'Network Prefixes Found',
      cell: ({ row }) => {
        const prefixes = row.original.uniquePrefixes;
        if (prefixes.length === 0) {
          return <span style={{ color: '#6f6f6f' }}>No IP addresses</span>;
        }
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
            {prefixes.map((prefix, idx) => (
              <Tag
                key={idx}
                type={row.original.hasMultiplePrefixes ? 'red' : 'gray'}
                size="sm"
              >
                {prefix}
              </Tag>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: 'prefixCount',
      header: 'Prefix Count',
      enableSorting: true,
      cell: ({ row }) => (
        <span style={{
          fontWeight: row.original.hasMultiplePrefixes ? 600 : 'normal',
          color: row.original.hasMultiplePrefixes ? '#da1e28' : 'inherit',
        }}>
          {row.original.prefixCount}
        </span>
      ),
    },
  ], []);

  // Connection status - only show if we have meaningful connected data
  const connectionStatus = hasConnectedData
    ? [
        { label: 'Connected', value: connectedNICs },
        { label: 'Disconnected', value: disconnectedNICs },
      ].filter(d => d.value > 0)
    : [{ label: 'No connection data', value: networks.length }];

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

  // Add VMs as nodes - show all VMs with NICs, but limit to reasonable number for performance
  const topVMsForTopology = [...vmNicCounts]
    .filter(vm => vm.nicCount > 0)
    .sort((a, b) => b.nicCount - a.nicCount)
    .slice(0, 100); // Show up to 100 VMs

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
          <MetricCard
            label="Total NICs"
            value={formatNumber(networks.length)}
            detail={hasConnectedData ? `${formatNumber(connectedNICs)} connected` : undefined}
            variant="primary"
            tooltip="Count of all virtual network adapters across all VMs."
            docSection="network"
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Port Groups"
            value={formatNumber(uniqueNetworks)}
            variant="info"
            tooltip="Unique network port groups configured in the environment."
            docSection="network"
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Virtual Switches"
            value={formatNumber(uniqueSwitches)}
            variant="teal"
            tooltip="vSwitches (standard or distributed) in the environment."
            docSection="network"
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Avg NICs/VM"
            value={vms.length > 0 ? (networks.length / vms.length).toFixed(1) : '0'}
            variant="default"
            tooltip="Average number of virtual network adapters per VM."
          />
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
          <Tile className="network-page__topology-tile">
            <NetworkTopology
              title="Network Topology"
              subtitle={`Interactive view of ${topologyNodes.filter(n => n.type === 'switch').length} switches, ${topologyNodes.filter(n => n.type === 'portgroup').length} port groups, and ${topologyNodes.filter(n => n.type === 'vm').length} VMs (drag to reposition, scroll to zoom)`}
              nodes={topologyNodes}
              links={topologyLinks}
              height={550}
            />
          </Tile>
        </Column>

        {/* Health indicators */}
        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Disconnected NICs"
            value={formatNumber(disconnectedNICs)}
            variant={disconnectedNICs > 0 ? 'warning' : 'success'}
            tooltip="Network adapters not currently connected. May indicate VM configuration issues or intentional disconnection."
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Legacy Adapters (E1000)"
            value={formatNumber(legacyAdapters)}
            variant={legacyAdapters > 0 ? 'warning' : 'success'}
            tooltip="E1000/E1000E adapters are legacy types with lower performance. Consider upgrading to VMXNET3 before migration."
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="VMs Without NIC"
            value={formatNumber(vmsWithoutNIC)}
            variant={vmsWithoutNIC > 0 ? 'warning' : 'success'}
            tooltip="VMs with no network adapters configured. Verify if this is intentional."
          />
        </Column>

        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="VMXNET3 Adapters"
            value={formatNumber(vmxnet3Count)}
            variant="success"
            tooltip="VMXNET3 is the recommended high-performance paravirtualized adapter type for migration."
          />
        </Column>

        {/* Network Summary Table */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="network-page__table-tile">
            <h4 className="network-page__table-title">Network Summary</h4>
            <p className="network-page__table-subtitle">Port groups with VM counts and estimated IP subnets</p>
            <EnhancedDataTable
              data={networkSummaryData}
              columns={networkSummaryColumns}
              defaultPageSize={10}
            />
          </Tile>
        </Column>

        {/* Port Group Subnet Analysis Table */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="network-page__table-tile">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h4 className="network-page__table-title">Port Group Subnet Analysis</h4>
                <p className="network-page__table-subtitle">
                  Identify port groups with multiple network prefixes (potential multiple subnets)
                </p>
              </div>
              {portGroupsWithMultiplePrefixes > 0 ? (
                <Tag type="red">
                  {portGroupsWithMultiplePrefixes} port group{portGroupsWithMultiplePrefixes !== 1 ? 's' : ''} with multiple prefixes
                </Tag>
              ) : (
                <Tag type="green">All port groups have single prefix</Tag>
              )}
            </div>
            {portGroupsWithMultiplePrefixes > 0 && (
              <div style={{
                padding: '0.75rem',
                marginBottom: '1rem',
                backgroundColor: 'var(--cds-notification-background-error, #fff1f1)',
                borderLeft: '4px solid var(--cds-support-error, #da1e28)',
                borderRadius: '4px',
              }}>
                <strong>Review Required:</strong> {portGroupsWithMultiplePrefixes} port group{portGroupsWithMultiplePrefixes !== 1 ? 's have' : ' has'} IPs
                from different network prefixes (first 3 octets differ). If each port group should contain only one subnet, verify the configuration.
              </div>
            )}
            <EnhancedDataTable
              data={portGroupSubnetData}
              columns={portGroupSubnetColumns}
              defaultPageSize={15}
              enableSearch
              enablePagination
              enableSorting
              enableExport
              exportFilename="port-group-subnet-analysis"
            />
          </Tile>
        </Column>

        {/* Multi-NIC VMs Table */}
        {multiNicVMData.length > 0 && (
          <Column lg={16} md={8} sm={4}>
            <Tile className="network-page__table-tile">
              <h4 className="network-page__table-title">VMs with Multiple NICs</h4>
              <p className="network-page__table-subtitle">
                {formatNumber(multiNicVMData.length)} VMs with 2 or more network adapters
              </p>
              <EnhancedDataTable
                data={multiNicVMData}
                columns={multiNicVMColumns}
                defaultPageSize={10}
              />
            </Tile>
          </Column>
        )}

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
