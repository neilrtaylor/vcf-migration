// Documentation page - Detailed explanations of metrics, formulas, and definitions
import { Grid, Column, Tile, Accordion, AccordionItem, UnorderedList, ListItem, Tag } from '@carbon/react';
import { HW_VERSION_MINIMUM, HW_VERSION_RECOMMENDED, SNAPSHOT_WARNING_AGE_DAYS, SNAPSHOT_BLOCKER_AGE_DAYS } from '@/utils/constants';
import './DocumentationPage.scss';

interface MetricDefinition {
  name: string;
  description: string;
  formula?: string;
  source?: string;
  notes?: string[];
}

const dashboardMetrics: MetricDefinition[] = [
  {
    name: 'Total VMs',
    description: 'Count of all virtual machines in the environment, excluding templates.',
    source: 'vInfo sheet, filtered by Template = false',
  },
  {
    name: 'Total vCPUs',
    description: 'Sum of all virtual CPU cores allocated across all VMs.',
    formula: 'SUM(vInfo.CPUs)',
    source: 'vInfo sheet, CPUs column',
  },
  {
    name: 'Total Memory',
    description: 'Total memory allocated to all VMs, displayed in TiB.',
    formula: 'SUM(vInfo.Memory) / 1024 / 1024 (MiB to TiB)',
    source: 'vInfo sheet, Memory column',
  },
  {
    name: 'Provisioned Storage',
    description: 'Total storage capacity allocated (thin + thick provisioned) to VMs.',
    formula: 'SUM(vInfo.Provisioned MiB) / 1024 / 1024',
    source: 'vInfo sheet, Provisioned MiB column',
  },
  {
    name: 'In Use Storage',
    description: 'Actual storage consumed by VMs on datastores.',
    formula: 'SUM(vInfo.In Use MiB) / 1024 / 1024',
    source: 'vInfo sheet, In Use MiB column',
  },
  {
    name: 'Storage Efficiency',
    description: 'Percentage of provisioned storage that is actually in use.',
    formula: '(In Use Storage / Provisioned Storage) * 100',
    notes: ['Higher values indicate less over-provisioning', 'Thin provisioning typically shows lower efficiency'],
  },
  {
    name: 'CPU Overcommitment Ratio',
    description: 'Ratio of allocated vCPUs to physical CPU cores per cluster.',
    formula: 'Total vCPUs in Cluster / Total Physical Cores in Cluster',
    notes: ['1:1 means no overcommitment', 'Values above 4:1 may indicate resource contention risk'],
  },
  {
    name: 'Memory Overcommitment Ratio',
    description: 'Ratio of allocated VM memory to physical host memory per cluster.',
    formula: 'Total VM Memory in Cluster / Total Host Memory in Cluster',
    notes: ['Values above 1:1 rely on memory sharing techniques', 'High ratios may cause performance issues'],
  },
];

const computeMetrics: MetricDefinition[] = [
  {
    name: 'vCPU Distribution',
    description: 'VMs grouped by number of vCPUs allocated.',
    notes: ['Buckets: 1-2, 3-4, 5-8, 9-16, 17-32, 33+', 'Helps identify right-sizing opportunities'],
  },
  {
    name: 'Memory Distribution',
    description: 'VMs grouped by memory allocation in GiB.',
    notes: ['Buckets: 0-4, 5-8, 9-16, 17-32, 33-64, 65+ GiB', 'Large VMs may need special migration handling'],
  },
  {
    name: 'Average vCPUs per VM',
    description: 'Mean number of vCPUs allocated across all VMs.',
    formula: 'Total vCPUs / Total VMs',
  },
  {
    name: 'Average Memory per VM',
    description: 'Mean memory allocated per VM in GiB.',
    formula: 'Total Memory (GiB) / Total VMs',
  },
];

