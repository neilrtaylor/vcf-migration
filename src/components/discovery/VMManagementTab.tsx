/**
 * VMManagementTab Component
 *
 * Full VM listing with the ability to:
 * - View auto-excluded VMs (templates, powered-off, VMware infrastructure)
 * - Override auto-exclusions (force-include)
 * - Exclude/include VMs from migration scope
 * - Override auto-detected workload types
 * - Add user notes per VM
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
  TableSelectAll,
  TableSelectRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  TableBatchActions,
  TableBatchAction,
  Tag,
  Button,
  InlineNotification,
  OverflowMenu,
  OverflowMenuItem,
  Modal,
  TextArea,
  ComboBox,
  Pagination,
  Tile,
  Grid,
  Column,
  Tooltip,
  Dropdown,
} from '@carbon/react';
import {
  Download,
  Upload,
  ViewOff,
  View,
  DocumentExport,
  Reset,
} from '@carbon/icons-react';
import type { VirtualMachine } from '@/types/rvtools';
import type { UseVMOverridesReturn } from '@/hooks/useVMOverrides';
import type { AutoExclusionResult } from '@/utils/autoExclusion';
import { NO_AUTO_EXCLUSION } from '@/utils/autoExclusion';
import { getVMIdentifier } from '@/utils/vmIdentifier';
import { formatNumber, mibToGiB } from '@/utils/formatters';
import workloadPatterns from '@/data/workloadPatterns.json';
import './VMManagementTab.scss';

// ===== TYPES =====

interface VMManagementTabProps {
  vms: VirtualMachine[];
  vmOverrides: UseVMOverridesReturn;
  autoExclusionMap: Map<string, AutoExclusionResult>;
  poweredOnOnly?: boolean;
}

type ExclusionSource = 'auto' | 'manual' | 'none';
type FilterOption = 'all' | 'included' | 'auto-excluded' | 'manually-excluded' | 'overridden';

interface VMRow {
  id: string;
  vmName: string;
  cluster: string;
  datacenter: string;
  powerState: string;
  cpus: number;
  memoryGiB: number;
  storageGiB: number;
  guestOS: string;
  detectedWorkload: string | null;
  effectiveWorkload: string;
  isAutoExcluded: boolean;
  autoExclusionLabels: string[];
  isForceIncluded: boolean;
  isManuallyExcluded: boolean;
  isEffectivelyExcluded: boolean;
  exclusionSource: ExclusionSource;
  hasNotes: boolean;
  notes: string;
}

// ===== WORKLOAD DETECTION =====

function detectWorkload(vm: VirtualMachine): string | null {
  const vmNameLower = vm.vmName.toLowerCase();
  const annotationLower = (vm.annotation || '').toLowerCase();
  const categories = workloadPatterns.categories as Record<string, { name: string; patterns: string[] }>;

  for (const [, category] of Object.entries(categories)) {
    for (const pattern of category.patterns) {
      if (vmNameLower.includes(pattern) || annotationLower.includes(pattern)) {
        return category.name;
      }
    }
  }
  return null;
}

// Get all workload category names for dropdown
function getWorkloadCategories(): Array<{ id: string; text: string }> {
  const categories = workloadPatterns.categories as Record<string, { name: string; patterns: string[] }>;
  const items = Object.entries(categories).map(([key, cat]) => ({
    id: key,
    text: cat.name,
  }));
  // Add "Unclassified" option to clear auto-detection
  items.unshift({ id: 'unclassified', text: 'Unclassified' });
  return items;
}

// Filter options for the dropdown
const FILTER_OPTIONS: Array<{ id: FilterOption; text: string }> = [
  { id: 'all', text: 'All VMs' },
  { id: 'included', text: 'Included' },
  { id: 'auto-excluded', text: 'Auto-Excluded' },
  { id: 'manually-excluded', text: 'Manually Excluded' },
  { id: 'overridden', text: 'Overridden' },
];

// ===== COMPONENT =====

export function VMManagementTab({ vms, vmOverrides, autoExclusionMap, poweredOnOnly = false }: VMManagementTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState<FilterOption>('all');
  const [editingNotes, setEditingNotes] = useState<{ vmId: string; vmName: string; notes: string } | null>(null);
  const [editingWorkload, setEditingWorkload] = useState<{ vmId: string; vmName: string; current: string | undefined } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const workloadCategories = useMemo(() => getWorkloadCategories(), []);

  // Build VM rows with auto-exclusion data
  const vmRows = useMemo((): VMRow[] => {
    const filtered = poweredOnOnly ? vms.filter(vm => vm.powerState === 'poweredOn') : vms;

    return filtered.map(vm => {
      const vmId = getVMIdentifier(vm);
      const detected = detectWorkload(vm);
      const overrideWorkload = vmOverrides.getWorkloadType(vmId);
      const notes = vmOverrides.getNotes(vmId) || '';
      const autoResult = autoExclusionMap.get(vmId) ?? NO_AUTO_EXCLUSION;
      const isForceIncluded = vmOverrides.isForceIncluded(vmId);
      const isManuallyExcluded = vmOverrides.isExcluded(vmId);
      const isEffectivelyExcluded = vmOverrides.isEffectivelyExcluded(vmId, autoResult.isAutoExcluded);

      let exclusionSource: ExclusionSource = 'none';
      if (isManuallyExcluded && !isForceIncluded) {
        exclusionSource = 'manual';
      } else if (autoResult.isAutoExcluded && !isForceIncluded) {
        exclusionSource = 'auto';
      }

      return {
        id: vmId,
        vmName: vm.vmName,
        cluster: vm.cluster,
        datacenter: vm.datacenter,
        powerState: vm.powerState,
        cpus: vm.cpus,
        memoryGiB: Math.round(mibToGiB(vm.memory)),
        storageGiB: Math.round(mibToGiB(vm.provisionedMiB)),
        guestOS: vm.guestOS || 'Unknown',
        detectedWorkload: detected,
        effectiveWorkload: overrideWorkload || detected || 'Unclassified',
        isAutoExcluded: autoResult.isAutoExcluded,
        autoExclusionLabels: autoResult.labels,
        isForceIncluded,
        isManuallyExcluded,
        isEffectivelyExcluded,
        exclusionSource,
        hasNotes: notes.length > 0,
        notes,
      };
    });
  }, [vms, poweredOnOnly, vmOverrides, autoExclusionMap]);

  // Apply status filter
  const statusFilteredRows = useMemo(() => {
    switch (statusFilter) {
      case 'included':
        return vmRows.filter(r => !r.isEffectivelyExcluded);
      case 'auto-excluded':
        return vmRows.filter(r => r.isAutoExcluded && !r.isForceIncluded);
      case 'manually-excluded':
        return vmRows.filter(r => r.isManuallyExcluded && !r.isAutoExcluded);
      case 'overridden':
        return vmRows.filter(r => r.isForceIncluded);
      default:
        return vmRows;
    }
  }, [vmRows, statusFilter]);

  // Filter by search term
  const filteredRows = useMemo(() => {
    if (!searchTerm) return statusFilteredRows;
    const term = searchTerm.toLowerCase();
    return statusFilteredRows.filter(row =>
      row.vmName.toLowerCase().includes(term) ||
      row.cluster.toLowerCase().includes(term) ||
      row.datacenter.toLowerCase().includes(term) ||
      row.guestOS.toLowerCase().includes(term) ||
      row.effectiveWorkload.toLowerCase().includes(term) ||
      row.notes.toLowerCase().includes(term) ||
      row.autoExclusionLabels.some(l => l.toLowerCase().includes(term))
    );
  }, [statusFilteredRows, searchTerm]);

  // Paginate
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  // Stats
  const includedCount = vmRows.filter(r => !r.isEffectivelyExcluded).length;
  const autoExcludedCount = vmRows.filter(r => r.isAutoExcluded && !r.isForceIncluded).length;
  const manuallyExcludedCount = vmRows.filter(r => r.isManuallyExcluded && !r.isAutoExcluded).length;
  const overriddenCount = vmRows.filter(r => r.isForceIncluded).length;

  // Auto-exclusion breakdown
  const autoExcludedBreakdown = useMemo(() => {
    const breakdown = { templates: 0, poweredOff: 0, vmwareInfra: 0, windowsInfra: 0 };
    for (const row of vmRows) {
      if (row.isAutoExcluded && !row.isForceIncluded) {
        if (row.autoExclusionLabels.includes('Template')) breakdown.templates++;
        if (row.autoExclusionLabels.includes('Powered Off')) breakdown.poweredOff++;
        if (row.autoExclusionLabels.includes('VMware Infrastructure')) breakdown.vmwareInfra++;
        if (row.autoExclusionLabels.includes('Windows AD/DNS')) breakdown.windowsInfra++;
      }
    }
    return breakdown;
  }, [vmRows]);

  // ===== ACTIONS =====

  const handleBulkExclude = useCallback((selectedRows: Array<{ id: string }>) => {
    const toExclude = selectedRows.map(row => {
      const vmRow = vmRows.find(r => r.id === row.id);
      return { vmId: row.id, vmName: vmRow?.vmName || '' };
    });
    vmOverrides.bulkSetExcluded(toExclude, true);
  }, [vmRows, vmOverrides]);

  const handleBulkInclude = useCallback((selectedRows: Array<{ id: string }>) => {
    const toInclude = selectedRows.map(row => {
      const vmRow = vmRows.find(r => r.id === row.id);
      return { vmId: row.id, vmName: vmRow?.vmName || '' };
    });
    // For auto-excluded VMs, use forceInclude; for manually excluded, use setExcluded(false)
    const autoExcludedVMs = toInclude.filter(vm => {
      const vmRow = vmRows.find(r => r.id === vm.vmId);
      return vmRow?.isAutoExcluded;
    });
    const manuallyExcludedVMs = toInclude.filter(vm => {
      const vmRow = vmRows.find(r => r.id === vm.vmId);
      return !vmRow?.isAutoExcluded;
    });
    if (autoExcludedVMs.length > 0) {
      vmOverrides.bulkSetForceIncluded(autoExcludedVMs, true);
    }
    if (manuallyExcludedVMs.length > 0) {
      vmOverrides.bulkSetExcluded(manuallyExcludedVMs, false);
    }
  }, [vmRows, vmOverrides]);

  const handleToggleExclusion = useCallback((row: VMRow) => {
    if (row.isAutoExcluded && !row.isForceIncluded) {
      // Auto-excluded VM: force-include it
      vmOverrides.setForceIncluded(row.id, row.vmName, true);
    } else if (row.isForceIncluded) {
      // Force-included VM: revert to auto-excluded
      vmOverrides.setForceIncluded(row.id, row.vmName, false);
    } else if (row.isManuallyExcluded) {
      // Manually excluded: include
      vmOverrides.setExcluded(row.id, row.vmName, false);
    } else {
      // Normal included: exclude
      vmOverrides.setExcluded(row.id, row.vmName, true);
    }
  }, [vmOverrides]);

  const handleEditNotes = useCallback((row: VMRow) => {
    setEditingNotes({ vmId: row.id, vmName: row.vmName, notes: row.notes });
  }, []);

  const handleSaveNotes = useCallback(() => {
    if (editingNotes) {
      vmOverrides.setNotes(editingNotes.vmId, editingNotes.vmName, editingNotes.notes || undefined);
      setEditingNotes(null);
    }
  }, [editingNotes, vmOverrides]);

  const handleEditWorkload = useCallback((row: VMRow) => {
    setEditingWorkload({
      vmId: row.id,
      vmName: row.vmName,
      current: vmOverrides.getWorkloadType(row.id) || row.detectedWorkload || undefined,
    });
  }, [vmOverrides]);

  const handleSaveWorkload = useCallback((item: { id: string; text: string } | string | null | undefined) => {
    if (editingWorkload) {
      const text = typeof item === 'string' ? item : item?.text;
      const id = typeof item === 'string' ? 'custom' : item?.id;

      if (text && id !== 'unclassified') {
        vmOverrides.setWorkloadType(editingWorkload.vmId, editingWorkload.vmName, text);
      } else {
        vmOverrides.setWorkloadType(editingWorkload.vmId, editingWorkload.vmName, undefined);
      }
      setEditingWorkload(null);
    }
  }, [editingWorkload, vmOverrides]);

  const handleExportSettings = useCallback(() => {
    const json = vmOverrides.exportSettings();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vm-overrides.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [vmOverrides]);

  const handleImportSettings = useCallback(() => {
    setImportError(null);
    if (!importJson.trim()) {
      setImportError('Please paste valid JSON');
      return;
    }
    const success = vmOverrides.importSettings(importJson);
    if (success) {
      setShowImportModal(false);
      setImportJson('');
    } else {
      setImportError('Invalid JSON format');
    }
  }, [importJson, vmOverrides]);

  const handleExportCSV = useCallback(() => {
    const headers = ['VM Name', 'Cluster', 'Datacenter', 'Power State', 'vCPUs', 'Memory (GiB)', 'Storage (GiB)', 'Guest OS', 'Workload Type', 'Status', 'Auto-Exclusion Reasons', 'Notes'];
    const rows = filteredRows.map(row => [
      row.vmName,
      row.cluster,
      row.datacenter,
      row.powerState,
      row.cpus.toString(),
      row.memoryGiB.toString(),
      row.storageGiB.toString(),
      row.guestOS,
      row.effectiveWorkload,
      row.isEffectivelyExcluded ? (row.exclusionSource === 'auto' ? 'Auto-Excluded' : 'Excluded') : (row.isForceIncluded ? 'Included (Override)' : 'Included'),
      row.autoExclusionLabels.join('; '),
      row.notes,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vm-inventory.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredRows]);

  // Helper to get the action menu text for a row
  function getActionText(row: VMRow): string {
    if (row.isAutoExcluded && !row.isForceIncluded) {
      return 'Include in Migration';
    }
    if (row.isForceIncluded) {
      return 'Revert to Auto-Excluded';
    }
    if (row.isManuallyExcluded) {
      return 'Include in Migration';
    }
    return 'Exclude from Migration';
  }

  // ===== RENDER =====

  const headers = [
    { key: 'vmName', header: 'VM Name' },
    { key: 'cluster', header: 'Cluster' },
    { key: 'cpus', header: 'vCPUs' },
    { key: 'memoryGiB', header: 'Memory' },
    { key: 'storageGiB', header: 'Storage' },
    { key: 'effectiveWorkload', header: 'Workload Type' },
    { key: 'status', header: 'Migration Status' },
    { key: 'notes', header: 'Notes' },
    { key: 'actions', header: '' },
  ];

  // Render status tags for a row
  function renderStatusTags(row: VMRow) {
    if (row.isForceIncluded) {
      // Force-included: show green Included + outline Override tag
      return (
        <span style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          <Tag type="green" size="sm">Included</Tag>
          <Tag type="outline" size="sm">Override</Tag>
        </span>
      );
    }
    if (row.isAutoExcluded) {
      // Auto-excluded: show Auto-Excluded tag + magenta tags per reason
      return (
        <span style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          <Tag type="red" size="sm">Auto-Excluded</Tag>
          {row.autoExclusionLabels.map(label => (
            <Tag key={label} type="magenta" size="sm">{label}</Tag>
          ))}
        </span>
      );
    }
    if (row.isManuallyExcluded) {
      return <Tag type="gray" size="sm">Excluded</Tag>;
    }
    return <Tag type="green" size="sm">Included</Tag>;
  }

  return (
    <div className="vm-management-tab">
      {/* Environment mismatch warning */}
      {vmOverrides.environmentMismatch && (
        <div className="vm-management-tab__mismatch-warning">
          <InlineNotification
            kind="warning"
            title="VM overrides from a different environment were found."
            subtitle="These overrides may not match the current RVTools data."
            lowContrast
            hideCloseButton
          />
          <div className="vm-management-tab__mismatch-actions">
            <Button size="sm" kind="tertiary" onClick={vmOverrides.applyMismatchedOverrides}>
              Apply Anyway
            </Button>
            <Button size="sm" kind="ghost" onClick={vmOverrides.clearAndReset}>
              Clear Overrides
            </Button>
          </div>
        </div>
      )}

      {/* Summary tiles */}
      <Grid className="vm-management-tab__summary" narrow>
        <Column lg={3} md={2} sm={2}>
          <Tile className="vm-management-tab__summary-tile">
            <span className="vm-management-tab__summary-label">Included</span>
            <span className="vm-management-tab__summary-value vm-management-tab__summary-value--included">
              {formatNumber(includedCount)}
            </span>
          </Tile>
        </Column>
        <Column lg={3} md={2} sm={2}>
          <Tooltip label={`Templates: ${autoExcludedBreakdown.templates}, Powered Off: ${autoExcludedBreakdown.poweredOff}, VMware Infra: ${autoExcludedBreakdown.vmwareInfra}, Windows AD/DNS: ${autoExcludedBreakdown.windowsInfra}`} align="bottom">
            <Tile className="vm-management-tab__summary-tile">
              <span className="vm-management-tab__summary-label">Auto-Excluded</span>
              <span className="vm-management-tab__summary-value vm-management-tab__summary-value--auto-excluded">
                {formatNumber(autoExcludedCount)}
              </span>
            </Tile>
          </Tooltip>
        </Column>
        <Column lg={3} md={2} sm={2}>
          <Tile className="vm-management-tab__summary-tile">
            <span className="vm-management-tab__summary-label">Manually Excluded</span>
            <span className="vm-management-tab__summary-value vm-management-tab__summary-value--excluded">
              {formatNumber(manuallyExcludedCount)}
            </span>
          </Tile>
        </Column>
        <Column lg={3} md={2} sm={2}>
          <Tile className="vm-management-tab__summary-tile">
            <span className="vm-management-tab__summary-label">Overridden</span>
            <span className="vm-management-tab__summary-value">
              {formatNumber(overriddenCount)}
            </span>
          </Tile>
        </Column>
        <Column lg={4} md={2} sm={2}>
          <Tile className="vm-management-tab__summary-tile vm-management-tab__summary-tile--actions">
            <Button size="sm" kind="ghost" renderIcon={Download} onClick={handleExportSettings}>
              Export
            </Button>
            <Button size="sm" kind="ghost" renderIcon={Upload} onClick={() => setShowImportModal(true)}>
              Import
            </Button>
          </Tile>
        </Column>
      </Grid>

      {/* Data Table */}
      <DataTable
        rows={paginatedRows}
        headers={headers}
        isSortable
      >
        {({
          rows,
          headers,
          getHeaderProps,
          getRowProps,
          getSelectionProps,
          getTableProps,
          getTableContainerProps,
          getBatchActionProps,
          selectedRows,
        }) => {
          const batchActionProps = getBatchActionProps();

          return (
            <TableContainer {...getTableContainerProps()}>
              <TableToolbar>
                <TableBatchActions {...batchActionProps}>
                  <TableBatchAction
                    tabIndex={batchActionProps.shouldShowBatchActions ? 0 : -1}
                    renderIcon={ViewOff}
                    onClick={() => handleBulkExclude(selectedRows)}
                  >
                    Exclude from Migration
                  </TableBatchAction>
                  <TableBatchAction
                    tabIndex={batchActionProps.shouldShowBatchActions ? 0 : -1}
                    renderIcon={View}
                    onClick={() => handleBulkInclude(selectedRows)}
                  >
                    Include in Migration
                  </TableBatchAction>
                </TableBatchActions>
                <TableToolbarContent>
                  <TableToolbarSearch
                    placeholder="Search VMs..."
                    onChange={(e) => {
                      const value = typeof e === 'string' ? e : e.target.value;
                      setSearchTerm(value);
                      setPage(1);
                    }}
                    value={searchTerm}
                    persistent
                  />
                  <Dropdown
                    id="status-filter"
                    titleText=""
                    label="Filter"
                    items={FILTER_OPTIONS}
                    itemToString={(item) => item?.text || ''}
                    selectedItem={FILTER_OPTIONS.find(o => o.id === statusFilter) || FILTER_OPTIONS[0]}
                    onChange={({ selectedItem }) => {
                      setStatusFilter(selectedItem?.id || 'all');
                      setPage(1);
                    }}
                    size="sm"
                    className="vm-management-tab__status-filter"
                  />
                  <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={DocumentExport}
                    onClick={handleExportCSV}
                    hasIconOnly
                    iconDescription="Export to CSV"
                  />
                  {vmOverrides.overrideCount > 0 && (
                    <Button
                      kind="ghost"
                      size="sm"
                      renderIcon={Reset}
                      onClick={vmOverrides.clearAllOverrides}
                      hasIconOnly
                      iconDescription="Clear all overrides"
                    />
                  )}
                </TableToolbarContent>
              </TableToolbar>

              <Table {...getTableProps()} size="md">
                <TableHead>
                  <TableRow>
                    <TableSelectAll {...getSelectionProps()} />
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

                    const rowClassName = originalRow.isEffectivelyExcluded
                      ? 'vm-management-tab__row--excluded'
                      : originalRow.isForceIncluded
                        ? 'vm-management-tab__row--overridden'
                        : '';

                    return (
                      <TableRow
                        {...getRowProps({ row })}
                        key={row.id}
                        className={rowClassName}
                      >
                        <TableSelectRow {...getSelectionProps({ row })} />
                        <TableCell>{originalRow.vmName}</TableCell>
                        <TableCell>{originalRow.cluster}</TableCell>
                        <TableCell>{originalRow.cpus}</TableCell>
                        <TableCell>{originalRow.memoryGiB} GiB</TableCell>
                        <TableCell>{originalRow.storageGiB} GiB</TableCell>
                        <TableCell>
                          {vmOverrides.getWorkloadType(originalRow.id) ? (
                            <Tooltip label="Workload type override">
                              <Tag type="blue" size="sm">
                                {originalRow.effectiveWorkload}
                              </Tag>
                            </Tooltip>
                          ) : originalRow.detectedWorkload ? (
                            <Tag type="gray" size="sm">
                              {originalRow.effectiveWorkload}
                            </Tag>
                          ) : (
                            <span className="vm-management-tab__unclassified">
                              Unclassified
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {renderStatusTags(originalRow)}
                        </TableCell>
                        <TableCell>
                          {originalRow.hasNotes && (
                            <Tooltip label={originalRow.notes}>
                              <Tag type="outline" size="sm">Has Notes</Tag>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell>
                          <OverflowMenu size="sm" flipped iconDescription="Actions">
                            <OverflowMenuItem
                              itemText={getActionText(originalRow)}
                              onClick={() => handleToggleExclusion(originalRow)}
                            />
                            <OverflowMenuItem
                              itemText="Edit Workload Type"
                              onClick={() => handleEditWorkload(originalRow)}
                            />
                            <OverflowMenuItem
                              itemText={originalRow.hasNotes ? 'Edit Notes' : 'Add Notes'}
                              onClick={() => handleEditNotes(originalRow)}
                            />
                            {vmOverrides.hasOverride(originalRow.id) && (
                              <OverflowMenuItem
                                itemText="Clear All Overrides"
                                isDelete
                                onClick={() => vmOverrides.removeOverride(originalRow.id)}
                              />
                            )}
                          </OverflowMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          );
        }}
      </DataTable>

      {/* Pagination */}
      <div className="vm-management-tab__pagination">
        <div className="vm-management-tab__pagination-info">
          <Tag type="gray" size="sm">
            {formatNumber(filteredRows.length)} VMs
          </Tag>
          {(searchTerm || statusFilter !== 'all') && (
            <Tag type="blue" size="sm">
              Filtered from {formatNumber(vmRows.length)}
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
          itemsPerPageText="VMs per page:"
        />
      </div>

      {/* Edit Notes Modal */}
      <Modal
        open={!!editingNotes}
        onRequestClose={() => setEditingNotes(null)}
        onRequestSubmit={handleSaveNotes}
        modalHeading={`Notes for ${editingNotes?.vmName || ''}`}
        primaryButtonText="Save"
        secondaryButtonText="Cancel"
        size="sm"
      >
        <TextArea
          id="vm-notes"
          labelText="Notes"
          placeholder="Add notes about this VM..."
          value={editingNotes?.notes || ''}
          onChange={(e) => setEditingNotes(prev => prev ? { ...prev, notes: e.target.value } : null)}
          rows={4}
        />
      </Modal>

      {/* Edit Workload Modal */}
      <Modal
        open={!!editingWorkload}
        onRequestClose={() => setEditingWorkload(null)}
        modalHeading={`Workload Type for ${editingWorkload?.vmName || ''}`}
        passiveModal
        size="sm"
      >
        <p className="vm-management-tab__modal-description">
          Select a predefined workload type, type a custom name, or choose "Unclassified" to clear.
        </p>
        <ComboBox
          id="workload-type"
          key={editingWorkload?.vmId || 'workload-combobox'}
          titleText="Workload Type"
          placeholder="Select or type custom workload..."
          items={workloadCategories}
          itemToString={(item) => (typeof item === 'string' ? item : item?.text) || ''}
          initialSelectedItem={
            editingWorkload?.current
              ? workloadCategories.find(c => c.text === editingWorkload.current) || { id: 'custom', text: editingWorkload.current }
              : null
          }
          allowCustomValue
          onChange={({ selectedItem, inputValue }) => {
            if (inputValue && !selectedItem) {
              handleSaveWorkload({ id: 'custom', text: inputValue });
            } else {
              handleSaveWorkload(selectedItem);
            }
          }}
        />
      </Modal>

      {/* Import Settings Modal */}
      <Modal
        open={showImportModal}
        onRequestClose={() => {
          setShowImportModal(false);
          setImportJson('');
          setImportError(null);
        }}
        onRequestSubmit={handleImportSettings}
        modalHeading="Import VM Overrides"
        primaryButtonText="Import"
        secondaryButtonText="Cancel"
        size="md"
      >
        <p className="vm-management-tab__modal-description">
          Paste the JSON from a previously exported settings file.
        </p>
        <TextArea
          id="import-json"
          labelText="Settings JSON"
          placeholder='{"version":2,"overrides":{}...}'
          value={importJson}
          onChange={(e) => setImportJson(e.target.value)}
          rows={10}
          invalid={!!importError}
          invalidText={importError || ''}
        />
      </Modal>
    </div>
  );
}

export default VMManagementTab;
