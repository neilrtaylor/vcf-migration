// Pre-Flight Report page - Detailed VM-by-VM check results
import { useState, useMemo } from 'react';
import { Grid, Column, Tile, ContentSwitcher, Switch, Toggle, Button, Tag } from '@carbon/react';
import { Download } from '@carbon/icons-react';
import { Navigate } from 'react-router-dom';
import { useData } from '@/hooks';
import { ROUTES } from '@/utils/constants';
import { MetricCard, CheckResultCell } from '@/components/common';
import { EnhancedDataTable } from '@/components/tables';
import {
  runPreFlightChecks,
  getChecksForMode,
  type CheckMode,
  type VMCheckResults,
  type CheckDefinition,
} from '@/services/preflightChecks';
import { exportPreFlightExcel } from '@/services/export/excelGenerator';
import type { ColumnDef } from '@tanstack/react-table';
import './PreFlightReportPage.scss';

// Build table columns dynamically based on check mode
function buildColumns(checksForMode: CheckDefinition[]): ColumnDef<VMCheckResults, unknown>[] {
  const baseColumns: ColumnDef<VMCheckResults, unknown>[] = [
    {
      id: 'vmName',
      accessorKey: 'vmName',
      header: 'VM Name',
      cell: (info) => info.getValue() as string,
    },
    {
      id: 'cluster',
      accessorKey: 'cluster',
      header: 'Cluster',
      cell: (info) => info.getValue() as string || '-',
    },
    {
      id: 'guestOS',
      accessorKey: 'guestOS',
      header: 'Guest OS',
      cell: (info) => {
        const value = info.getValue() as string;
        return value ? (value.length > 30 ? value.substring(0, 30) + '...' : value) : '-';
      },
    },
    {
      id: 'status',
      accessorFn: (row: VMCheckResults) => {
        // Sort priority: blockers first (0), warnings second (1), ready last (2)
        if (row.blockerCount > 0) return 0;
        if (row.warningCount > 0) return 1;
        return 2;
      },
      header: 'Status',
      cell: (info) => {
        const row = info.row.original;
        if (row.blockerCount > 0) {
          return <Tag type="red" size="sm">{row.blockerCount} Blockers</Tag>;
        }
        if (row.warningCount > 0) {
          return <Tag type="magenta" size="sm">{row.warningCount} Warnings</Tag>;
        }
        return <Tag type="green" size="sm">Ready</Tag>;
      },
    },
  ];

  const checkColumns: ColumnDef<VMCheckResults, unknown>[] = checksForMode.map((checkDef) => ({
    id: checkDef.id,
    accessorFn: (row: VMCheckResults) => row.checks[checkDef.id]?.status || 'na',
    header: checkDef.shortName,
    cell: (info) => {
      const result = info.row.original.checks[checkDef.id];
      if (!result) return null;
      return <CheckResultCell result={result} checkDef={checkDef} />;
    },
    enableSorting: true,
  }));

  return [...baseColumns, ...checkColumns];
}

