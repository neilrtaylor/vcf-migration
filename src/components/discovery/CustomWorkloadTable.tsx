/**
 * CustomWorkloadTable Component
 *
 * Displays VMs with custom workload type overrides in a Carbon DataTable with:
 * - Clickable custom type filters
 * - Search functionality
 * - Pagination
 */

import { useState, useMemo, useCallback } from 'react';
import {
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tag,
  Button,
  Pagination,
  ClickableTile,
  Tile,
} from '@carbon/react';
import { Close, DocumentExport } from '@carbon/icons-react';
import type { VirtualMachine } from '@/types/rvtools';
import type { UseVMOverridesReturn } from '@/hooks/useVMOverrides';
import { getVMIdentifier } from '@/utils/vmIdentifier';
import { formatNumber, mibToGiB } from '@/utils/formatters';
import workloadPatterns from '@/data/workloadPatterns.json';
import './CustomWorkloadTable.scss';

// Helper: check if a workload type name matches a standard category
type CategoryDef = { name: string; patterns: string[] };
function isStandardCategory(typeName: string): boolean {
  const categories = workloadPatterns.categories as Record<string, CategoryDef>;
  const nameLower = typeName.toLowerCase();
  for (const cat of Object.values(categories)) {
    if (cat.name.toLowerCase() === nameLower) return true;
  }
  return false;
}

// ===== TYPES =====

interface CustomWorkloadTableProps {
  vms: VirtualMachine[];
  vmOverrides: UseVMOverridesReturn;
}

interface CustomWorkloadRow {
  id: string;
  vmName: string;
  cluster: string;
  cpus: number;
  memoryGiB: number;
  storageGiB: number;
  customWorkload: string;
  notes: string;
}

// ===== COMPONENT =====

