// Data tables page with enhanced TanStack Table integration
import { useMemo } from 'react';
import { Grid, Column, Tile, Tabs, TabList, Tab, TabPanels, TabPanel, Tag } from '@carbon/react';
import { Navigate } from 'react-router-dom';
import { type ColumnDef } from '@tanstack/react-table';
import { useData } from '@/hooks';
import { ROUTES } from '@/utils/constants';
import { formatNumber, mibToGiB } from '@/utils/formatters';
import { EnhancedDataTable } from '@/components/tables';
import './TablesPage.scss';

// Type definitions for table rows - need index signature for TanStack Table
interface VMRow {
  [key: string]: unknown;
  id: string;
  name: string;
  powerState: string;
  cpus: number;
  memoryGiB: number;
  storageGiB: number;
  guestOS: string;
  cluster: string;
  host: string;
  datacenter: string;
}

interface DatastoreRow {
  [key: string]: unknown;
  id: string;
  name: string;
  type: string;
  capacityGiB: number;
  usedGiB: number;
  freePercent: number;
  vmCount: number;
  hostCount: number;
  datacenter: string;
}

interface SnapshotRow {
  [key: string]: unknown;
  id: string;
  vmName: string;
  snapshotName: string;
  sizeMiB: number;
  ageInDays: number;
  dateTime: string;
  quiesced: boolean;
  cluster: string;
}

interface HostRow {
  [key: string]: unknown;
  id: string;
  name: string;
  powerState: string;
  connectionState: string;
  cpuCores: number;
  memoryGiB: number;
  vmCount: number;
  esxiVersion: string;
  vendor: string;
  model: string;
  cluster: string;
  datacenter: string;
}

interface NetworkRow {
  [key: string]: unknown;
  id: string;
  vmName: string;
  powerState: string;
  nicLabel: string;
  adapterType: string;
  networkName: string;
  switchName: string;
  connected: boolean;
  macAddress: string;
  ipv4Address: string;
  datacenter: string;
  cluster: string;
}

interface ResourcePoolRow {
  [key: string]: unknown;
  id: string;
  name: string;
  configStatus: string;
  cpuReservation: number;
  cpuLimit: number;
  memoryReservationGiB: number;
  memoryLimitGiB: number;
  vmCount: number;
  datacenter: string;
  cluster: string;
}

interface ClusterRow {
  [key: string]: unknown;
  id: string;
  name: string;
  configStatus: string;
  overallStatus: string;
  vmCount: number;
  hostCount: number;
  totalCpuCores: number;
  totalMemoryGiB: number;
  haEnabled: boolean;
  drsEnabled: boolean;
  datacenter: string;
}

interface VCPURow {
  [key: string]: unknown;
  id: string;
  vmName: string;
  powerState: string;
  cpus: number;
  sockets: number;
  coresPerSocket: number;
  shares: number;
  reservation: number;
  limit: number;
  hotAddEnabled: boolean;
}

interface VMemoryRow {
  [key: string]: unknown;
  id: string;
  vmName: string;
  powerState: string;
  memoryGiB: number;
  shares: number;
  reservationGiB: number;
  limitGiB: number;
  hotAddEnabled: boolean;
  activeGiB: number;
  consumedGiB: number;
}

interface VDiskRow {
  [key: string]: unknown;
  id: string;
  vmName: string;
  powerState: string;
  diskLabel: string;
  capacityGiB: number;
  thin: boolean;
  diskMode: string;
  controllerType: string;
  datacenter: string;
  cluster: string;
}

interface VCDRow {
  [key: string]: unknown;
  id: string;
  vmName: string;
  powerState: string;
  deviceNode: string;
  connected: boolean;
  deviceType: string;
  datacenter: string;
  cluster: string;
}

interface VToolsRow {
  [key: string]: unknown;
  id: string;
  vmName: string;
  powerState: string;
  toolsStatus: string;
  toolsVersion: string;
  upgradeable: boolean;
  upgradePolicy: string;
  syncTime: boolean;
}

interface VLicenseRow {
  [key: string]: unknown;
  id: string;
  name: string;
  licenseKey: string;
  total: number;
  used: number;
  expirationDate: string;
  productName: string;
  productVersion: string;
}

interface VSourceRow {
  [key: string]: unknown;
  id: string;
  server: string;
  ipAddress: string;
  version: string;
  build: string;
  osType: string;
  apiVersion: string;
}

