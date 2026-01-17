// Wave Planning Panel - shared component for migration wave planning

import { Grid, Column, Tile, Tag, RadioButtonGroup, RadioButton, Dropdown, Button } from '@carbon/react';
import { Download } from '@carbon/icons-react';
import { HorizontalBarChart } from '@/components/charts';
import { RedHatDocLink } from '@/components/common';
import { formatNumber } from '@/utils/formatters';
import { downloadWavePlanningExcel } from '@/services/export';
import type { WaveGroup, NetworkWaveGroup, NetworkGroupBy, MigrationMode } from '@/services/migration';

export type WavePlanningMode = 'complexity' | 'network';

export interface WavePlanningPanelProps {
  mode: MigrationMode;
  wavePlanningMode: WavePlanningMode;
  networkGroupBy: NetworkGroupBy;
  onWavePlanningModeChange: (mode: WavePlanningMode) => void;
  onNetworkGroupByChange: (groupBy: NetworkGroupBy) => void;
  networkWaves: NetworkWaveGroup[];
  complexityWaves: WaveGroup[];
  waveChartData: Array<{ label: string; value: number }>;
  waveResources: Array<{
    name: string;
    description: string;
    vmCount: number;
    vcpus: number;
    memoryGiB: number;
    storageGiB: number;
    hasBlockers: boolean;
  }>;
}