export function CustomWorkloadTable({ vms, vmOverrides }: CustomWorkloadTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Get VMs with custom workload types (overrides that aren't just exclusions)
  const customWorkloadVMs = useMemo((): CustomWorkloadRow[] => {
    const result: CustomWorkloadRow[] = [];

    for (const vm of vms) {
      const vmId = getVMIdentifier(vm);
      const workloadType = vmOverrides.getWorkloadType(vmId);

      if (workloadType) {
        // Skip if this override maps to a standard workload category
        // (those VMs now appear in the category sub-tab instead)
        if (isStandardCategory(workloadType)) continue;

        result.push({
          id: vmId,
          vmName: vm.vmName,
          cluster: vm.cluster,
          cpus: vm.cpus,
          memoryGiB: Math.round(mibToGiB(vm.memory)),
          storageGiB: Math.round(mibToGiB(vm.provisionedMiB)),
          customWorkload: workloadType,
          notes: vmOverrides.getNotes(vmId) || '',
        });
      }
    }

    return result;
  }, [vms, vmOverrides]);

  // Group by custom workload type
  const customWorkloadTypes = useMemo(() => {
    const types: Record<string, number> = {};
    for (const row of customWorkloadVMs) {
      types[row.customWorkload] = (types[row.customWorkload] || 0) + 1;
    }
    return Object.entries(types).sort((a, b) => b[1] - a[1]);
  }, [customWorkloadVMs]);

  // Filter by type and search term
  const filteredRows = useMemo(() => {
    let result = customWorkloadVMs;

    if (selectedType) {
      result = result.filter(row => row.customWorkload === selectedType);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(row =>
        row.vmName.toLowerCase().includes(term) ||
        row.cluster.toLowerCase().includes(term) ||
        row.customWorkload.toLowerCase().includes(term) ||
        row.notes.toLowerCase().includes(term)
      );
    }

    return result;
  }, [customWorkloadVMs, selectedType, searchTerm]);

  // Paginate
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  // Type click handler
  const handleTypeClick = useCallback((type: string) => {
    setSelectedType(prev => prev === type ? null : type);
    setPage(1);
  }, []);

  // Export to CSV
  const handleExportCSV = useCallback(() => {
    const headers = ['VM Name', 'Cluster', 'vCPUs', 'Memory (GiB)', 'Storage (GiB)', 'Custom Workload Type', 'Notes'];
    const csvRows = filteredRows.map(row => [
      row.vmName,
      row.cluster,
      row.cpus.toString(),
      row.memoryGiB.toString(),
      row.storageGiB.toString(),
      row.customWorkload,
      row.notes,
    ]);

    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'custom-workloads.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredRows]);

  const headers = [
    { key: 'vmName', header: 'VM Name' },
    { key: 'cluster', header: 'Cluster' },
    { key: 'cpus', header: 'vCPUs' },
    { key: 'memoryGiB', header: 'Memory' },
    { key: 'storageGiB', header: 'Storage' },
    { key: 'customWorkload', header: 'Custom Workload' },
    { key: 'notes', header: 'Notes' },
  ];

  // Empty state
  if (customWorkloadVMs.length === 0) {
    return (
      <div className="custom-workload-table">
        <Tile className="custom-workload-table__empty-tile">
          <h4>No Custom Workload Types</h4>
          <p>
            VMs with manually assigned workload types will appear here.
            Go to the VMs tab to assign custom workload types to specific VMs.
          </p>
        </Tile>
      </div>
    );
  }

  return (
    <div className="custom-workload-table">
      {/* Clickable type filters */}
      <div className="custom-workload-table__filters">
        <span className="custom-workload-table__filters-label">Filter by custom type:</span>
        <div className="custom-workload-table__filter-tags">
          {customWorkloadTypes.map(([type, count]) => (
            <ClickableTile
              key={type}
              className={`custom-workload-table__filter-tile ${selectedType === type ? 'custom-workload-table__filter-tile--selected' : ''}`}
              onClick={() => handleTypeClick(type)}
            >
              <span className="custom-workload-table__filter-name">{type}</span>
              <Tag type={selectedType === type ? 'cyan' : 'gray'} size="sm">
                {count}
              </Tag>
            </ClickableTile>
          ))}
          {selectedType && (
            <Button
              kind="ghost"
              size="sm"
              renderIcon={Close}
              onClick={() => {
                setSelectedType(null);
                setPage(1);
              }}
              hasIconOnly
              iconDescription="Clear filter"
            />
          )}
        </div>
      </div>

      {/* Data Table */}
      <DataTable rows={paginatedRows} headers={headers} isSortable>
        {({
          rows,
          headers,
          getHeaderProps,
          getRowProps,
          getTableProps,
          getTableContainerProps,
        }) => (
          <TableContainer {...getTableContainerProps()}>
            <TableToolbar>
              <TableToolbarContent>
                <TableToolbarSearch
                  placeholder="Search custom workloads..."
                  onChange={(e) => {
                    const value = typeof e === 'string' ? e : e.target.value;
                    setSearchTerm(value);
                    setPage(1);
                  }}
                  value={searchTerm}
                  persistent
                />
                <Button
                  kind="ghost"
                  size="sm"
                  renderIcon={DocumentExport}
                  onClick={handleExportCSV}
                  hasIconOnly
                  iconDescription="Export to CSV"
                />
              </TableToolbarContent>
            </TableToolbar>

            <Table {...getTableProps()} size="md">
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
                {rows.map((row) => {
                  const originalRow = paginatedRows.find(r => r.id === row.id);
                  if (!originalRow) return null;

                  return (
                    <TableRow {...getRowProps({ row })} key={row.id}>
                      <TableCell>{originalRow.vmName}</TableCell>
                      <TableCell>{originalRow.cluster}</TableCell>
                      <TableCell>{originalRow.cpus}</TableCell>
                      <TableCell>{originalRow.memoryGiB} GiB</TableCell>
                      <TableCell>{originalRow.storageGiB} GiB</TableCell>
                      <TableCell>
                        <Tag type="cyan" size="sm">{originalRow.customWorkload}</Tag>
                      </TableCell>
                      <TableCell>
                        {originalRow.notes ? (
                          <span className="custom-workload-table__notes">{originalRow.notes}</span>
                        ) : (
                          <span className="custom-workload-table__no-notes">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>

      {/* Pagination */}
      <div className="custom-workload-table__pagination">
        <div className="custom-workload-table__pagination-info">
          <Tag type="gray" size="sm">
            {formatNumber(filteredRows.length)} VMs
          </Tag>
          {(searchTerm || selectedType) && (
            <Tag type="cyan" size="sm">
              Filtered from {formatNumber(customWorkloadVMs.length)}
            </Tag>
          )}
        </div>
        <Pagination
          page={page}
          pageSize={pageSize}
          pageSizes={[10, 25, 50, 100]}
          totalItems={filteredRows.length}
          onChange={({ page: newPage, pageSize: newPageSize }) => {
            setPage(newPage);
            setPageSize(newPageSize);
          }}
          itemsPerPageText="Items per page:"
        />
      </div>
    </div>
  );
}

export default CustomWorkloadTable;
