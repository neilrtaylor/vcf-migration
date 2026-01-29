/**
 * DiscoveryVMTable Component
 *
 * Unified VM table that merges the functionality of VMManagementTab and WorkloadVMTable
 * into a single table. Shows ALL VMs with:
 * - Category filter bar (clickable tiles synced with chart)
 * - Status filter (Included / Auto-Excluded / Manually Excluded / Overridden)
 * - Category column with source indicator (User / AI / Rule)
 * - Migration status column (Included / Excluded / Auto-Excluded)
 * - Inline actions: toggle exclusion, edit workload type, edit notes
 * - Bulk exclude/include
 * - CSV export, JSON export/import of overrides
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
  ClickableTile,
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
  Close,
} from '@carbon/icons-react';
import type { VirtualMachine } from '@/types/rvtools';
import type { UseVMOverridesReturn } from '@/hooks/useVMOverrides';
import type { AutoExclusionResult } from '@/utils/autoExclusion';
import { NO_AUTO_EXCLUSION } from '@/utils/autoExclusion';
import { getVMIdentifier } from '@/utils/vmIdentifier';
import { formatNumber, mibToGiB } from '@/utils/formatters';
import type { VMClassificationResult } from '@/services/ai/types';
import type { WorkloadMatch } from './WorkloadVMTable';
import workloadPatterns from '@/data/workloadPatterns.json';
import './DiscoveryVMTable.scss';

// ===== TYPES =====

interface DiscoveryVMTableProps {
  vms: VirtualMachine[];
  workloadMatches: WorkloadMatch[];
  vmOverrides: UseVMOverridesReturn;
  autoExclusionMap: Map<string, AutoExclusionResult>;
  aiClassifications?: Record<string, VMClassificationResult>;
  selectedCategory: string | null;
  onCategorySelect: (key: string | null) => void;
  workloadsByCategory: Record<string, { name: string; vms: Set<string> }>;
}

type FilterOption = 'all' | 'included' | 'auto-excluded' | 'manually-excluded' | 'overridden';

interface VMRow {
  id: string;
  vmName: string;
  cluster: string;
  powerState: string;
  cpus: number;
  memoryGiB: number;
  storageGiB: number;
  guestOS: string;
  // Category info
  category: string;       // category key or '_custom' or '_unclassified'
  categoryName: string;   // display name
  categorySource: 'user' | 'maintainer' | 'ai' | 'name' | 'annotation' | 'none';
  matchedPattern: string;
  // Exclusion info
  isAutoExcluded: boolean;
  autoExclusionLabels: string[];
  isForceIncluded: boolean;
  isManuallyExcluded: boolean;
  isEffectivelyExcluded: boolean;
  exclusionSource: 'auto' | 'manual' | 'none';
  hasNotes: boolean;
  notes: string;
}

// ===== HELPERS =====

function getWorkloadCategories(): Array<{ id: string; text: string }> {
  const categories = workloadPatterns.categories as Record<string, { name: string; patterns: string[] }>;
  const items = Object.entries(categories).map(([key, cat]) => ({
    id: key,
    text: cat.name,
  }));
  items.unshift({ id: 'unclassified', text: 'Unclassified' });
  return items;
}

const FILTER_OPTIONS: Array<{ id: FilterOption; text: string }> = [
  { id: 'all', text: 'All VMs' },
  { id: 'included', text: 'Included' },
  { id: 'auto-excluded', text: 'Auto-Excluded' },
  { id: 'manually-excluded', text: 'Manually Excluded' },
  { id: 'overridden', text: 'Overridden' },
];

// ===== COMPONENT =====

export function DiscoveryVMTable({
  vms,
  workloadMatches,
  vmOverrides,
  autoExclusionMap,
  aiClassifications,
  selectedCategory,
  onCategorySelect,
  workloadsByCategory,
}: DiscoveryVMTableProps) {
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

  // Build a lookup: vmName → WorkloadMatch
  const vmCategoryMap = useMemo(() => {
    const map = new Map<string, WorkloadMatch>();
    for (const match of workloadMatches) {
      if (!map.has(match.vmName)) {
        map.set(match.vmName, match);
      }
    }
    return map;
  }, [workloadMatches]);

  // Build VM rows with category + exclusion data
  const vmRows = useMemo((): VMRow[] => {
    return vms.map(vm => {
      const vmId = getVMIdentifier(vm);
      const notes = vmOverrides.getNotes(vmId) || '';
      const autoResult = autoExclusionMap.get(vmId) ?? NO_AUTO_EXCLUSION;
      const isForceIncluded = vmOverrides.isForceIncluded(vmId);
      const isManuallyExcluded = vmOverrides.isExcluded(vmId);
      const isEffectivelyExcluded = vmOverrides.isEffectivelyExcluded(vmId, autoResult.isAutoExcluded);

      let exclusionSource: 'auto' | 'manual' | 'none' = 'none';
      if (isManuallyExcluded && !isForceIncluded) {
        exclusionSource = 'manual';
      } else if (autoResult.isAutoExcluded && !isForceIncluded) {
        exclusionSource = 'auto';
      }

      // Category lookup
      const match = vmCategoryMap.get(vm.vmName);
      const category = match?.category ?? '_unclassified';
      const categoryName = match ? match.categoryName : 'Unclassified';
      const categorySource = match?.source ?? 'none';
      const matchedPattern = match?.matchedPattern ?? '';

      return {
        id: vmId,
        vmName: vm.vmName,
        cluster: vm.cluster,
        powerState: vm.powerState,
        cpus: vm.cpus,
        memoryGiB: Math.round(mibToGiB(vm.memory)),
        storageGiB: Math.round(mibToGiB(vm.provisionedMiB)),
        guestOS: vm.guestOS || 'Unknown',
        category,
        categoryName,
        categorySource,
        matchedPattern,
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
  }, [vms, vmOverrides, autoExclusionMap, vmCategoryMap]);

  // Apply category filter
  const categoryFilteredRows = useMemo(() => {
    if (!selectedCategory) return vmRows;
    if (selectedCategory === '_unclassified') {
      return vmRows.filter(r => r.category === '_unclassified');
    }
    return vmRows.filter(r => r.category === selectedCategory);
  }, [vmRows, selectedCategory]);

  // Apply status filter
  const statusFilteredRows = useMemo(() => {
    switch (statusFilter) {
      case 'included':
        return categoryFilteredRows.filter(r => !r.isEffectivelyExcluded);
      case 'auto-excluded':
        return categoryFilteredRows.filter(r => r.isAutoExcluded && !r.isForceIncluded);
      case 'manually-excluded':
        return categoryFilteredRows.filter(r => r.isManuallyExcluded && !r.isAutoExcluded);
      case 'overridden':
        return categoryFilteredRows.filter(r => r.isForceIncluded);
      default:
        return categoryFilteredRows;
    }
  }, [categoryFilteredRows, statusFilter]);

  // Filter by search term
  const filteredRows = useMemo(() => {
    if (!searchTerm) return statusFilteredRows;
    const term = searchTerm.toLowerCase();
    return statusFilteredRows.filter(row =>
      row.vmName.toLowerCase().includes(term) ||
      row.cluster.toLowerCase().includes(term) ||
      row.guestOS.toLowerCase().includes(term) ||
      row.categoryName.toLowerCase().includes(term) ||
      row.notes.toLowerCase().includes(term) ||
      row.autoExclusionLabels.some(l => l.toLowerCase().includes(term))
    );
  }, [statusFilteredRows, searchTerm]);

  // Paginate
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  // Count unclassified for the filter bar
  const unclassifiedCount = useMemo(() => {
    return vmRows.filter(r => r.category === '_unclassified').length;
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
      vmOverrides.setForceIncluded(row.id, row.vmName, true);
    } else if (row.isForceIncluded) {
      vmOverrides.setForceIncluded(row.id, row.vmName, false);
    } else if (row.isManuallyExcluded) {
      vmOverrides.setExcluded(row.id, row.vmName, false);
    } else {
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
      current: vmOverrides.getWorkloadType(row.id) || (row.categorySource !== 'none' ? row.categoryName : undefined),
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
    const headers = ['VM Name', 'Cluster', 'Power State', 'vCPUs', 'Memory (GiB)', 'Storage (GiB)', 'Guest OS', 'Workload Type', 'Source', 'Status', 'Auto-Exclusion Reasons', 'Notes'];
    const rows = filteredRows.map(row => [
      row.vmName,
      row.cluster,
      row.powerState,
      row.cpus.toString(),
      row.memoryGiB.toString(),
      row.storageGiB.toString(),
      row.guestOS,
      row.categoryName,
      row.categorySource === 'user' ? 'User Override'
        : row.categorySource === 'maintainer' ? 'Maintainer'
        : row.categorySource === 'ai' ? 'AI'
        : row.categorySource === 'name' ? 'VM Name'
        : row.categorySource === 'annotation' ? 'Annotation'
        : '',
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
    a.download = 'vm-discovery.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredRows]);

  function getActionText(row: VMRow): string {
    if (row.isAutoExcluded && !row.isForceIncluded) return 'Include in Migration';
    if (row.isForceIncluded) return 'Revert to Auto-Excluded';
    if (row.isManuallyExcluded) return 'Include in Migration';
    return 'Exclude from Migration';
  }

  // ===== RENDER HELPERS =====

  function renderStatusTags(row: VMRow) {
    if (row.isForceIncluded) {
      return (
        <span style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          <Tag type="green" size="sm">Included</Tag>
          <Tag type="outline" size="sm">Override</Tag>
        </span>
      );
    }
    if (row.isAutoExcluded) {
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

  function renderCategoryCell(row: VMRow) {
    if (row.category === '_unclassified') {
      return (
        <span className="discovery-vm-table__unclassified">
          Unclassified
        </span>
      );
    }

    const aiResult = aiClassifications?.[row.vmName];
    const hasAI = aiResult?.source === 'ai';
    const isUserSource = row.categorySource === 'user';
    const isMaintainerSource = row.categorySource === 'maintainer';
    const isAISource = row.categorySource === 'ai';

    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
        <Tag type="blue" size="sm">{row.categoryName}</Tag>
        {isUserSource && (
          <Tag type="cyan" size="sm">User</Tag>
        )}
        {isMaintainerSource && (
          <Tooltip label={row.matchedPattern || 'Maintainer-defined classification'} align="bottom">
            <button type="button" style={{ all: 'unset', cursor: 'help' }}>
              <Tag type="teal" size="sm">Maintainer</Tag>
            </button>
          </Tooltip>
        )}
        {isAISource && hasAI && (
          <Tooltip label={aiResult.reasoning || 'AI-classified workload'} align="bottom">
            <button type="button" style={{ all: 'unset', cursor: 'help' }}>
              <Tag type="purple" size="sm">AI {Math.round(aiResult.confidence * 100)}%</Tag>
            </button>
          </Tooltip>
        )}
        {!isUserSource && !isMaintainerSource && !isAISource && hasAI && aiResult.workloadType &&
          aiResult.workloadType.toLowerCase() !== row.categoryName.toLowerCase() && (
          <Tooltip label={`AI suggests: ${aiResult.workloadType}. ${aiResult.reasoning || ''}`} align="bottom">
            <button type="button" style={{ all: 'unset', cursor: 'help' }}>
              <Tag type="purple" size="sm">AI: {aiResult.workloadType}</Tag>
            </button>
          </Tooltip>
        )}
      </span>
    );
  }

  // Sort categories by count for filter bar
  const sortedCategories = useMemo(() => {
    return Object.entries(workloadsByCategory)
      .sort((a, b) => b[1].vms.size - a[1].vms.size);
  }, [workloadsByCategory]);

  const headers = [
    { key: 'vmName', header: 'VM Name' },
    { key: 'cluster', header: 'Cluster' },
    { key: 'cpus', header: 'vCPUs' },
    { key: 'memoryGiB', header: 'Memory' },
    { key: 'storageGiB', header: 'Storage' },
    { key: 'category', header: 'Workload Type' },
    { key: 'status', header: 'Status' },
    { key: 'notes', header: 'Notes' },
    { key: 'actions', header: '' },
  ];

  return (
    <div className="discovery-vm-table">
      {/* Environment mismatch warning */}
      {vmOverrides.environmentMismatch && (
        <div className="discovery-vm-table__mismatch-warning">
          <InlineNotification
            kind="warning"
            title="VM overrides from a different environment were found."
            subtitle="These overrides may not match the current RVTools data."
            lowContrast
            hideCloseButton
          />
          <div className="discovery-vm-table__mismatch-actions">
            <Button size="sm" kind="tertiary" onClick={vmOverrides.applyMismatchedOverrides}>
              Apply Anyway
            </Button>
            <Button size="sm" kind="ghost" onClick={vmOverrides.clearAndReset}>
              Clear Overrides
            </Button>
          </div>
        </div>
      )}

      {/* Category filter bar */}
      <div className="discovery-vm-table__filters">
        <span className="discovery-vm-table__filters-label">Filter by category:</span>
        <div className="discovery-vm-table__filter-tags">
          {sortedCategories.map(([key, data]) => (
            <ClickableTile
              key={key}
              className={`discovery-vm-table__filter-tile ${selectedCategory === key ? 'discovery-vm-table__filter-tile--selected' : ''}`}
              onClick={() => {
                onCategorySelect(selectedCategory === key ? null : key);
                setPage(1);
              }}
            >
              <span className="discovery-vm-table__filter-name">{data.name}</span>
              <Tag type={selectedCategory === key ? 'blue' : 'gray'} size="sm">
                {data.vms.size}
              </Tag>
            </ClickableTile>
          ))}
          {unclassifiedCount > 0 && (
            <ClickableTile
              className={`discovery-vm-table__filter-tile ${selectedCategory === '_unclassified' ? 'discovery-vm-table__filter-tile--selected' : ''}`}
              onClick={() => {
                onCategorySelect(selectedCategory === '_unclassified' ? null : '_unclassified');
                setPage(1);
              }}
            >
              <span className="discovery-vm-table__filter-name">Unclassified</span>
              <Tag type={selectedCategory === '_unclassified' ? 'blue' : 'gray'} size="sm">
                {unclassifiedCount}
              </Tag>
            </ClickableTile>
          )}
          {selectedCategory && (
            <Button
              kind="ghost"
              size="sm"
              renderIcon={Close}
              onClick={() => {
                onCategorySelect(null);
                setPage(1);
              }}
              hasIconOnly
              iconDescription="Clear filter"
            />
          )}
        </div>
      </div>

      {/* Export/Import toolbar */}
      <div className="discovery-vm-table__toolbar-row">
        <Button size="sm" kind="ghost" renderIcon={Download} onClick={handleExportSettings}>
          Export Overrides
        </Button>
        <Button size="sm" kind="ghost" renderIcon={Upload} onClick={() => setShowImportModal(true)}>
          Import Overrides
        </Button>
        {vmOverrides.overrideCount > 0 && (
          <Button size="sm" kind="ghost" renderIcon={Reset} onClick={vmOverrides.clearAllOverrides} iconDescription="Clear all overrides">
            Clear All ({vmOverrides.overrideCount})
          </Button>
        )}
      </div>

      {/* Data Table */}
      <DataTable
        rows={paginatedRows}
        headers={headers}
        isSortable
      >
        {({
          rows,
          headers: tableHeaders,
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
                    id="discovery-status-filter"
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
                    className="discovery-vm-table__status-filter"
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
                    <TableSelectAll {...getSelectionProps()} />
                    {tableHeaders.map((header) => (
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
                      ? 'discovery-vm-table__row--excluded'
                      : originalRow.isForceIncluded
                        ? 'discovery-vm-table__row--overridden'
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
                          {renderCategoryCell(originalRow)}
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
      <div className="discovery-vm-table__pagination">
        <div className="discovery-vm-table__pagination-info">
          <Tag type="gray" size="sm">
            {formatNumber(filteredRows.length)} VMs
          </Tag>
          {(searchTerm || selectedCategory || statusFilter !== 'all') && (
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
        <p className="discovery-vm-table__modal-description">
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
        <p className="discovery-vm-table__modal-description">
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

export default DiscoveryVMTable;