export function TablesPage() {
  const { rawData } = useData();

  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  // Prepare VM data
  const vmData: VMRow[] = useMemo(() =>
    rawData.vInfo.map((vm, index) => ({
      id: String(index),
      name: vm.vmName,
      powerState: vm.powerState,
      cpus: vm.cpus,
      memoryGiB: Math.round(mibToGiB(vm.memory) * 10) / 10,
      storageGiB: Math.round(mibToGiB(vm.provisionedMiB)),
      guestOS: vm.guestOS || 'Unknown',
      cluster: vm.cluster || 'N/A',
      host: vm.host || 'N/A',
      datacenter: vm.datacenter || 'N/A',
    })),
  [rawData.vInfo]);

  // Prepare datastore data
  const datastoreData: DatastoreRow[] = useMemo(() =>
    rawData.vDatastore.map((ds, index) => ({
      id: String(index),
      name: ds.name,
      type: ds.type || 'Unknown',
      capacityGiB: Math.round(mibToGiB(ds.capacityMiB)),
      usedGiB: Math.round(mibToGiB(ds.inUseMiB)),
      freePercent: Math.round(ds.freePercent * 10) / 10,
      vmCount: ds.vmCount,
      hostCount: ds.hostCount,
      datacenter: ds.datacenter || 'N/A',
    })),
  [rawData.vDatastore]);

  // Prepare snapshot data
  const snapshotData: SnapshotRow[] = useMemo(() =>
    rawData.vSnapshot.map((snap, index) => ({
      id: String(index),
      vmName: snap.vmName,
      snapshotName: snap.snapshotName,
      sizeMiB: Math.round(snap.sizeTotalMiB),
      ageInDays: snap.ageInDays,
      dateTime: snap.dateTime instanceof Date ? snap.dateTime.toLocaleDateString() : String(snap.dateTime),
      quiesced: snap.quiesced,
      cluster: snap.cluster || 'N/A',
    })),
  [rawData.vSnapshot]);

  // Prepare host data
  const hostData: HostRow[] = useMemo(() =>
    rawData.vHost.map((host, index) => ({
      id: String(index),
      name: host.name,
      powerState: host.powerState,
      connectionState: host.connectionState,
      cpuCores: host.totalCpuCores,
      memoryGiB: Math.round(mibToGiB(host.memoryMiB)),
      vmCount: host.vmCount,
      esxiVersion: host.esxiVersion || 'Unknown',
      vendor: host.vendor || 'Unknown',
      model: host.model || 'Unknown',
      cluster: host.cluster || 'N/A',
      datacenter: host.datacenter || 'N/A',
    })),
  [rawData.vHost]);

  // Prepare network data
  const networkData: NetworkRow[] = useMemo(() =>
    rawData.vNetwork.map((nic, index) => ({
      id: String(index),
      vmName: nic.vmName,
      powerState: nic.powerState,
      nicLabel: nic.nicLabel,
      adapterType: nic.adapterType,
      networkName: nic.networkName || 'N/A',
      switchName: nic.switchName || 'N/A',
      connected: nic.connected,
      macAddress: nic.macAddress,
      ipv4Address: nic.ipv4Address || 'N/A',
      datacenter: nic.datacenter || 'N/A',
      cluster: nic.cluster || 'N/A',
    })),
  [rawData.vNetwork]);

  // Prepare resource pool data
  const resourcePoolData: ResourcePoolRow[] = useMemo(() =>
    rawData.vResourcePool.map((rp, index) => ({
      id: String(index),
      name: rp.name,
      configStatus: rp.configStatus,
      cpuReservation: rp.cpuReservation,
      cpuLimit: rp.cpuLimit,
      memoryReservationGiB: Math.round(mibToGiB(rp.memoryReservation) * 10) / 10,
      memoryLimitGiB: rp.memoryLimit === -1 ? -1 : Math.round(mibToGiB(rp.memoryLimit) * 10) / 10,
      vmCount: rp.vmCount,
      datacenter: rp.datacenter || 'N/A',
      cluster: rp.cluster || 'N/A',
    })),
  [rawData.vResourcePool]);

  // Prepare cluster data
  const clusterData: ClusterRow[] = useMemo(() =>
    rawData.vCluster.map((cluster, index) => ({
      id: String(index),
      name: cluster.name,
      configStatus: cluster.configStatus,
      overallStatus: cluster.overallStatus,
      vmCount: cluster.vmCount,
      hostCount: cluster.hostCount,
      totalCpuCores: cluster.numCpuCores,
      totalMemoryGiB: Math.round(mibToGiB(cluster.totalMemoryMiB)),
      haEnabled: cluster.haEnabled,
      drsEnabled: cluster.drsEnabled,
      datacenter: cluster.datacenter || 'N/A',
    })),
  [rawData.vCluster]);

  // Prepare vCPU data
  const vcpuData: VCPURow[] = useMemo(() =>
    rawData.vCPU.map((cpu, index) => ({
      id: String(index),
      vmName: cpu.vmName,
      powerState: cpu.powerState,
      cpus: cpu.cpus,
      sockets: cpu.sockets,
      coresPerSocket: cpu.coresPerSocket,
      shares: cpu.shares,
      reservation: cpu.reservation,
      limit: cpu.limit,
      hotAddEnabled: cpu.hotAddEnabled,
    })),
  [rawData.vCPU]);

  // Prepare vMemory data
  const vmemoryData: VMemoryRow[] = useMemo(() =>
    rawData.vMemory.map((mem, index) => ({
      id: String(index),
      vmName: mem.vmName,
      powerState: mem.powerState,
      memoryGiB: Math.round(mibToGiB(mem.memoryMiB) * 10) / 10,
      shares: mem.shares,
      reservationGiB: Math.round(mibToGiB(mem.reservation) * 10) / 10,
      limitGiB: mem.limit === -1 ? -1 : Math.round(mibToGiB(mem.limit) * 10) / 10,
      hotAddEnabled: mem.hotAddEnabled,
      activeGiB: mem.active !== null ? Math.round(mibToGiB(mem.active) * 10) / 10 : 0,
      consumedGiB: mem.consumed !== null ? Math.round(mibToGiB(mem.consumed) * 10) / 10 : 0,
    })),
  [rawData.vMemory]);

  // Prepare vDisk data
  const vdiskData: VDiskRow[] = useMemo(() =>
    rawData.vDisk.map((disk, index) => ({
      id: String(index),
      vmName: disk.vmName,
      powerState: disk.powerState,
      diskLabel: disk.diskLabel,
      capacityGiB: Math.round(mibToGiB(disk.capacityMiB) * 10) / 10,
      thin: disk.thin,
      diskMode: disk.diskMode,
      controllerType: disk.controllerType,
      datacenter: disk.datacenter || 'N/A',
      cluster: disk.cluster || 'N/A',
    })),
  [rawData.vDisk]);

  // Prepare vCD data
  const vcdData: VCDRow[] = useMemo(() =>
    rawData.vCD.map((cd, index) => ({
      id: String(index),
      vmName: cd.vmName,
      powerState: cd.powerState,
      deviceNode: cd.deviceNode,
      connected: cd.connected,
      deviceType: cd.deviceType,
      datacenter: cd.datacenter || 'N/A',
      cluster: cd.cluster || 'N/A',
    })),
  [rawData.vCD]);

  // Prepare vTools data
  const vtoolsData: VToolsRow[] = useMemo(() =>
    rawData.vTools.map((tools, index) => ({
      id: String(index),
      vmName: tools.vmName,
      powerState: tools.powerState,
      toolsStatus: tools.toolsStatus,
      toolsVersion: tools.toolsVersion || 'N/A',
      upgradeable: tools.upgradeable,
      upgradePolicy: tools.upgradePolicy,
      syncTime: tools.syncTime,
    })),
  [rawData.vTools]);

  // Prepare vLicense data
  const vlicenseData: VLicenseRow[] = useMemo(() =>
    rawData.vLicense.map((license, index) => ({
      id: String(index),
      name: license.name,
      licenseKey: license.licenseKey,
      total: license.total,
      used: license.used,
      expirationDate: license.expirationDate instanceof Date
        ? license.expirationDate.toLocaleDateString()
        : license.expirationDate || 'Never',
      productName: license.productName,
      productVersion: license.productVersion,
    })),
  [rawData.vLicense]);

  // Prepare vSource data
  const vsourceData: VSourceRow[] = useMemo(() =>
    rawData.vSource.map((source, index) => ({
      id: String(index),
      server: source.server,
      ipAddress: source.ipAddress || 'N/A',
      version: source.version || 'N/A',
      build: source.build || 'N/A',
      osType: source.osType || 'N/A',
      apiVersion: source.apiVersion || 'N/A',
    })),
  [rawData.vSource]);

  // VM column definitions
  const vmColumns: ColumnDef<VMRow, unknown>[] = useMemo(() => [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'VM Name',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'powerState',
      accessorKey: 'powerState',
      header: 'Power State',
      cell: (info) => {
        const state = info.getValue() as string;
        const type = state === 'poweredOn' ? 'green' : state === 'poweredOff' ? 'gray' : 'magenta';
        return <Tag type={type} size="sm">{state}</Tag>;
      },
    },
    {
      id: 'cpus',
      accessorKey: 'cpus',
      header: 'vCPUs',
    },
    {
      id: 'memoryGiB',
      accessorKey: 'memoryGiB',
      header: 'Memory (GiB)',
      cell: (info) => `${info.getValue()} GiB`,
    },
    {
      id: 'storageGiB',
      accessorKey: 'storageGiB',
      header: 'Storage (GiB)',
      cell: (info) => `${formatNumber(info.getValue() as number)} GiB`,
    },
    {
      id: 'guestOS',
      accessorKey: 'guestOS',
      header: 'Guest OS',
    },
    {
      id: 'cluster',
      accessorKey: 'cluster',
      header: 'Cluster',
    },
    {
      id: 'host',
      accessorKey: 'host',
      header: 'Host',
    },
    {
      id: 'datacenter',
      accessorKey: 'datacenter',
      header: 'Datacenter',
    },
  ], []);

  // Datastore column definitions
  const datastoreColumns: ColumnDef<DatastoreRow, unknown>[] = useMemo(() => [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Datastore',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'type',
      accessorKey: 'type',
      header: 'Type',
      cell: (info) => <Tag type="blue" size="sm">{info.getValue() as string}</Tag>,
    },
    {
      id: 'capacityGiB',
      accessorKey: 'capacityGiB',
      header: 'Capacity (GiB)',
      cell: (info) => formatNumber(info.getValue() as number),
    },
    {
      id: 'usedGiB',
      accessorKey: 'usedGiB',
      header: 'Used (GiB)',
      cell: (info) => formatNumber(info.getValue() as number),
    },
    {
      id: 'freePercent',
      accessorKey: 'freePercent',
      header: 'Free %',
      cell: (info) => {
        const pct = info.getValue() as number;
        const type = pct < 10 ? 'red' : pct < 20 ? 'magenta' : 'green';
        return <Tag type={type} size="sm">{pct}%</Tag>;
      },
    },
    {
      id: 'vmCount',
      accessorKey: 'vmCount',
      header: 'VMs',
    },
    {
      id: 'hostCount',
      accessorKey: 'hostCount',
      header: 'Hosts',
    },
    {
      id: 'datacenter',
      accessorKey: 'datacenter',
      header: 'Datacenter',
    },
  ], []);

  // Snapshot column definitions
  const snapshotColumns: ColumnDef<SnapshotRow, unknown>[] = useMemo(() => [
    {
      id: 'vmName',
      accessorKey: 'vmName',
      header: 'VM Name',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'snapshotName',
      accessorKey: 'snapshotName',
      header: 'Snapshot Name',
    },
    {
      id: 'sizeMiB',
      accessorKey: 'sizeMiB',
      header: 'Size (MiB)',
      cell: (info) => formatNumber(info.getValue() as number),
    },
    {
      id: 'ageInDays',
      accessorKey: 'ageInDays',
      header: 'Age (Days)',
      cell: (info) => {
        const age = info.getValue() as number;
        const type = age > 30 ? 'red' : age > 7 ? 'magenta' : 'green';
        return <Tag type={type} size="sm">{age} days</Tag>;
      },
    },
    {
      id: 'dateTime',
      accessorKey: 'dateTime',
      header: 'Created',
    },
    {
      id: 'quiesced',
      accessorKey: 'quiesced',
      header: 'Quiesced',
      cell: (info) => (info.getValue() as boolean) ? 'Yes' : 'No',
    },
    {
      id: 'cluster',
      accessorKey: 'cluster',
      header: 'Cluster',
    },
  ], []);

  // Host column definitions
  const hostColumns: ColumnDef<HostRow, unknown>[] = useMemo(() => [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Host Name',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'powerState',
      accessorKey: 'powerState',
      header: 'Power',
      cell: (info) => {
        const state = info.getValue() as string;
        const type = state === 'poweredOn' ? 'green' : 'gray';
        return <Tag type={type} size="sm">{state}</Tag>;
      },
    },
    {
      id: 'connectionState',
      accessorKey: 'connectionState',
      header: 'Connection',
      cell: (info) => {
        const state = info.getValue() as string;
        const type = state === 'connected' ? 'green' : 'red';
        return <Tag type={type} size="sm">{state}</Tag>;
      },
    },
    {
      id: 'cpuCores',
      accessorKey: 'cpuCores',
      header: 'CPU Cores',
    },
    {
      id: 'memoryGiB',
      accessorKey: 'memoryGiB',
      header: 'Memory (GiB)',
      cell: (info) => formatNumber(info.getValue() as number),
    },
    {
      id: 'vmCount',
      accessorKey: 'vmCount',
      header: 'VMs',
    },
    {
      id: 'esxiVersion',
      accessorKey: 'esxiVersion',
      header: 'ESXi Version',
    },
    {
      id: 'vendor',
      accessorKey: 'vendor',
      header: 'Vendor',
    },
    {
      id: 'cluster',
      accessorKey: 'cluster',
      header: 'Cluster',
    },
    {
      id: 'datacenter',
      accessorKey: 'datacenter',
      header: 'Datacenter',
    },
  ], []);

  // Network column definitions
  const networkColumns: ColumnDef<NetworkRow, unknown>[] = useMemo(() => [
    {
      id: 'vmName',
      accessorKey: 'vmName',
      header: 'VM Name',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'powerState',
      accessorKey: 'powerState',
      header: 'Power',
      cell: (info) => {
        const state = info.getValue() as string;
        const type = state === 'poweredOn' ? 'green' : state === 'poweredOff' ? 'gray' : 'magenta';
        return <Tag type={type} size="sm">{state}</Tag>;
      },
    },
    {
      id: 'nicLabel',
      accessorKey: 'nicLabel',
      header: 'NIC Label',
    },
    {
      id: 'adapterType',
      accessorKey: 'adapterType',
      header: 'Adapter Type',
      cell: (info) => <Tag type="blue" size="sm">{info.getValue() as string}</Tag>,
    },
    {
      id: 'networkName',
      accessorKey: 'networkName',
      header: 'Network',
    },
    {
      id: 'switchName',
      accessorKey: 'switchName',
      header: 'Switch',
    },
    {
      id: 'connected',
      accessorKey: 'connected',
      header: 'Connected',
      cell: (info) => {
        const connected = info.getValue() as boolean;
        return <Tag type={connected ? 'green' : 'gray'} size="sm">{connected ? 'Yes' : 'No'}</Tag>;
      },
    },
    {
      id: 'macAddress',
      accessorKey: 'macAddress',
      header: 'MAC Address',
    },
    {
      id: 'ipv4Address',
      accessorKey: 'ipv4Address',
      header: 'IPv4 Address',
    },
    {
      id: 'datacenter',
      accessorKey: 'datacenter',
      header: 'Datacenter',
    },
  ], []);

  // Resource Pool column definitions
  const resourcePoolColumns: ColumnDef<ResourcePoolRow, unknown>[] = useMemo(() => [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Name',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'configStatus',
      accessorKey: 'configStatus',
      header: 'Status',
      cell: (info) => {
        const status = info.getValue() as string;
        const type = status === 'green' ? 'green' : status === 'yellow' ? 'magenta' : 'red';
        return <Tag type={type} size="sm">{status}</Tag>;
      },
    },
    {
      id: 'cpuReservation',
      accessorKey: 'cpuReservation',
      header: 'CPU Rsv (MHz)',
      cell: (info) => formatNumber(info.getValue() as number),
    },
    {
      id: 'cpuLimit',
      accessorKey: 'cpuLimit',
      header: 'CPU Limit (MHz)',
      cell: (info) => {
        const limit = info.getValue() as number;
        return limit === -1 ? 'Unlimited' : formatNumber(limit);
      },
    },
    {
      id: 'memoryReservationGiB',
      accessorKey: 'memoryReservationGiB',
      header: 'Mem Rsv (GiB)',
      cell: (info) => `${info.getValue()} GiB`,
    },
    {
      id: 'memoryLimitGiB',
      accessorKey: 'memoryLimitGiB',
      header: 'Mem Limit (GiB)',
      cell: (info) => {
        const limit = info.getValue() as number;
        return limit === -1 ? 'Unlimited' : `${limit} GiB`;
      },
    },
    {
      id: 'vmCount',
      accessorKey: 'vmCount',
      header: 'VMs',
    },
    {
      id: 'datacenter',
      accessorKey: 'datacenter',
      header: 'Datacenter',
    },
    {
      id: 'cluster',
      accessorKey: 'cluster',
      header: 'Cluster',
    },
  ], []);

  // Cluster column definitions
  const clusterColumns: ColumnDef<ClusterRow, unknown>[] = useMemo(() => [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Cluster Name',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'overallStatus',
      accessorKey: 'overallStatus',
      header: 'Status',
      cell: (info) => {
        const status = info.getValue() as string;
        const type = status === 'green' ? 'green' : status === 'yellow' ? 'magenta' : 'red';
        return <Tag type={type} size="sm">{status}</Tag>;
      },
    },
    {
      id: 'vmCount',
      accessorKey: 'vmCount',
      header: 'VMs',
    },
    {
      id: 'hostCount',
      accessorKey: 'hostCount',
      header: 'Hosts',
    },
    {
      id: 'totalCpuCores',
      accessorKey: 'totalCpuCores',
      header: 'CPU Cores',
    },
    {
      id: 'totalMemoryGiB',
      accessorKey: 'totalMemoryGiB',
      header: 'Memory (GiB)',
      cell: (info) => formatNumber(info.getValue() as number),
    },
    {
      id: 'haEnabled',
      accessorKey: 'haEnabled',
      header: 'HA',
      cell: (info) => {
        const enabled = info.getValue() as boolean;
        return <Tag type={enabled ? 'green' : 'gray'} size="sm">{enabled ? 'On' : 'Off'}</Tag>;
      },
    },
    {
      id: 'drsEnabled',
      accessorKey: 'drsEnabled',
      header: 'DRS',
      cell: (info) => {
        const enabled = info.getValue() as boolean;
        return <Tag type={enabled ? 'green' : 'gray'} size="sm">{enabled ? 'On' : 'Off'}</Tag>;
      },
    },
    {
      id: 'datacenter',
      accessorKey: 'datacenter',
      header: 'Datacenter',
    },
  ], []);

  // vCPU column definitions
  const vcpuColumns: ColumnDef<VCPURow, unknown>[] = useMemo(() => [
    {
      id: 'vmName',
      accessorKey: 'vmName',
      header: 'VM Name',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'powerState',
      accessorKey: 'powerState',
      header: 'Power',
      cell: (info) => {
        const state = info.getValue() as string;
        const type = state === 'poweredOn' ? 'green' : state === 'poweredOff' ? 'gray' : 'magenta';
        return <Tag type={type} size="sm">{state}</Tag>;
      },
    },
    {
      id: 'cpus',
      accessorKey: 'cpus',
      header: 'vCPUs',
    },
    {
      id: 'sockets',
      accessorKey: 'sockets',
      header: 'Sockets',
    },
    {
      id: 'coresPerSocket',
      accessorKey: 'coresPerSocket',
      header: 'Cores/Socket',
    },
    {
      id: 'shares',
      accessorKey: 'shares',
      header: 'Shares',
    },
    {
      id: 'reservation',
      accessorKey: 'reservation',
      header: 'Reservation (MHz)',
      cell: (info) => formatNumber(info.getValue() as number),
    },
    {
      id: 'limit',
      accessorKey: 'limit',
      header: 'Limit (MHz)',
      cell: (info) => {
        const limit = info.getValue() as number;
        return limit === -1 ? 'Unlimited' : formatNumber(limit);
      },
    },
    {
      id: 'hotAddEnabled',
      accessorKey: 'hotAddEnabled',
      header: 'Hot Add',
      cell: (info) => (info.getValue() as boolean) ? 'Yes' : 'No',
    },
  ], []);

  // vMemory column definitions
  const vmemoryColumns: ColumnDef<VMemoryRow, unknown>[] = useMemo(() => [
    {
      id: 'vmName',
      accessorKey: 'vmName',
      header: 'VM Name',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'powerState',
      accessorKey: 'powerState',
      header: 'Power',
      cell: (info) => {
        const state = info.getValue() as string;
        const type = state === 'poweredOn' ? 'green' : state === 'poweredOff' ? 'gray' : 'magenta';
        return <Tag type={type} size="sm">{state}</Tag>;
      },
    },
    {
      id: 'memoryGiB',
      accessorKey: 'memoryGiB',
      header: 'Memory (GiB)',
      cell: (info) => `${info.getValue()} GiB`,
    },
    {
      id: 'shares',
      accessorKey: 'shares',
      header: 'Shares',
    },
    {
      id: 'reservationGiB',
      accessorKey: 'reservationGiB',
      header: 'Reservation (GiB)',
      cell: (info) => `${info.getValue()} GiB`,
    },
    {
      id: 'limitGiB',
      accessorKey: 'limitGiB',
      header: 'Limit (GiB)',
      cell: (info) => {
        const limit = info.getValue() as number;
        return limit === -1 ? 'Unlimited' : `${limit} GiB`;
      },
    },
    {
      id: 'hotAddEnabled',
      accessorKey: 'hotAddEnabled',
      header: 'Hot Add',
      cell: (info) => (info.getValue() as boolean) ? 'Yes' : 'No',
    },
    {
      id: 'activeGiB',
      accessorKey: 'activeGiB',
      header: 'Active (GiB)',
      cell: (info) => `${info.getValue()} GiB`,
    },
    {
      id: 'consumedGiB',
      accessorKey: 'consumedGiB',
      header: 'Consumed (GiB)',
      cell: (info) => `${info.getValue()} GiB`,
    },
  ], []);

  // vDisk column definitions
  const vdiskColumns: ColumnDef<VDiskRow, unknown>[] = useMemo(() => [
    {
      id: 'vmName',
      accessorKey: 'vmName',
      header: 'VM Name',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'powerState',
      accessorKey: 'powerState',
      header: 'Power',
      cell: (info) => {
        const state = info.getValue() as string;
        const type = state === 'poweredOn' ? 'green' : state === 'poweredOff' ? 'gray' : 'magenta';
        return <Tag type={type} size="sm">{state}</Tag>;
      },
    },
    {
      id: 'diskLabel',
      accessorKey: 'diskLabel',
      header: 'Disk Label',
    },
    {
      id: 'capacityGiB',
      accessorKey: 'capacityGiB',
      header: 'Capacity (GiB)',
      cell: (info) => `${info.getValue()} GiB`,
    },
    {
      id: 'thin',
      accessorKey: 'thin',
      header: 'Thin',
      cell: (info) => {
        const thin = info.getValue() as boolean;
        return <Tag type={thin ? 'blue' : 'gray'} size="sm">{thin ? 'Yes' : 'No'}</Tag>;
      },
    },
    {
      id: 'diskMode',
      accessorKey: 'diskMode',
      header: 'Mode',
    },
    {
      id: 'controllerType',
      accessorKey: 'controllerType',
      header: 'Controller',
    },
    {
      id: 'datacenter',
      accessorKey: 'datacenter',
      header: 'Datacenter',
    },
    {
      id: 'cluster',
      accessorKey: 'cluster',
      header: 'Cluster',
    },
  ], []);

  // vCD column definitions
  const vcdColumns: ColumnDef<VCDRow, unknown>[] = useMemo(() => [
    {
      id: 'vmName',
      accessorKey: 'vmName',
      header: 'VM Name',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'powerState',
      accessorKey: 'powerState',
      header: 'Power',
      cell: (info) => {
        const state = info.getValue() as string;
        const type = state === 'poweredOn' ? 'green' : state === 'poweredOff' ? 'gray' : 'magenta';
        return <Tag type={type} size="sm">{state}</Tag>;
      },
    },
    {
      id: 'deviceNode',
      accessorKey: 'deviceNode',
      header: 'Device Node',
    },
    {
      id: 'connected',
      accessorKey: 'connected',
      header: 'Connected',
      cell: (info) => {
        const connected = info.getValue() as boolean;
        return <Tag type={connected ? 'green' : 'gray'} size="sm">{connected ? 'Yes' : 'No'}</Tag>;
      },
    },
    {
      id: 'deviceType',
      accessorKey: 'deviceType',
      header: 'Device Type',
    },
    {
      id: 'datacenter',
      accessorKey: 'datacenter',
      header: 'Datacenter',
    },
    {
      id: 'cluster',
      accessorKey: 'cluster',
      header: 'Cluster',
    },
  ], []);

  // vTools column definitions
  const vtoolsColumns: ColumnDef<VToolsRow, unknown>[] = useMemo(() => [
    {
      id: 'vmName',
      accessorKey: 'vmName',
      header: 'VM Name',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'powerState',
      accessorKey: 'powerState',
      header: 'Power',
      cell: (info) => {
        const state = info.getValue() as string;
        const type = state === 'poweredOn' ? 'green' : state === 'poweredOff' ? 'gray' : 'magenta';
        return <Tag type={type} size="sm">{state}</Tag>;
      },
    },
    {
      id: 'toolsStatus',
      accessorKey: 'toolsStatus',
      header: 'Tools Status',
      cell: (info) => {
        const status = info.getValue() as string;
        const type = status === 'toolsOk' ? 'green'
          : status === 'toolsOld' ? 'magenta'
          : status === 'toolsNotInstalled' ? 'red'
          : 'gray';
        return <Tag type={type} size="sm">{status}</Tag>;
      },
    },
    {
      id: 'toolsVersion',
      accessorKey: 'toolsVersion',
      header: 'Tools Version',
    },
    {
      id: 'upgradeable',
      accessorKey: 'upgradeable',
      header: 'Upgradeable',
      cell: (info) => (info.getValue() as boolean) ? 'Yes' : 'No',
    },
    {
      id: 'upgradePolicy',
      accessorKey: 'upgradePolicy',
      header: 'Upgrade Policy',
    },
    {
      id: 'syncTime',
      accessorKey: 'syncTime',
      header: 'Sync Time',
      cell: (info) => (info.getValue() as boolean) ? 'Yes' : 'No',
    },
  ], []);

  // vLicense column definitions
  const vlicenseColumns: ColumnDef<VLicenseRow, unknown>[] = useMemo(() => [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'License Name',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'licenseKey',
      accessorKey: 'licenseKey',
      header: 'License Key',
    },
    {
      id: 'total',
      accessorKey: 'total',
      header: 'Total',
    },
    {
      id: 'used',
      accessorKey: 'used',
      header: 'Used',
    },
    {
      id: 'expirationDate',
      accessorKey: 'expirationDate',
      header: 'Expiration',
    },
    {
      id: 'productName',
      accessorKey: 'productName',
      header: 'Product',
    },
    {
      id: 'productVersion',
      accessorKey: 'productVersion',
      header: 'Version',
    },
  ], []);

  // vSource column definitions
  const vsourceColumns: ColumnDef<VSourceRow, unknown>[] = useMemo(() => [
    {
      id: 'server',
      accessorKey: 'server',
      header: 'Server',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'ipAddress',
      accessorKey: 'ipAddress',
      header: 'IP Address',
    },
    {
      id: 'version',
      accessorKey: 'version',
      header: 'Version',
    },
    {
      id: 'build',
      accessorKey: 'build',
      header: 'Build',
    },
    {
      id: 'osType',
      accessorKey: 'osType',
      header: 'OS Type',
    },
    {
      id: 'apiVersion',
      accessorKey: 'apiVersion',
      header: 'API Version',
    },
  ], []);

  return (
    <div className="tables-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="tables-page__title">Data Tables</h1>
          <p className="tables-page__subtitle">
            Detailed infrastructure data with search, sort, and export capabilities
          </p>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <Tile className="tables-page__table-tile">
            <Tabs>
              <TabList aria-label="Data tables" contained>
                <Tab>VMs ({formatNumber(vmData.length)})</Tab>
                <Tab>Hosts ({formatNumber(hostData.length)})</Tab>
                <Tab>Clusters ({formatNumber(clusterData.length)})</Tab>
                <Tab>Datastores ({formatNumber(datastoreData.length)})</Tab>
                <Tab>Networks ({formatNumber(networkData.length)})</Tab>
                <Tab>Resource Pools ({formatNumber(resourcePoolData.length)})</Tab>
                <Tab>vCPU ({formatNumber(vcpuData.length)})</Tab>
                <Tab>vMemory ({formatNumber(vmemoryData.length)})</Tab>
                <Tab>vDisk ({formatNumber(vdiskData.length)})</Tab>
                <Tab>Snapshots ({formatNumber(snapshotData.length)})</Tab>
                <Tab>VMware Tools ({formatNumber(vtoolsData.length)})</Tab>
                <Tab>CD-ROMs ({formatNumber(vcdData.length)})</Tab>
                <Tab>Licenses ({formatNumber(vlicenseData.length)})</Tab>
                <Tab>vCenter ({formatNumber(vsourceData.length)})</Tab>
              </TabList>
              <TabPanels>
                <TabPanel>
                  <EnhancedDataTable
                    data={vmData}
                    columns={vmColumns}
                    title="Virtual Machines"
                    description={`${formatNumber(vmData.length)} VMs in inventory`}
                    exportFilename="vm-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
                <TabPanel>
                  <EnhancedDataTable
                    data={hostData}
                    columns={hostColumns}
                    title="ESXi Hosts"
                    description={`${formatNumber(hostData.length)} hosts in inventory`}
                    exportFilename="host-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
                <TabPanel>
                  <EnhancedDataTable
                    data={clusterData}
                    columns={clusterColumns}
                    title="Clusters"
                    description={`${formatNumber(clusterData.length)} clusters in inventory`}
                    exportFilename="cluster-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
                <TabPanel>
                  <EnhancedDataTable
                    data={datastoreData}
                    columns={datastoreColumns}
                    title="Datastores"
                    description={`${formatNumber(datastoreData.length)} datastores in inventory`}
                    exportFilename="datastore-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
                <TabPanel>
                  <EnhancedDataTable
                    data={networkData}
                    columns={networkColumns}
                    title="Network Adapters"
                    description={`${formatNumber(networkData.length)} network adapters in inventory`}
                    exportFilename="network-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
                <TabPanel>
                  <EnhancedDataTable
                    data={resourcePoolData}
                    columns={resourcePoolColumns}
                    title="Resource Pools"
                    description={`${formatNumber(resourcePoolData.length)} resource pools in inventory`}
                    exportFilename="resourcepool-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
                <TabPanel>
                  <EnhancedDataTable
                    data={vcpuData}
                    columns={vcpuColumns}
                    title="vCPU Configuration"
                    description={`${formatNumber(vcpuData.length)} VM CPU configurations`}
                    exportFilename="vcpu-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
                <TabPanel>
                  <EnhancedDataTable
                    data={vmemoryData}
                    columns={vmemoryColumns}
                    title="vMemory Configuration"
                    description={`${formatNumber(vmemoryData.length)} VM memory configurations`}
                    exportFilename="vmemory-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
                <TabPanel>
                  <EnhancedDataTable
                    data={vdiskData}
                    columns={vdiskColumns}
                    title="Virtual Disks"
                    description={`${formatNumber(vdiskData.length)} virtual disks in inventory`}
                    exportFilename="vdisk-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
                <TabPanel>
                  <EnhancedDataTable
                    data={snapshotData}
                    columns={snapshotColumns}
                    title="Snapshots"
                    description={`${formatNumber(snapshotData.length)} snapshots found`}
                    exportFilename="snapshot-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
                <TabPanel>
                  <EnhancedDataTable
                    data={vtoolsData}
                    columns={vtoolsColumns}
                    title="VMware Tools"
                    description={`${formatNumber(vtoolsData.length)} VMs with Tools info`}
                    exportFilename="vmtools-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
                <TabPanel>
                  <EnhancedDataTable
                    data={vcdData}
                    columns={vcdColumns}
                    title="CD-ROM Devices"
                    description={`${formatNumber(vcdData.length)} CD-ROM devices in inventory`}
                    exportFilename="cdrom-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
                <TabPanel>
                  <EnhancedDataTable
                    data={vlicenseData}
                    columns={vlicenseColumns}
                    title="VMware Licenses"
                    description={`${formatNumber(vlicenseData.length)} licenses in inventory`}
                    exportFilename="license-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
                <TabPanel>
                  <EnhancedDataTable
                    data={vsourceData}
                    columns={vsourceColumns}
                    title="vCenter Sources"
                    description={`${formatNumber(vsourceData.length)} vCenter servers`}
                    exportFilename="vcenter-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Tile>
        </Column>
      </Grid>
    </div>
  );
}
