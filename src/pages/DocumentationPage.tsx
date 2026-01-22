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
  {
    name: 'Configuration Analysis',
    description: 'Summary of VM configuration issues displayed on the Dashboard.',
    notes: [
      'Hardware Version compliance checks',
      'VMware Tools status overview',
      'Snapshot age analysis',
      'CD-ROM connection status',
      'Consolidation requirements',
    ],
  },
];

const discoveryMetrics: MetricDefinition[] = [
  {
    name: 'Workload Discovery',
    description: 'Automated detection of application types based on VM naming patterns and configurations.',
    notes: [
      'Identifies databases (Oracle, SQL Server, MySQL, PostgreSQL)',
      'Detects web servers (Apache, IIS, Nginx)',
      'Recognizes middleware (WebSphere, JBoss, Tomcat)',
      'Flags infrastructure services (DNS, DHCP, AD)',
    ],
  },
  {
    name: 'OS Detection',
    description: 'Operating system identification from Guest OS field.',
    source: 'vInfo sheet, Guest OS column',
    notes: ['Windows versions and editions', 'Linux distributions', 'Other OS types'],
  },
  {
    name: 'Application Tiers',
    description: 'Classification of VMs into application tiers based on detected workload types.',
    notes: ['Web tier', 'Application tier', 'Database tier', 'Infrastructure'],
  },
];

const hostsMetrics: MetricDefinition[] = [
  {
    name: 'Host Inventory',
    description: 'ESXi host details including model, CPU, and memory specifications.',
    source: 'vHost sheet',
  },
  {
    name: 'CPU Model',
    description: 'Processor model and specifications for each host.',
    source: 'vHost sheet, CPU Model column',
  },
  {
    name: 'Physical Cores',
    description: 'Number of physical CPU cores per host.',
    source: 'vHost sheet, # Cores column',
  },
  {
    name: 'Host Memory',
    description: 'Total physical memory installed in each host.',
    source: 'vHost sheet, Memory column',
  },
  {
    name: 'ESXi Version',
    description: 'VMware ESXi version running on each host.',
    source: 'vHost sheet, ESX Version column',
  },
];

