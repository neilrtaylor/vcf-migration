// Enhanced data table with TanStack Table integration
import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  Table,
  TableHead,
  TableRow as CarbonTableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  TableContainer,
  Button,
  Pagination,
  Tag,
  OverflowMenu,
  OverflowMenuItem,
} from '@carbon/react';
import { Download, ArrowUp, ArrowDown, ArrowsVertical, Column as ColumnIcon } from '@carbon/icons-react';
import './EnhancedDataTable.scss';

// Generic row type - use Record for flexibility
export type TableRow = Record<string, unknown>;

interface EnhancedDataTableProps<T extends TableRow> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  title?: string;
  description?: string;
  enableSearch?: boolean;
  enablePagination?: boolean;
  enableSorting?: boolean;
  enableExport?: boolean;
  enableColumnVisibility?: boolean;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  exportFilename?: string;
}

export function EnhancedDataTable<T extends TableRow>({
  data,
  columns,
  title,
  description,
  enableSearch = true,
  enablePagination = true,
  enableSorting = true,
  enableExport = true,
  enableColumnVisibility = true,
  defaultPageSize = 25,
  pageSizeOptions = [10, 25, 50, 100],
  exportFilename = 'data-export',
}: EnhancedDataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    initialState: {
      pagination: {
        pageSize: defaultPageSize,
      },
    },
  });

  // Export to CSV (only visible columns)
  const handleExport = () => {
    const visibleColumns = table.getVisibleLeafColumns();

    const headers = visibleColumns.map(col => {
      const header = col.columnDef.header;
      return typeof header === 'string' ? header : String(col.id || '');
    });

    const rows = table.getFilteredRowModel().rows.map(row => {
      return visibleColumns.map(col => {
        const value = row.getValue(col.id);
        // Handle different value types
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
      });
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${exportFilename}.csv`;
    link.click();
  };

  const { pageIndex, pageSize } = table.getState().pagination;
  const totalRows = table.getFilteredRowModel().rows.length;

  return (
    <div className="enhanced-data-table">
      <TableContainer title={title} description={description}>
        <TableToolbar>
          <TableToolbarContent>
            {enableSearch && (
              <TableToolbarSearch
                placeholder="Search all columns..."
                onChange={(event) => {
                  if (typeof event === 'string') {
                    setGlobalFilter(event);
                  } else {
                    setGlobalFilter(event.target.value);
                  }
                }}
                value={globalFilter}
                persistent
              />
            )}
            {enableColumnVisibility && (
              <OverflowMenu
                renderIcon={ColumnIcon}
                size="sm"
                iconDescription="Toggle columns"
                menuOptionsClass="enhanced-data-table__column-menu"
                flipped
              >
                {table.getAllLeafColumns().map(column => (
                  <OverflowMenuItem
                    key={column.id}
                    itemText={typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id}
                    onClick={() => column.toggleVisibility()}
                    className={column.getIsVisible() ? 'enhanced-data-table__column-visible' : ''}
                  />
                ))}
              </OverflowMenu>
            )}
            {enableExport && (
              <Button
                kind="ghost"
                size="sm"
                renderIcon={Download}
                onClick={handleExport}
                hasIconOnly
                iconDescription="Export to CSV"
                tooltipPosition="bottom"
              />
            )}
          </TableToolbarContent>
        </TableToolbar>

        <Table>
          <TableHead>
            {table.getHeaderGroups().map(headerGroup => (
              <CarbonTableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHeader
                    key={header.id}
                    onClick={enableSorting && header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                    className={enableSorting && header.column.getCanSort() ? 'enhanced-data-table__sortable-header' : ''}
                  >
                    <div className="enhanced-data-table__header-content">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {enableSorting && header.column.getCanSort() && (
                        <span className="enhanced-data-table__sort-icon">
                          {header.column.getIsSorted() === 'asc' ? (
                            <ArrowUp size={16} />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <ArrowDown size={16} />
                          ) : (
                            <ArrowsVertical size={16} />
                          )}
                        </span>
                      )}
                    </div>
                  </TableHeader>
                ))}
              </CarbonTableRow>
            ))}
          </TableHead>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <CarbonTableRow>
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="enhanced-data-table__empty">
                  No results found
                </TableCell>
              </CarbonTableRow>
            ) : (
              table.getRowModel().rows.map(row => (
                <CarbonTableRow key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </CarbonTableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {enablePagination && (
        <div className="enhanced-data-table__pagination">
          <div className="enhanced-data-table__pagination-info">
            <Tag type="gray" size="sm">
              {totalRows} total rows
            </Tag>
            {globalFilter && (
              <Tag type="blue" size="sm">
                Filtered from {data.length}
              </Tag>
            )}
          </div>
          <Pagination
            page={pageIndex + 1}
            pageSize={pageSize}
            pageSizes={pageSizeOptions}
            totalItems={totalRows}
            onChange={({ page, pageSize }) => {
              table.setPageIndex(page - 1);
              table.setPageSize(pageSize);
            }}
            itemsPerPageText="Rows per page:"
          />
        </div>
      )}
    </div>
  );
}

// Helper to create column definitions
export function createColumnHelper<T extends TableRow>() {
  return {
    accessor: <K extends keyof T>(
      key: K,
      options: {
        header: string;
        cell?: (value: T[K]) => React.ReactNode;
        enableSorting?: boolean;
      }
    ): ColumnDef<T, T[K]> => ({
      id: String(key),
      accessorKey: key,
      header: options.header,
      cell: options.cell ? (info) => options.cell!(info.getValue() as T[K]) : undefined,
      enableSorting: options.enableSorting ?? true,
    }),
  };
}