export function WavePlanningPanel({
  mode,
  wavePlanningMode,
  networkGroupBy,
  onWavePlanningModeChange,
  onNetworkGroupByChange,
  networkWaves,
  complexityWaves,
  waveChartData,
  waveResources,
}: WavePlanningPanelProps) {
  const isNetworkMode = wavePlanningMode === 'network';

  // Handle export to Excel
  const handleExport = () => {
    const waveExportData = isNetworkMode
      ? networkWaves.map(wave => ({
          name: wave.name,
          description: wave.description,
          vmCount: wave.vmCount,
          vcpus: wave.vcpus,
          memoryGiB: wave.memoryGiB,
          storageGiB: wave.storageGiB,
          hasBlockers: wave.hasBlockers,
          vms: wave.vms,
        }))
      : complexityWaves.map(wave => ({
          name: wave.name,
          description: wave.description,
          vmCount: wave.vmCount,
          vcpus: wave.vcpus,
          memoryGiB: wave.memoryGiB,
          storageGiB: wave.storageGiB,
          hasBlockers: wave.hasBlockers,
          vms: wave.vms,
        }));
    downloadWavePlanningExcel(waveExportData, wavePlanningMode, networkGroupBy);
  };

  // Workflow steps based on mode
  const workflowSteps = mode === 'vsi' ? [
    { key: '1. Export VM', value: 'Export VM as OVA or VMDK from vSphere' },
    { key: '2. Upload Image', value: 'Upload to IBM Cloud Object Storage' },
    { key: '3. Import Image', value: 'Import custom image into VPC' },
    { key: '4. Create VSI', value: 'Create VSI from imported image' },
  ] : [];

  // Resource links based on mode
  const resourceLinks = mode === 'vsi' ? [
    { href: 'https://cloud.ibm.com/docs/vpc?topic=vpc-importing-custom-images-vpc', label: 'Import Custom Images', description: 'Guide for importing custom images into IBM Cloud VPC' },
    { href: 'https://cloud.ibm.com/docs/vpc?topic=vpc-migrate-vsi-to-vpc', label: 'Migration Guide', description: 'Migrating virtual servers to VPC' },
  ] : [];

  return (
    <Grid className="migration-page__tab-content">
      <Column lg={16} md={8} sm={4}>
        <Tile className="migration-page__sizing-header">
          <div className="migration-page__wave-header">
            <div>
              <h3>Migration Wave Planning</h3>
              <p>
                {isNetworkMode
                  ? `${networkWaves.length} ${networkGroupBy === 'cluster' ? 'clusters' : 'port groups'} for network-based migration with cutover`
                  : `VMs organized into ${waveResources.length} waves based on complexity and readiness`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
              <RadioButtonGroup
                legendText="Planning Mode"
                name={`wave-planning-mode-${mode}`}
                valueSelected={wavePlanningMode}
                onChange={(value) => onWavePlanningModeChange(value as WavePlanningMode)}
                orientation="horizontal"
              >
                <RadioButton labelText="Network-Based" value="network" id={`wave-network-${mode}`} />
                <RadioButton labelText="Complexity-Based" value="complexity" id={`wave-complexity-${mode}`} />
              </RadioButtonGroup>
              <Button
                kind="tertiary"
                size="sm"
                renderIcon={Download}
                onClick={handleExport}
              >
                Export to Excel
              </Button>
            </div>
          </div>
          {isNetworkMode && (
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <Dropdown
                id={`network-group-by-${mode}`}
                titleText="Group VMs by"
                label="Select grouping method"
                items={['cluster', 'portGroup'] as NetworkGroupBy[]}
                itemToString={(item) => item === 'cluster' ? 'Cluster (VMware cluster)'
                  : item === 'portGroup' ? 'Port Group (exact name match)' : ''}
                selectedItem={networkGroupBy}
                onChange={({ selectedItem }) => selectedItem && onNetworkGroupByChange(selectedItem)}
                style={{ minWidth: '300px' }}
              />
            </div>
          )}
        </Tile>
      </Column>

      <Column lg={8} md={8} sm={4}>
        <Tile className="migration-page__chart-tile">
          <HorizontalBarChart
            title={isNetworkMode
              ? (networkGroupBy === 'cluster' ? 'VMs by Cluster' : 'VMs by Port Group')
              : 'VMs by Wave'}
            subtitle={isNetworkMode
              ? `Distribution across ${networkGroupBy === 'cluster' ? 'clusters' : 'port groups'}`
              : 'Distribution across migration waves'}
            data={waveChartData}
            height={280}
            valueLabel="VMs"
            colors={isNetworkMode
              ? ['#0f62fe', '#009d9a', '#8a3ffc', '#1192e8', '#005d5d', '#6929c4', '#012749', '#9f1853', '#fa4d56', '#570408']
              : ['#24a148', '#1192e8', '#009d9a', '#ff832b', '#da1e28']}
            formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
          />
        </Tile>
      </Column>

      <Column lg={8} md={8} sm={4}>
        <Tile className="migration-page__checks-tile">
          <h3>{isNetworkMode ? (networkGroupBy === 'cluster' ? 'Clusters' : 'Port Groups') : 'Wave Descriptions'}</h3>
          <div className="migration-page__check-items">
            {waveResources.slice(0, 8).map((wave, idx) => (
              <div key={idx} className="migration-page__check-item">
                <span>{wave.name.length > 30 ? wave.name.substring(0, 27) + '...' : wave.name}</span>
                <Tag type={wave.hasBlockers ? 'red' : isNetworkMode ? 'blue' : (idx === 4 ? 'red' : idx === 3 ? 'magenta' : 'blue')}>
                  {formatNumber(wave.vmCount)}
                </Tag>
              </div>
            ))}
            {waveResources.length > 8 && (
              <div className="migration-page__check-item">
                <span>+ {waveResources.length - 8} more {isNetworkMode ? 'groups' : 'waves'}</span>
                <Tag type="gray">{formatNumber(waveResources.slice(8).reduce((sum, w) => sum + w.vmCount, 0))}</Tag>
              </div>
            )}
          </div>
        </Tile>
      </Column>

      {waveResources.slice(0, 10).map((wave, idx) => (
        <Column key={idx} lg={8} md={8} sm={4}>
          <Tile className={`migration-page__wave-tile ${wave.hasBlockers ? 'migration-page__wave-tile--warning' : ''}`}>
            <h4>{wave.name}</h4>
            {wave.description && (
              <p className="migration-page__wave-description">{wave.description}</p>
            )}
            <div className="migration-page__wave-stats">
              <div className="migration-page__wave-stat">
                <span className="migration-page__wave-stat-label">VMs</span>
                <span className="migration-page__wave-stat-value">{formatNumber(wave.vmCount)}</span>
              </div>
              <div className="migration-page__wave-stat">
                <span className="migration-page__wave-stat-label">vCPUs</span>
                <span className="migration-page__wave-stat-value">{formatNumber(wave.vcpus)}</span>
              </div>
              <div className="migration-page__wave-stat">
                <span className="migration-page__wave-stat-label">Memory</span>
                <span className="migration-page__wave-stat-value">{formatNumber(wave.memoryGiB)} GiB</span>
              </div>
              <div className="migration-page__wave-stat">
                <span className="migration-page__wave-stat-label">Storage</span>
                <span className="migration-page__wave-stat-value">{formatNumber(Math.round(wave.storageGiB / 1024))} TiB</span>
              </div>
            </div>
            {wave.hasBlockers && (
              <Tag type="red" style={{ marginTop: '0.5rem' }}>Contains blockers</Tag>
            )}
          </Tile>
        </Column>
      ))}

      {/* Workflow section for VSI mode */}
      {mode === 'vsi' && workflowSteps.length > 0 && (
        <Column lg={16} md={8} sm={4}>
          <Tile className="migration-page__workflow-resources">
            <h4>VSI Migration Workflow</h4>
            <div className="migration-page__recommendation-grid">
              {workflowSteps.map((step) => (
                <div key={step.key} className="migration-page__recommendation-item">
                  <span className="migration-page__recommendation-key">{step.key}</span>
                  <span className="migration-page__recommendation-value">{step.value}</span>
                </div>
              ))}
            </div>
            {resourceLinks.length > 0 && (
              <div className="migration-page__resource-links" style={{ marginTop: '1rem' }}>
                {resourceLinks.map((link) => (
                  <RedHatDocLink
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    description={link.description}
                  />
                ))}
              </div>
            )}
          </Tile>
        </Column>
      )}
    </Grid>
  );
}

export default WavePlanningPanel;
