// Data tables page
import { Grid, Column, Tile, Tabs, TabList, Tab, TabPanels, TabPanel, DataTable, Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@carbon/react';
import { Navigate } from 'react-router-dom';
import { useData } from '@/hooks';
import { ROUTES } from '@/utils/constants';
import { formatNumber, mibToGiB, formatPowerState } from '@/utils/formatters';
import './TablesPage.scss';

export function TablesPage() {
  const { rawData } = useData();

  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  // Prepare VM data for display (limited for initial view)
  const vmRows = rawData.vInfo.slice(0, 100).map((vm, index) => ({
    id: String(index),
    name: vm.vmName,
    powerState: formatPowerState(vm.powerState),
    cpus: vm.cpus,
    memory: `${mibToGiB(vm.memory).toFixed(1)} GiB`,
    guestOS: vm.guestOS || 'Unknown',
    cluster: vm.cluster || 'N/A',
    host: vm.host || 'N/A',
  }));

  const vmHeaders = [
    { key: 'name', header: 'VM Name' },
    { key: 'powerState', header: 'Power State' },
    { key: 'cpus', header: 'vCPUs' },
    { key: 'memory', header: 'Memory' },
    { key: 'guestOS', header: 'Guest OS' },
    { key: 'cluster', header: 'Cluster' },
    { key: 'host', header: 'Host' },
  ];

  // Prepare datastore data
  const datastoreRows = rawData.vDatastore.slice(0, 50).map((ds, index) => ({
    id: String(index),
    name: ds.name,
    type: ds.type || 'Unknown',
    capacity: `${mibToGiB(ds.capacityMiB).toFixed(0)} GiB`,
    used: `${mibToGiB(ds.inUseMiB).toFixed(0)} GiB`,
    free: `${ds.freePercent.toFixed(1)}%`,
    vmCount: ds.vmCount,
  }));

  const datastoreHeaders = [
    { key: 'name', header: 'Datastore' },
    { key: 'type', header: 'Type' },
    { key: 'capacity', header: 'Capacity' },
    { key: 'used', header: 'Used' },
    { key: 'free', header: 'Free %' },
    { key: 'vmCount', header: 'VMs' },
  ];

  return (
    <div className="tables-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="tables-page__title">Data Tables</h1>
          <p className="tables-page__subtitle">
            Detailed view of infrastructure data (showing first 100 records)
          </p>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <Tile className="tables-page__table-tile">
            <Tabs>
              <TabList aria-label="Data tables">
                <Tab>Virtual Machines ({formatNumber(rawData.vInfo.length)})</Tab>
                <Tab>Datastores ({formatNumber(rawData.vDatastore.length)})</Tab>
                <Tab>Snapshots ({formatNumber(rawData.vSnapshot.length)})</Tab>
              </TabList>
              <TabPanels>
                <TabPanel>
                  <DataTable rows={vmRows} headers={vmHeaders}>
                    {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                      <Table {...getTableProps()}>
                        <TableHead>
                          <TableRow>
                            {headers.map((header) => (
                              <TableHeader {...getHeaderProps({ header })} key={header.key}>
                                {header.header}
                              </TableHeader>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {rows.map((row) => (
                            <TableRow {...getRowProps({ row })} key={row.id}>
                              {row.cells.map((cell) => (
                                <TableCell key={cell.id}>{cell.value}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </DataTable>
                </TabPanel>
                <TabPanel>
                  <DataTable rows={datastoreRows} headers={datastoreHeaders}>
                    {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                      <Table {...getTableProps()}>
                        <TableHead>
                          <TableRow>
                            {headers.map((header) => (
                              <TableHeader {...getHeaderProps({ header })} key={header.key}>
                                {header.header}
                              </TableHeader>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {rows.map((row) => (
                            <TableRow {...getRowProps({ row })} key={row.id}>
                              {row.cells.map((cell) => (
                                <TableCell key={cell.id}>{cell.value}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </DataTable>
                </TabPanel>
                <TabPanel>
                  <p className="tables-page__placeholder">
                    Snapshot table will be enhanced in Step 11 with TanStack Table
                  </p>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Tile>
        </Column>
      </Grid>
    </div>
  );
}