export function PreFlightReportPage() {
  const { rawData } = useData();
  const [mode, setMode] = useState<CheckMode>('roks');
  const [showFailuresOnly, setShowFailuresOnly] = useState(false);

  // Redirect to landing if no data
  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  // Run pre-flight checks
  const checkResults = useMemo(
    () => runPreFlightChecks(rawData, mode),
    [rawData, mode]
  );

  // Filter results based on showFailuresOnly toggle
  const filteredResults = useMemo(
    () =>
      showFailuresOnly
        ? checkResults.filter((r) => r.blockerCount > 0 || r.warningCount > 0)
        : checkResults,
    [checkResults, showFailuresOnly]
  );

  // Get check definitions for current mode
  const checksForMode = useMemo(() => getChecksForMode(mode), [mode]);

  // Build table columns dynamically
  const columns = useMemo(() => buildColumns(checksForMode), [checksForMode]);

  // Calculate summary metrics
  const totalVMs = checkResults.length;
  const vmsWithBlockers = checkResults.filter((r) => r.blockerCount > 0).length;
  const vmsWithWarningsOnly = checkResults.filter(
    (r) => r.warningCount > 0 && r.blockerCount === 0
  ).length;
  const vmsReady = checkResults.filter(
    (r) => r.blockerCount === 0 && r.warningCount === 0
  ).length;

  const handleModeChange = (evt: { name?: string | number }) => {
    if (evt.name === 'roks' || evt.name === 'vsi') {
      setMode(evt.name);
    }
  };

  const handleExport = () => {
    exportPreFlightExcel(checkResults, mode);
  };

  return (
    <div className="preflight-report-page">
      <Grid>
        {/* Header */}
        <Column lg={16} md={8} sm={4}>
          <h1 className="preflight-report-page__title">VM Pre-Flight Report</h1>
          <p className="preflight-report-page__subtitle">
            Detailed migration readiness check results for each virtual machine
          </p>
        </Column>

        {/* Controls */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="preflight-report-page__controls">
            <div className="preflight-report-page__controls-row">
              <div className="preflight-report-page__mode-switcher">
                <span className="preflight-report-page__label">Target Platform:</span>
                <ContentSwitcher
                  onChange={handleModeChange}
                  selectedIndex={mode === 'roks' ? 0 : 1}
                  size="md"
                >
                  <Switch name="roks" text="ROKS (OpenShift)" />
                  <Switch name="vsi" text="VSI (VPC)" />
                </ContentSwitcher>
              </div>

              <div className="preflight-report-page__filters">
                <Toggle
                  id="show-failures-toggle"
                  labelText="Show failures only"
                  labelA="Off"
                  labelB="On"
                  toggled={showFailuresOnly}
                  onToggle={() => setShowFailuresOnly(!showFailuresOnly)}
                  size="sm"
                />
              </div>

              <div className="preflight-report-page__actions">
                <Button
                  kind="tertiary"
                  size="md"
                  renderIcon={Download}
                  onClick={handleExport}
                >
                  Export Excel
                </Button>
              </div>
            </div>
          </Tile>
        </Column>

        {/* Summary Cards */}
        <Column lg={4} md={2} sm={2}>
          <MetricCard
            label="Total VMs"
            value={totalVMs}
            variant="info"
          />
        </Column>
        <Column lg={4} md={2} sm={2}>
          <MetricCard
            label="With Blockers"
            value={vmsWithBlockers}
            variant="error"
            detail={`${((vmsWithBlockers / totalVMs) * 100).toFixed(1)}%`}
          />
        </Column>
        <Column lg={4} md={2} sm={2}>
          <MetricCard
            label="Warnings Only"
            value={vmsWithWarningsOnly}
            variant="warning"
            detail={`${((vmsWithWarningsOnly / totalVMs) * 100).toFixed(1)}%`}
          />
        </Column>
        <Column lg={4} md={2} sm={2}>
          <MetricCard
            label="Ready to Migrate"
            value={vmsReady}
            variant="success"
            detail={`${((vmsReady / totalVMs) * 100).toFixed(1)}%`}
          />
        </Column>

        {/* Check Legend */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="preflight-report-page__legend">
            <span className="preflight-report-page__label">Check Results Legend:</span>
            <div className="preflight-report-page__legend-items">
              <div className="preflight-report-page__legend-item">
                <span className="preflight-report-page__legend-icon preflight-report-page__legend-icon--pass" />
                <span>Pass</span>
              </div>
              <div className="preflight-report-page__legend-item">
                <span className="preflight-report-page__legend-icon preflight-report-page__legend-icon--fail" />
                <span>Fail (Blocker)</span>
              </div>
              <div className="preflight-report-page__legend-item">
                <span className="preflight-report-page__legend-icon preflight-report-page__legend-icon--warn" />
                <span>Warning</span>
              </div>
              <div className="preflight-report-page__legend-item">
                <span className="preflight-report-page__legend-icon preflight-report-page__legend-icon--na" />
                <span>Not Applicable</span>
              </div>
            </div>
            <span className="preflight-report-page__legend-hint">
              Hover over check results for detailed information
            </span>
          </Tile>
        </Column>

        {/* Data Table */}
        <Column lg={16} md={8} sm={4}>
          <div className="preflight-report-page__table">
            <EnhancedDataTable
              data={filteredResults}
              columns={columns}
              title={`${mode.toUpperCase()} Pre-Flight Checks`}
              description={`${filteredResults.length} VMs · ${checksForMode.length} checks per VM`}
              enableSearch
              enablePagination
              enableSorting
              enableColumnVisibility
              defaultPageSize={50}
              pageSizeOptions={[25, 50, 100, 250]}
              exportFilename={`preflight-${mode}-${new Date().toISOString().split('T')[0]}`}
            />
          </div>
        </Column>
      </Grid>
    </div>
  );
}