const storageMetrics: MetricDefinition[] = [
  {
    name: 'Datastore Capacity',
    description: 'Total raw capacity of all datastores.',
    source: 'vDatastore sheet, Capacity column',
  },
  {
    name: 'Datastore Used',
    description: 'Total space consumed across all datastores.',
    source: 'vDatastore sheet, Used column',
  },
  {
    name: 'Datastore Utilization',
    description: 'Percentage of datastore capacity in use.',
    formula: '(Used / Capacity) * 100',
    notes: ['Datastores above 80% should be monitored', 'Above 90% is critical'],
  },
  {
    name: 'VM Disk Count',
    description: 'Number of virtual disks attached to each VM.',
    source: 'vDisk sheet',
    notes: ['VMs with many disks may need special migration planning'],
  },
];

const networkMetrics: MetricDefinition[] = [
  {
    name: 'Total NICs',
    description: 'Count of all virtual network adapters across all VMs.',
    source: 'vNetwork sheet',
  },
  {
    name: 'Port Groups',
    description: 'Unique network port groups configured in the environment.',
    source: 'vNetwork sheet, Network column (distinct values)',
  },
  {
    name: 'Virtual Switches',
    description: 'vSwitches (standard or distributed) in the environment.',
    source: 'vNetwork sheet, Switch column (distinct values)',
  },
  {
    name: 'Adapter Types',
    description: 'Distribution of virtual NIC types (VMXNET3, E1000, etc.).',
    source: 'vNetwork sheet, Adapter Type column',
    notes: ['VMXNET3 is recommended for performance', 'E1000 is legacy and should be upgraded'],
  },
  {
    name: 'Connected vs Disconnected',
    description: 'NICs that are connected to their port group vs disconnected.',
    source: 'vNetwork sheet, Connected column',
  },
];

const clusterMetrics: MetricDefinition[] = [
  {
    name: 'HA Enabled',
    description: 'High Availability status for each cluster.',
    source: 'vCluster sheet, HA Enabled column',
    notes: ['HA provides VM restart on host failure', 'Recommended for production workloads'],
  },
  {
    name: 'DRS Enabled',
    description: 'Distributed Resource Scheduler status.',
    source: 'vCluster sheet, DRS Enabled column',
    notes: ['DRS provides automatic load balancing', 'DRS behavior determines automation level'],
  },
  {
    name: 'EVC Mode',
    description: 'Enhanced vMotion Compatibility mode for CPU compatibility.',
    source: 'vCluster sheet, EVC Mode column',
    notes: ['Ensures vMotion compatibility across different CPU generations'],
  },
  {
    name: 'Effective Hosts',
    description: 'Number of hosts actively participating in cluster resources.',
    source: 'vCluster sheet, NumEffectiveHosts column',
  },
  {
    name: 'Total CPU (GHz)',
    description: 'Aggregate CPU capacity of all hosts in the cluster.',
    formula: 'TotalCpu / 1000 (MHz to GHz)',
    source: 'vCluster sheet, TotalCpu column',
  },
  {
    name: 'Effective CPU',
    description: 'CPU capacity available after HA reservations.',
    source: 'vCluster sheet, Effective CPU column',
  },
];

const configMetrics: MetricDefinition[] = [
  {
    name: 'Hardware Version',
    description: 'VMware virtual hardware version for each VM.',
    source: 'vInfo sheet, HW Version column',
    notes: [
      `Minimum required: v${HW_VERSION_MINIMUM}`,
      `Recommended: v${HW_VERSION_RECOMMENDED} or higher`,
      'Older versions may lack features required for migration',
    ],
  },
  {
    name: 'VMware Tools Status',
    description: 'Installation and running state of VMware Tools.',
    source: 'vTools sheet, Tools Status column',
    notes: [
      'toolsOk: Installed and current',
      'toolsOld: Installed but outdated',
      'toolsNotRunning: Installed but not running',
      'toolsNotInstalled: Not installed (migration blocker)',
    ],
  },
  {
    name: 'Snapshot Age',
    description: 'Age of VM snapshots in days.',
    source: 'vSnapshot sheet, calculated from Create Date',
    notes: [
      `Warning threshold: >${SNAPSHOT_WARNING_AGE_DAYS} days`,
      `Blocker threshold: >${SNAPSHOT_BLOCKER_AGE_DAYS} days`,
      'Old snapshots should be consolidated before migration',
    ],
  },
  {
    name: 'CD-ROM Connected',
    description: 'VMs with CD/DVD drives connected to ISO or physical media.',
    source: 'vCD sheet, Connected column',
    notes: ['Connected CD-ROMs should be disconnected before migration'],
  },
  {
    name: 'Consolidation Needed',
    description: 'VMs that require disk consolidation due to snapshot chains.',
    source: 'vInfo sheet, Consolidation Needed column',
    notes: ['Must be resolved before migration to avoid data issues'],
  },
];

