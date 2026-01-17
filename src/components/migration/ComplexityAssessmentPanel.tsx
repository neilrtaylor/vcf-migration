// Complexity Assessment Panel - shared component for migration complexity analysis

import { useState, useMemo } from 'react';
import { Grid, Column, Tile } from '@carbon/react';
import type { ColumnDef } from '@tanstack/react-table';
import { DoughnutChart, HorizontalBarChart } from '@/components/charts';
import { EnhancedDataTable } from '@/components/tables';
import type { ComplexityScore, MigrationMode } from '@/services/migration';
import { HW_VERSION_MINIMUM, HW_VERSION_RECOMMENDED } from '@/utils/constants';

export interface ComplexityAssessmentPanelProps {
  mode: MigrationMode;
  complexityScores: ComplexityScore[];
  chartData: Array<{ label: string; value: number }>;
  topComplexVMs: Array<{ label: string; value: number }>;
}

export function ComplexityAssessmentPanel({
  mode,
  complexityScores,
  chartData,
  topComplexVMs,
}: ComplexityAssessmentPanelProps) {
  const [complexityFilter, setComplexityFilter] = useState<string | null>(null);

  // Filter scores by category
  const filteredComplexityVMs = useMemo(() => {
    return complexityFilter
      ? complexityScores.filter(cs => cs.category === complexityFilter)
      : complexityScores;
  }, [complexityScores, complexityFilter]);

  // Sort by score descending
  const sortedComplexityVMs = useMemo(() => {
    return [...filteredComplexityVMs].sort((a, b) => b.score - a.score);
  }, [filteredComplexityVMs]);

  // Table columns
  const complexityColumns: ColumnDef<ComplexityScore, unknown>[] = useMemo(() => {
    const baseColumns: ColumnDef<ComplexityScore, unknown>[] = [
      {
        accessorKey: 'vmName',
        header: 'VM Name',
        enableSorting: true,
      },
      {
        accessorKey: 'score',
        header: 'Score',
        enableSorting: true,
        cell: ({ row }) => {
          const score = row.original.score;
          const color = score <= 25 ? '#24a148' : score <= 50 ? '#1192e8' : score <= 75 ? '#ff832b' : '#da1e28';
          return <span style={{ color, fontWeight: 600 }}>{score}</span>;
        },
      },
      {
        accessorKey: 'category',
        header: 'Category',
        enableSorting: true,
      },
      {
        accessorKey: 'factors',
        header: 'Complexity Factors',
        enableSorting: false,
      },
      {
        accessorKey: 'guestOS',
        header: 'Guest OS',
        enableSorting: true,
      },
      {
        accessorKey: 'cpus',
        header: 'vCPUs',
        enableSorting: true,
      },
      {
        accessorKey: 'memoryGiB',
        header: 'Memory (GiB)',
        enableSorting: true,
      },
      {
        accessorKey: 'diskCount',
        header: 'Disks',
        enableSorting: true,
      },
      {
        accessorKey: 'nicCount',
        header: 'NICs',
        enableSorting: true,
      },
    ];

    // Add HW Version column for ROKS mode
    if (mode === 'roks') {
      baseColumns.push({
        accessorKey: 'hwVersion',
        header: 'HW Version',
        enableSorting: true,
      });
    }

    return baseColumns;
  }, [mode]);

  // Complexity factors description based on mode
  const complexityFactors = mode === 'vsi' ? [
    { key: 'OS Compatibility', value: 'Unsupported OS adds significant complexity' },
    { key: 'Memory Size', value: '>512GB requires high-memory profiles, >1TB is a blocker' },
    { key: 'Disk Size', value: '>2TB disks may need splitting across volumes' },
    { key: 'Network Complexity', value: 'Multiple NICs require VPC network planning' },
  ] : [
    { key: 'OS Compatibility', value: 'Score based on Red Hat OS compatibility matrix' },
    { key: 'Network Interfaces', value: '>3 NICs adds +30, 2-3 NICs adds +15' },
    { key: 'Disk Count', value: '>5 disks adds +30, 3-5 disks adds +15' },
    { key: 'Hardware Version', value: `Below min v${HW_VERSION_MINIMUM} adds +25, below recommended v${HW_VERSION_RECOMMENDED} adds +10` },
    { key: 'Resource Size', value: '>16 vCPUs or >128 GiB memory adds +20' },
  ];

  return (
    <Grid className="migration-page__tab-content">
      <Column lg={8} md={8} sm={4}>
        <Tile className="migration-page__chart-tile">
          <DoughnutChart
            title="Migration Complexity"
            subtitle={complexityFilter ? `Filtered: ${complexityFilter}` : 'Click segment to filter table below'}
            data={chartData}
            height={280}
            colors={['#24a148', '#1192e8', '#ff832b', '#da1e28']}
            formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
            onSegmentClick={(label) => {
              const category = label.split(' ')[0];
              setComplexityFilter(complexityFilter === category ? null : category);
            }}
          />
        </Tile>
      </Column>

      <Column lg={8} md={8} sm={4}>
        <Tile className="migration-page__chart-tile">
          <HorizontalBarChart
            title="Top 10 Most Complex VMs"
            subtitle="Highest complexity scores"
            data={topComplexVMs}
            height={280}
            valueLabel="Score"
            formatValue={(v) => `Score: ${v}`}
          />
        </Tile>
      </Column>

      <Column lg={16} md={8} sm={4}>
        <Tile className="migration-page__recommendation-tile">
          <h4>{mode === 'vsi' ? 'VSI' : 'OpenShift Virtualization'} Complexity Factors</h4>
          <div className="migration-page__recommendation-grid">
            {complexityFactors.map((factor) => (
              <div key={factor.key} className="migration-page__recommendation-item">
                <span className="migration-page__recommendation-key">{factor.key}</span>
                <span className="migration-page__recommendation-value">{factor.value}</span>
              </div>
            ))}
          </div>
        </Tile>
      </Column>

      <Column lg={16} md={8} sm={4}>
        <Tile className="migration-page__table-tile">
          <EnhancedDataTable
            data={sortedComplexityVMs}
            columns={complexityColumns}
            title={complexityFilter ? `${complexityFilter} VMs (${sortedComplexityVMs.length})` : `All VMs by Complexity (${sortedComplexityVMs.length})`}
            description={complexityFilter ? `Click chart segment again to clear filter` : 'Click a segment in the Migration Complexity chart to filter'}
            enableSearch
            enablePagination
            enableSorting
            enableExport
            enableColumnVisibility
            defaultPageSize={25}
            exportFilename="vm-complexity-analysis"
          />
        </Tile>
      </Column>
    </Grid>
  );
}

export default ComplexityAssessmentPanel;
