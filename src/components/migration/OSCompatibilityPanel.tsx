// OS Compatibility Panel - shared component for OS compatibility analysis

import { Grid, Column, Tile } from '@carbon/react';
import { DoughnutChart } from '@/components/charts';
import type { MigrationMode } from '@/services/migration';
import { formatNumber } from '@/utils/formatters';

export interface OSCompatibilityPanelProps {
  mode: MigrationMode;
  osStatusCounts: Record<string, number>;
}

export function OSCompatibilityPanel({ mode, osStatusCounts }: OSCompatibilityPanelProps) {
  // Build chart data based on mode
  const chartData = mode === 'vsi'
    ? [
        { label: 'Supported', value: osStatusCounts['supported'] || 0 },
        { label: 'Community', value: osStatusCounts['community'] || 0 },
        { label: 'Unsupported', value: osStatusCounts['unsupported'] || 0 },
      ].filter(d => d.value > 0)
    : [
        { label: 'Fully Supported', value: osStatusCounts['fully-supported'] || 0 },
        { label: 'Supported (Caveats)', value: osStatusCounts['supported-with-caveats'] || 0 },
        { label: 'Unsupported', value: osStatusCounts['unsupported'] || 0 },
      ].filter(d => d.value > 0);

  // Colors match the status types
  const chartColors = mode === 'vsi'
    ? ['#24a148', '#f1c21b', '#da1e28']  // green, yellow, red
    : ['#24a148', '#f1c21b', '#da1e28']; // green, yellow, red

  // Summary labels based on mode
  const summaryLabels = mode === 'vsi'
    ? [
        { label: 'Supported', key: 'supported', tagType: 'green' as const },
        { label: 'Community', key: 'community', tagType: 'magenta' as const },
        { label: 'Unsupported', key: 'unsupported', tagType: 'red' as const },
      ]
    : [
        { label: 'Fully Supported', key: 'fully-supported', tagType: 'green' as const },
        { label: 'Supported with Caveats', key: 'supported-with-caveats', tagType: 'magenta' as const },
        { label: 'Unsupported / EOL', key: 'unsupported', tagType: 'red' as const },
      ];

  const noteText = mode === 'vsi'
    ? 'Based on IBM Cloud VPC supported guest operating systems'
    : 'Based on Red Hat OpenShift Virtualization compatibility matrix';

  return (
    <Grid className="migration-page__tab-content">
      <Column lg={8} md={8} sm={4}>
        <Tile className="migration-page__chart-tile">
          <DoughnutChart
            title="OS Compatibility Distribution"
            subtitle={mode === 'vsi' ? 'IBM Cloud VPC support status' : 'Red Hat validated compatibility status'}
            data={chartData}
            height={280}
            colors={chartColors}
            formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
          />
        </Tile>
      </Column>

      <Column lg={8} md={8} sm={4}>
        <Tile className="migration-page__checks-tile">
          <h3>Compatibility Summary</h3>
          <div className="migration-page__check-items">
            {summaryLabels.map(({ label, key, tagType }) => (
              <div key={key} className="migration-page__check-item">
                <span>{label}</span>
                <span className={`cds--tag cds--tag--${tagType}`}>
                  {formatNumber(osStatusCounts[key] || 0)}
                </span>
              </div>
            ))}
          </div>
          <p className="migration-page__os-note">
            {noteText}
          </p>
        </Tile>
      </Column>

      {mode === 'vsi' && (
        <Column lg={16} md={8} sm={4}>
          <Tile className="migration-page__recommendation-tile">
            <h4>IBM Cloud VPC OS Support</h4>
            <div className="migration-page__recommendation-grid">
              <div className="migration-page__recommendation-item">
                <span className="migration-page__recommendation-key">Supported</span>
                <span className="migration-page__recommendation-value">IBM-validated images with full support (RHEL, Ubuntu, Windows Server)</span>
              </div>
              <div className="migration-page__recommendation-item">
                <span className="migration-page__recommendation-key">Community</span>
                <span className="migration-page__recommendation-value">Community-supported images that work but have limited IBM support</span>
              </div>
              <div className="migration-page__recommendation-item">
                <span className="migration-page__recommendation-key">Unsupported</span>
                <span className="migration-page__recommendation-value">OS may work but is not validated - migration requires evaluation</span>
              </div>
            </div>
          </Tile>
        </Column>
      )}

      {mode === 'roks' && (
        <Column lg={16} md={8} sm={4}>
          <Tile className="migration-page__recommendation-tile">
            <h4>OpenShift Virtualization OS Support</h4>
            <div className="migration-page__recommendation-grid">
              <div className="migration-page__recommendation-item">
                <span className="migration-page__recommendation-key">Fully Supported</span>
                <span className="migration-page__recommendation-value">RHEL 8/9, CentOS Stream, Windows Server 2019/2022 - optimal for migration</span>
              </div>
              <div className="migration-page__recommendation-item">
                <span className="migration-page__recommendation-key">Supported with Caveats</span>
                <span className="migration-page__recommendation-value">May require driver updates or configuration changes post-migration</span>
              </div>
              <div className="migration-page__recommendation-item">
                <span className="migration-page__recommendation-key">Unsupported / EOL</span>
                <span className="migration-page__recommendation-value">OS upgrade required before migration to OpenShift Virtualization</span>
              </div>
            </div>
          </Tile>
        </Column>
      )}
    </Grid>
  );
}

export default OSCompatibilityPanel;
