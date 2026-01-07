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
              <TabList aria-label="Data tables">
                <Tab>Virtual Machines ({formatNumber(vmData.length)})</Tab>
                <Tab>Datastores ({formatNumber(datastoreData.length)})</Tab>
                <Tab>Snapshots ({formatNumber(snapshotData.length)})</Tab>
                <Tab>Hosts ({formatNumber(hostData.length)})</Tab>
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
                    data={hostData}
                    columns={hostColumns}
                    title="ESXi Hosts"
                    description={`${formatNumber(hostData.length)} hosts in inventory`}
                    exportFilename="host-inventory"
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
