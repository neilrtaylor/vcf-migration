/**
 * WorkloadVMTable Component
 *
 * Displays detected workload VMs in a Carbon DataTable with:
 * - Clickable category filters
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
  Tooltip,
} from '@carbon/react';
import { Close, DocumentExport } from '@carbon/icons-react';
import { formatNumber } from '@/utils/formatters';
import type { VMClassificationResult } from '@/services/ai/types';
import './WorkloadVMTable.scss';

// ===== TYPES =====

export interface WorkloadMatch {
  vmName: string;
  category: string;
  categoryName: string;
  matchedPattern: string;
  source: 'name' | 'annotation' | 'ai' | 'user' | 'maintainer';
}

interface WorkloadVMTableProps {
  matches: WorkloadMatch[];
  workloadsByCategory: Record<string, { name: string; vms: Set<string> }>;
  aiClassifications?: Record<string, VMClassificationResult>;
}

interface WorkloadRow {
  id: string;
  vmName: string;
  category: string;
  categoryName: string;
  matchedPattern: string;
  source: string;
}

// ===== COMPONENT =====

export function WorkloadVMTable({ matches, workloadsByCategory, aiClassifications }: WorkloadVMTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Transform matches to rows
  const rows = useMemo((): WorkloadRow[] => {
    return matches.map((match, idx) => ({
      id: `${match.vmName}-${match.category}-${idx}`,
      vmName: match.vmName,
      category: match.category,
      categoryName: match.categoryName,
      matchedPattern: match.matchedPattern,
      source: match.source === 'user' ? 'User Override'
            : match.source === 'ai' ? 'AI'
            : match.source === 'name' ? 'VM Name'
            : 'Annotation',
    }));
  }, [matches]);

  // Filter by category and search term
  const filteredRows = useMemo(() => {
    let result = rows;

    if (selectedCategory) {
      result = result.filter(row => row.category === selectedCategory);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(row =>
        row.vmName.toLowerCase().includes(term) ||
        row.categoryName.toLowerCase().includes(term) ||
        row.matchedPattern.toLowerCase().includes(term)
      );
    }

    return result;
  }, [rows, selectedCategory, searchTerm]);

  // Paginate
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  // Category click handler
  const handleCategoryClick = useCallback((categoryKey: string) => {
    setSelectedCategory(prev => prev === categoryKey ? null : categoryKey);
    setPage(1);
  }, []);

  // Export to CSV
  const handleExportCSV = useCallback(() => {
    const headers = ['VM Name', 'Category', 'Matched Pattern', 'Source'];
    const csvRows = filteredRows.map(row => [
      row.vmName,
      row.categoryName,
      row.matchedPattern,
      row.source,
    ]);

    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workload-vms.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredRows]);

  const headers = [
    { key: 'vmName', header: 'VM Name' },
    { key: 'categoryName', header: 'Category' },
    { key: 'matchedPattern', header: 'Matched Pattern' },
    { key: 'source', header: 'Source' },
  ];

  // Sort categories by count
  const sortedCategories = useMemo(() => {
    return Object.entries(workloadsByCategory)
      .sort((a, b) => b[1].vms.size - a[1].vms.size);
  }, [workloadsByCategory]);

  return (
    <div className="workload-vm-table">
      {/* Clickable category filters */}
      <div className="workload-vm-table__filters">
        <span className="workload-vm-table__filters-label">Filter by category:</span>
        <div className="workload-vm-table__filter-tags">
          {sortedCategories.map(([key, data]) => (
            <ClickableTile
              key={key}
              className={`workload-vm-table__filter-tile ${selectedCategory === key ? 'workload-vm-table__filter-tile--selected' : ''}`}
              onClick={() => handleCategoryClick(key)}
            >
              <span className="workload-vm-table__filter-name">{data.name}</span>
              <Tag type={selectedCategory === key ? 'blue' : 'gray'} size="sm">
                {data.vms.size}
              </Tag>
            </ClickableTile>
          ))}
          {selectedCategory && (
            <Button
              kind="ghost"
              size="sm"
              renderIcon={Close}
              onClick={() => {
                setSelectedCategory(null);
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
                  placeholder="Search workload VMs..."
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

                  const matchObj = matches.find(m => m.vmName === originalRow.vmName && m.category === originalRow.category);
                  const isUserOverride = matchObj?.source === 'user';
                  const isAI = matchObj?.source === 'ai';

                  const aiResult = aiClassifications?.[originalRow.vmName];
                  const hasAI = aiResult?.source === 'ai';
                  const aiDisagrees = hasAI && !isUserOverride && !isAI && aiResult.workloadType &&
                    aiResult.workloadType.toLowerCase() !== originalRow.categoryName.toLowerCase();

                  return (
                    <TableRow {...getRowProps({ row })} key={row.id}>
                      <TableCell>{originalRow.vmName}</TableCell>
                      <TableCell>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
                          <Tag type="blue" size="sm">{originalRow.categoryName}</Tag>
                          {isUserOverride && (
                            <Tag type="cyan" size="sm">User</Tag>
                          )}
                          {isAI && hasAI && (
                            <Tooltip label={aiResult.reasoning || 'AI-classified workload'} align="bottom">
                              <button type="button" style={{ all: 'unset', cursor: 'help' }}>
                                <Tag type="purple" size="sm">AI {Math.round(aiResult.confidence * 100)}%</Tag>
                              </button>
                            </Tooltip>
                          )}
                          {!isUserOverride && !isAI && hasAI && aiDisagrees && (
                            <Tooltip label={`AI suggests: ${aiResult.workloadType}. ${aiResult.reasoning || ''}`} align="bottom">
                              <button type="button" style={{ all: 'unset', cursor: 'help' }}>
                                <Tag type="purple" size="sm">AI: {aiResult.workloadType} {Math.round(aiResult.confidence * 100)}%</Tag>
                              </button>
                            </Tooltip>
                          )}
                          {!isUserOverride && !isAI && hasAI && !aiDisagrees && (
                            <Tooltip label={aiResult.reasoning || 'AI-classified workload'} align="bottom">
                              <button type="button" style={{ all: 'unset', cursor: 'help' }}>
                                <Tag type="purple" size="sm">AI {Math.round(aiResult.confidence * 100)}%</Tag>
                              </button>
                            </Tooltip>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <code className="workload-vm-table__pattern">{originalRow.matchedPattern}</code>
                      </TableCell>
                      <TableCell>
                        {originalRow.source}
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
      <div className="workload-vm-table__pagination">
        <div className="workload-vm-table__pagination-info">
          <Tag type="gray" size="sm">
            {formatNumber(filteredRows.length)} matches
          </Tag>
          {(searchTerm || selectedCategory) && (
            <Tag type="blue" size="sm">
              Filtered from {formatNumber(rows.length)}
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

export default WorkloadVMTable;