const resourcePoolMetrics: MetricDefinition[] = [
  {
    name: 'Resource Pool Hierarchy',
    description: 'Tree structure of resource pools showing parent-child relationships.',
    source: 'vRP sheet',
  },
  {
    name: 'CPU Reservations',
    description: 'Guaranteed CPU resources allocated to each resource pool.',
    source: 'vRP sheet, CPU Reservation column',
  },
  {
    name: 'Memory Reservations',
    description: 'Guaranteed memory resources allocated to each resource pool.',
    source: 'vRP sheet, Memory Reservation column',
  },
  {
    name: 'CPU/Memory Limits',
    description: 'Maximum resources that can be consumed by each resource pool.',
    source: 'vRP sheet, CPU Limit and Memory Limit columns',
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

            <AccordionItem title="Hosts">
              <div className="documentation-page__section">
                {hostsMetrics.map((metric, idx) => (
                  <MetricCard key={idx} metric={metric} />
                ))}
              </div>
            </AccordionItem>

            <AccordionItem title="Resource Pools">
              <div className="documentation-page__section">
                {resourcePoolMetrics.map((metric, idx) => (
                  <MetricCard key={idx} metric={metric} />
                ))}
              </div>
            </AccordionItem>

            <AccordionItem title="Workload Discovery">
              <div className="documentation-page__section">
                {discoveryMetrics.map((metric, idx) => (
                  <MetricCard key={idx} metric={metric} />
                ))}
              </div>
            </AccordionItem>

            <AccordionItem title="Configuration Checks">
              <div className="documentation-page__section">
                {configMetrics.map((metric, idx) => (
                  <MetricCard key={idx} metric={metric} />
                ))}
              </div>
            </AccordionItem>

            <AccordionItem title="Pre-Flight Report &amp; Migration Readiness">
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

            <AccordionItem title="ROKS Migration Planning">
              <div className="documentation-page__section">
                <Tile className="documentation-page__metric-card">
                  <h4>Red Hat OpenShift on IBM Cloud (ROKS)</h4>
                  <p>Plan containerized workload migrations to ROKS clusters with bare metal worker nodes.</p>
                  <UnorderedList>
                    <ListItem><strong>Compute Nodes</strong> - Bare metal servers for OpenShift worker nodes</ListItem>
                    <ListItem><strong>Storage Options</strong> - NVMe local storage or ODF (OpenShift Data Foundation)</ListItem>
                    <ListItem><strong>Profile Selection</strong> - Balanced, compute, or memory-optimized profiles</ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="documentation-page__metric-card">
                  <h4>Architecture Options</h4>
                  <UnorderedList>
                    <ListItem><strong>All-NVMe Converged</strong> - Local NVMe storage on worker nodes</ListItem>
                    <ListItem><strong>Hybrid (ODF)</strong> - Separate storage nodes with block storage</ListItem>
                  </UnorderedList>
                </Tile>
              </div>
            </AccordionItem>

            <AccordionItem title="VSI Migration Planning">
              <div className="documentation-page__section">
                <Tile className="documentation-page__metric-card">
                  <h4>Virtual Server Instances (VSI)</h4>
                  <p>Plan lift-and-shift migrations to IBM Cloud VPC Virtual Server Instances.</p>
                  <UnorderedList>
                    <ListItem><strong>Profile Matching</strong> - Automatic mapping of VM specs to VSI profiles</ListItem>
                    <ListItem><strong>Storage Sizing</strong> - Boot disk and data disk calculations</ListItem>
                    <ListItem><strong>Profile Families</strong> - Balanced (bx2), Compute (cx2), Memory (mx2)</ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="documentation-page__metric-card">
                  <h4>Storage Tiers</h4>
                  <UnorderedList>
                    <ListItem><strong>General Purpose (3 IOPS/GB)</strong> - Required for boot volumes</ListItem>
                    <ListItem><strong>5 IOPS/GB</strong> - Moderate performance workloads</ListItem>
                    <ListItem><strong>10 IOPS/GB</strong> - High performance workloads</ListItem>
                    <ListItem><strong>Custom IOPS</strong> - Configurable IOPS for specific requirements</ListItem>
                  </UnorderedList>
                </Tile>
              </div>
            </AccordionItem>

            <AccordionItem title="ODF Storage Sizing">
              <div className="documentation-page__section">
                <Tile className="documentation-page__metric-card">
                  <h4>Storage Calculation Methods</h4>
                  <p>The ROKS Sizing Calculator offers three storage calculation methods. Choose based on your migration strategy:</p>
                  <table style={{ width: '100%', marginTop: '0.5rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Method</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>RVTools Source</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>When to Use</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                        <td style={{ padding: '0.5rem' }}><strong>Disk Capacity</strong></td>
                        <td style={{ padding: '0.5rem' }}>vDisk sheet &rarr; Capacity MiB</td>
                        <td style={{ padding: '0.5rem' }}>Full disk size. Use when VMs may grow to use their full allocated capacity.</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                        <td style={{ padding: '0.5rem' }}><strong>In Use</strong> <Tag type="green" size="sm">Recommended</Tag></td>
                        <td style={{ padding: '0.5rem' }}>vInfo sheet &rarr; In Use MiB</td>
                        <td style={{ padding: '0.5rem' }}>Actual consumed storage including snapshots. Best for accurate sizing based on current usage.</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '0.5rem' }}><strong>Provisioned</strong></td>
                        <td style={{ padding: '0.5rem' }}>vInfo sheet &rarr; Provisioned MiB</td>
                        <td style={{ padding: '0.5rem' }}>Allocated capacity including thin-provisioned promises. Most conservative - use when you must guarantee space for all promised capacity.</td>
                      </tr>
                    </tbody>
                  </table>
                  <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#525252' }}>
                    <strong>Note:</strong> Provisioned storage can be 2-5× larger than In Use for thin-provisioned environments.
                    Disk Capacity reflects the actual VMDK sizes without snapshot overhead.
                  </p>
                </Tile>

                <Tile className="documentation-page__metric-card">
                  <h4>ODF Sizing Formula</h4>
                  <p>Calculate raw ODF capacity using this approach:</p>
                  <div style={{ fontFamily: 'monospace', backgroundColor: '#f4f4f4', padding: '1rem', borderRadius: '4px', marginTop: '0.5rem' }}>
                    <p><strong>Step 1:</strong> Base = In Use MiB × Replication Factor (3.2× for 3-replica)</p>
                    <p><strong>Step 2:</strong> Add headroom = Base × 1.3 (30% free space minimum)</p>
                    <p><strong>Step 3:</strong> Add growth = Result × (1 + annual rate)^years</p>
                    <p><strong>Step 4:</strong> Add virt overhead = Result × 1.15 (15% for OpenShift Virt)</p>
                  </div>
                </Tile>

                <Tile className="documentation-page__metric-card">
                  <h4>Quick Reference Formulas</h4>
                  <UnorderedList>
                    <ListItem><strong>Conservative (Production):</strong> In Use × 3.2 × 1.7</ListItem>
                    <ListItem><strong>Standard (Balanced):</strong> In Use × 3.2 × 1.5</ListItem>
                    <ListItem><strong>Aggressive (Cost-Optimized):</strong> In Use × 3.2 × 1.4</ListItem>
                  </UnorderedList>
                  <p style={{ marginTop: '0.5rem' }}><em>Add 10-15% extra for OpenShift Virtualization deployments.</em></p>
                </Tile>

                <Tile className="documentation-page__metric-card">
                  <h4>ODF Best Practices</h4>
                  <UnorderedList>
                    <ListItem><strong>Free Space:</strong> Maintain 30-40% minimum. Ceph degrades above 75-80% utilization</ListItem>
                    <ListItem><strong>Replication:</strong> 3× replication default for production (provides zone-level DR in multi-zone clusters)</ListItem>
                    <ListItem><strong>Performance:</strong> IOPS scale with disk count, not total TB. More capacity ≠ more performance</ListItem>
                    <ListItem><strong>NVMe:</strong> Strongly recommended for production workloads</ListItem>
                    <ListItem><strong>Minimum nodes:</strong> 3 nodes for ODF quorum (1 per zone in multi-zone clusters)</ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="documentation-page__metric-card">
                  <h4>OpenShift Virtualization Overhead</h4>
                  <p>Add 10-15% extra capacity for:</p>
                  <UnorderedList>
                    <ListItem>VM snapshots for backups/clones</ListItem>
                    <ListItem>Clone operations (temporary space)</ListItem>
                    <ListItem>Live migration scratch space</ListItem>
                    <ListItem>CDI import/upload operations</ListItem>
                    <ListItem>KubeVirt PVC metadata</ListItem>
                  </UnorderedList>
                </Tile>
              </div>
            </AccordionItem>

            <AccordionItem title="Cost Estimation">
              <div className="documentation-page__section">
                <Tile className="documentation-page__metric-card">
                  <h4>Pricing Features</h4>
                  <UnorderedList>
                    <ListItem><strong>Dynamic Pricing</strong> - Fetches live pricing from IBM Cloud Global Catalog API</ListItem>
                    <ListItem><strong>Static Fallback</strong> - Uses bundled pricing data when API is unavailable</ListItem>
                    <ListItem><strong>Regional Pricing</strong> - Supports all IBM Cloud VPC regions with regional multipliers</ListItem>
                    <ListItem><strong>Discount Options</strong> - On-demand, 1-year reserved, 3-year reserved pricing</ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="documentation-page__metric-card">
                  <h4>Cost Components</h4>
                  <UnorderedList>
                    <ListItem><strong>Compute</strong> - Bare metal servers or VSI instances</ListItem>
                    <ListItem><strong>Storage</strong> - Block storage volumes by tier</ListItem>
                    <ListItem><strong>Networking</strong> - Load balancers, public gateways, floating IPs</ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="documentation-page__metric-card">
                  <h4>Pricing Refresh</h4>
                  <p>The pricing status indicator shows:</p>
                  <div className="documentation-page__status-list">
                    <div className="documentation-page__status-item">
                      <Tag type="green">Live API</Tag>
                      <span>Pricing fetched from IBM Cloud Global Catalog API</span>
                    </div>
                    <div className="documentation-page__status-item">
                      <Tag type="blue">Cached</Tag>
                      <span>Using previously fetched API data (24-hour cache)</span>
                    </div>
                    <div className="documentation-page__status-item">
                      <Tag type="gray">Static</Tag>
                      <span>Using bundled pricing data</span>
                    </div>
                  </div>
                </Tile>

                <Tile className="documentation-page__metric-card">
                  <h4>Profiles Refresh</h4>
                  <p>Instance profiles (VSI and bare metal) can be refreshed from IBM Cloud APIs:</p>
                  <UnorderedList>
                    <ListItem><strong>VPC VSI API</strong> - GET /v1/instance/profiles returns all VSI profiles</ListItem>
                    <ListItem><strong>VPC Bare Metal API</strong> - GET /v1/bare_metal_server/profiles returns bare metal profiles with NVMe details</ListItem>
                    <ListItem><strong>ROKS Flavors API</strong> - GET /global/v2/getFlavors returns ROKS-supported worker node flavors</ListItem>
                  </UnorderedList>
                  <p style={{ marginTop: '1rem' }}>API Endpoints:</p>
                  <div className="documentation-page__code-block">
                    <code>VSI: https://&#123;region&#125;.iaas.cloud.ibm.com/v1/instance/profiles</code><br />
                    <code>Bare Metal: https://&#123;region&#125;.iaas.cloud.ibm.com/v1/bare_metal_server/profiles</code><br />
                    <code>ROKS: https://containers.cloud.ibm.com/global/v2/getFlavors</code>
                  </div>
                  <p style={{ marginTop: '1rem' }}>ROKS Bare Metal Profiles (with NVMe for ODF):</p>
                  <div className="documentation-page__code-block">
                    <code>bx2d.metal.96x384 - 48c/384GB, 8×3200GB NVMe</code><br />
                    <code>cx2d.metal.96x192 - 48c/192GB, 8×3200GB NVMe</code><br />
                    <code>mx2d.metal.96x768 - 48c/768GB, 8×3200GB NVMe</code>
                  </div>
                  <div className="documentation-page__status-list" style={{ marginTop: '1rem' }}>
                    <div className="documentation-page__status-item">
                      <Tag type="green">Live API</Tag>
                      <span>Profiles fetched from IBM Cloud VPC/Kubernetes APIs</span>
                    </div>
                    <div className="documentation-page__status-item">
                      <Tag type="green">Live Proxy</Tag>
                      <span>Profiles fetched via Code Engine proxy (recommended)</span>
                    </div>
                    <div className="documentation-page__status-item">
                      <Tag type="blue">Cached</Tag>
                      <span>Using previously fetched profile data (24-hour cache)</span>
                    </div>
                    <div className="documentation-page__status-item">
                      <Tag type="gray">Static</Tag>
                      <span>Using bundled profile data from ibmCloudConfig.json</span>
                    </div>
                  </div>
                </Tile>
              </div>
            </AccordionItem>

            <AccordionItem title="Data Privacy & Security">
              <div className="documentation-page__section">
                <Tile className="documentation-page__metric-card">
                  <h4>Your Data Stays Private</h4>
                  <p>
                    This application is designed with privacy as a core principle. <strong>Your infrastructure
                    data never leaves your browser.</strong>
                  </p>
                  <UnorderedList>
                    <ListItem><strong>Client-Side Processing</strong> - All RVTools file parsing happens entirely in your browser using JavaScript</ListItem>
                    <ListItem><strong>No File Uploads</strong> - Your Excel files are never sent to any server</ListItem>
                    <ListItem><strong>Local Analysis</strong> - All VM analysis, sizing calculations, and cost estimations run locally</ListItem>
                    <ListItem><strong>Direct Downloads</strong> - Generated reports (Excel, PDF, Word) are created in-browser and downloaded directly</ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="documentation-page__metric-card">
                  <h4>Data Handling Summary</h4>
                  <div className="documentation-page__status-list">
                    <div className="documentation-page__status-item">
                      <Tag type="green">RVTools Files</Tag>
                      <span>Processed in browser only, never uploaded</span>
                    </div>
                    <div className="documentation-page__status-item">
                      <Tag type="green">VM Inventory</Tag>
                      <span>Stored in browser memory during session only</span>
                    </div>
                    <div className="documentation-page__status-item">
                      <Tag type="green">Analysis Results</Tag>
                      <span>Computed locally, never transmitted</span>
                    </div>
                    <div className="documentation-page__status-item">
                      <Tag type="blue">Pricing/Profiles Cache</Tag>
                      <span>Stored in browser localStorage (clearable)</span>
                    </div>
                  </div>
                </Tile>

                <Tile className="documentation-page__metric-card">
                  <h4>IBM Cloud API Calls</h4>
                  <p>When using live pricing or profiles (via proxy or direct API):</p>
                  <UnorderedList>
                    <ListItem><strong>Public Data Only</strong> - Only fetches public catalog data (pricing, VSI profiles, bare metal specs)</ListItem>
                    <ListItem><strong>No VM Data Sent</strong> - Your infrastructure information is never transmitted to IBM Cloud</ListItem>
                    <ListItem><strong>Read-Only Queries</strong> - API calls are read-only queries to public IBM Cloud endpoints</ListItem>
                    <ListItem><strong>Proxy Isolation</strong> - Proxies only cache pricing/profile data, never user data</ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="documentation-page__metric-card">
                  <h4>No Tracking</h4>
                  <p>This application does not include:</p>
                  <UnorderedList>
                    <ListItem>Analytics services (Google Analytics, etc.)</ListItem>
                    <ListItem>User tracking or telemetry</ListItem>
                    <ListItem>Cookies for tracking purposes</ListItem>
                    <ListItem>Third-party advertising</ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="documentation-page__metric-card">
                  <h4>Local Storage</h4>
                  <p>The app uses browser localStorage to cache:</p>
                  <UnorderedList>
                    <ListItem>IBM Cloud pricing data (24-hour cache)</ListItem>
                    <ListItem>IBM Cloud profile data (24-hour cache)</ListItem>
                    <ListItem>Your custom profile overrides (persistent until cleared)</ListItem>
                  </UnorderedList>
                  <p style={{ marginTop: '0.5rem' }}>
                    You can clear this data anytime via browser settings or the app's "Clear Cache" buttons.
                  </p>
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