export function DocumentationPage() {
  return (
    <div className="documentation-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="documentation-page__title">Documentation</h1>
          <p className="documentation-page__subtitle">
            Detailed explanations of metrics, formulas, and definitions used in this tool
          </p>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <Tile className="documentation-page__overview-tile">
            <h2>Data Sources</h2>
            <p>
              This tool analyzes data exported from RVTools, a utility that collects
              comprehensive information from VMware vSphere environments. The following
              RVTools sheets are used:
            </p>
            <UnorderedList>
              <ListItem><strong>vInfo</strong> - Virtual machine inventory and configuration</ListItem>
              <ListItem><strong>vCPU</strong> - CPU allocation and reservations</ListItem>
              <ListItem><strong>vMemory</strong> - Memory allocation details</ListItem>
              <ListItem><strong>vDisk</strong> - Virtual disk information</ListItem>
              <ListItem><strong>vNetwork</strong> - Network adapter configuration</ListItem>
              <ListItem><strong>vHost</strong> - ESXi host inventory</ListItem>
              <ListItem><strong>vCluster</strong> - Cluster configuration</ListItem>
              <ListItem><strong>vDatastore</strong> - Storage datastore info</ListItem>
              <ListItem><strong>vSnapshot</strong> - VM snapshot details</ListItem>
              <ListItem><strong>vTools</strong> - VMware Tools status</ListItem>
              <ListItem><strong>vCD</strong> - CD/DVD drive configuration</ListItem>
              <ListItem><strong>vRP</strong> - Resource pool hierarchy</ListItem>
              <ListItem><strong>vSource</strong> - vCenter server information</ListItem>
            </UnorderedList>
          </Tile>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <Accordion>
            <AccordionItem title="Dashboard Metrics">
              <div className="documentation-page__section">
                {dashboardMetrics.map((metric, idx) => (
                  <MetricCard key={idx} metric={metric} />
                ))}
              </div>
            </AccordionItem>

            <AccordionItem title="Compute Metrics">
              <div className="documentation-page__section">
                {computeMetrics.map((metric, idx) => (
                  <MetricCard key={idx} metric={metric} />
                ))}
              </div>
            </AccordionItem>

            <AccordionItem title="Storage Metrics">
              <div className="documentation-page__section">
                {storageMetrics.map((metric, idx) => (
                  <MetricCard key={idx} metric={metric} />
                ))}
              </div>
            </AccordionItem>

            <AccordionItem title="Network Metrics">
              <div className="documentation-page__section">
                {networkMetrics.map((metric, idx) => (
                  <MetricCard key={idx} metric={metric} />
                ))}
              </div>
            </AccordionItem>

            <AccordionItem title="Cluster Metrics">
              <div className="documentation-page__section">
                {clusterMetrics.map((metric, idx) => (
                  <MetricCard key={idx} metric={metric} />
                ))}
              </div>
            </AccordionItem>

            <AccordionItem title="Configuration Analysis">
              <div className="documentation-page__section">
                {configMetrics.map((metric, idx) => (
                  <MetricCard key={idx} metric={metric} />
                ))}
              </div>
            </AccordionItem>

            <AccordionItem title="Migration Readiness Checks">
              <div className="documentation-page__section">
                <Tile className="documentation-page__metric-card">
                  <h4>Pre-Flight Check Categories</h4>
                  <p>VMs are evaluated against the following criteria for migration readiness:</p>
                  <UnorderedList>
                    <ListItem>
                      <strong>VMware Tools</strong> - Must be installed and running for quiesced snapshots
                    </ListItem>
                    <ListItem>
                      <strong>Hardware Version</strong> - Minimum v{HW_VERSION_MINIMUM} required, v{HW_VERSION_RECOMMENDED}+ recommended
                    </ListItem>
                    <ListItem>
                      <strong>Snapshots</strong> - Old snapshots (&gt;{SNAPSHOT_BLOCKER_AGE_DAYS} days) are blockers
                    </ListItem>
                    <ListItem>
                      <strong>RDM Disks</strong> - Raw Device Mapped disks require special handling
                    </ListItem>
                    <ListItem>
                      <strong>Shared Disks</strong> - Multi-writer or cluster disks need planning
                    </ListItem>
                    <ListItem>
                      <strong>CD-ROM</strong> - Connected CD/DVD drives should be disconnected
                    </ListItem>
                    <ListItem>
                      <strong>OS Compatibility</strong> - Guest OS must be supported on target platform
                    </ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="documentation-page__metric-card">
                  <h4>Readiness Status</h4>
                  <div className="documentation-page__status-list">
                    <div className="documentation-page__status-item">
                      <Tag type="green">Ready</Tag>
                      <span>VM passes all checks and can be migrated</span>
                    </div>
                    <div className="documentation-page__status-item">
                      <Tag type="high-contrast">Needs Prep</Tag>
                      <span>VM has warnings that should be addressed</span>
                    </div>
                    <div className="documentation-page__status-item">
                      <Tag type="red">Blocker</Tag>
                      <span>VM has issues that must be resolved before migration</span>
                    </div>
                  </div>
                </Tile>
              </div>
            </AccordionItem>

            <AccordionItem title="Wave Planning">
              <div className="documentation-page__section">
                <Tile className="documentation-page__metric-card">
                  <h4>Grouping Methods</h4>
                  <UnorderedList>
                    <ListItem>
                      <strong>Cluster-based</strong> - Groups VMs by their VMware cluster for coordinated migration
                    </ListItem>
                    <ListItem>
                      <strong>Port Group</strong> - Groups VMs by network port group for network-aware migration
                    </ListItem>
                    <ListItem>
                      <strong>Port Group Prefix</strong> - Groups by first N characters of port group name
                    </ListItem>
                    <ListItem>
                      <strong>IP Prefix</strong> - Groups VMs by IP subnet for network cutover planning
                    </ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="documentation-page__metric-card">
                  <h4>Complexity-based Waves</h4>
                  <UnorderedList>
                    <ListItem><strong>Wave 1: Pilot</strong> - Simple VMs with fully supported OS for validation</ListItem>
                    <ListItem><strong>Wave 2: Quick Wins</strong> - Low complexity VMs ready for migration</ListItem>
                    <ListItem><strong>Wave 3: Standard</strong> - Moderate complexity VMs</ListItem>
                    <ListItem><strong>Wave 4: Complex</strong> - High complexity VMs requiring careful planning</ListItem>
                    <ListItem><strong>Wave 5: Remediation</strong> - VMs with blockers requiring fixes first</ListItem>
                  </UnorderedList>
                </Tile>
              </div>
            </AccordionItem>
          </Accordion>
        </Column>
      </Grid>
    </div>
  );
}

// Helper component for displaying metric definitions
function MetricCard({ metric }: { metric: MetricDefinition }) {
  return (
    <Tile className="documentation-page__metric-card">
      <h4>{metric.name}</h4>
      <p>{metric.description}</p>
      {metric.formula && (
        <div className="documentation-page__formula">
          <strong>Formula:</strong> <code>{metric.formula}</code>
        </div>
      )}
      {metric.source && (
        <div className="documentation-page__source">
          <strong>Source:</strong> {metric.source}
        </div>
      )}
      {metric.notes && metric.notes.length > 0 && (
        <div className="documentation-page__notes">
          <strong>Notes:</strong>
          <UnorderedList>
            {metric.notes.map((note, idx) => (
              <ListItem key={idx}>{note}</ListItem>
            ))}
          </UnorderedList>
        </div>
      )}
    </Tile>
  );
}
