// Discovery page - Workload detection and appliance identification
import { Grid, Column, Tile, Tag, Tabs, TabList, Tab, TabPanels, TabPanel, Accordion, AccordionItem } from '@carbon/react';
import { Navigate } from 'react-router-dom';
import { useData, useVMs } from '@/hooks';
import { ROUTES } from '@/utils/constants';
import { formatNumber } from '@/utils/formatters';
import { HorizontalBarChart } from '@/components/charts';
import { MetricCard } from '@/components/common';
import workloadPatterns from '@/data/workloadPatterns.json';
import './DiscoveryPage.scss';

// Types for workload detection
interface WorkloadMatch {
  vmName: string;
  category: string;
  categoryName: string;
  matchedPattern: string;
  source: 'name' | 'annotation';
}

interface ApplianceMatch {
  vmName: string;
  matchedPattern: string;
  source: 'name' | 'annotation';
}

interface NetworkMatch {
  vmName: string;
  matchedPattern: string;
  source: 'name' | 'annotation';
  guestOS?: string;
  cpus?: number;
  memory?: number;
}

// Detect workloads from VM names and annotations
function detectWorkloads(vms: { vmName: string; annotation: string | null }[]): WorkloadMatch[] {
  const matches: WorkloadMatch[] = [];
  const categories = workloadPatterns.categories as Record<string, { name: string; patterns: string[] }>;

  for (const vm of vms) {
    const vmNameLower = vm.vmName.toLowerCase();
    const annotationLower = (vm.annotation || '').toLowerCase();

    for (const [categoryKey, category] of Object.entries(categories)) {
      for (const pattern of category.patterns) {
        if (vmNameLower.includes(pattern)) {
          matches.push({
            vmName: vm.vmName,
            category: categoryKey,
            categoryName: category.name,
            matchedPattern: pattern,
            source: 'name',
          });
          break; // Only match once per category per VM
        } else if (annotationLower.includes(pattern)) {
          matches.push({
            vmName: vm.vmName,
            category: categoryKey,
            categoryName: category.name,
            matchedPattern: pattern,
            source: 'annotation',
          });
          break;
        }
      }
    }
  }

  return matches;
}

// Detect appliances from VM names and annotations
function detectAppliances(vms: { vmName: string; annotation: string | null }[]): ApplianceMatch[] {
  const matches: ApplianceMatch[] = [];
  const applianceConfig = workloadPatterns.appliances;

  for (const vm of vms) {
    const vmNameLower = vm.vmName.toLowerCase();
    const annotationLower = (vm.annotation || '').toLowerCase();

    // Check name patterns
    for (const pattern of applianceConfig.patterns) {
      if (vmNameLower.includes(pattern)) {
        matches.push({
          vmName: vm.vmName,
          matchedPattern: pattern,
          source: 'name',
        });
        break;
      }
    }

    // Check annotation patterns
    if (!matches.find(m => m.vmName === vm.vmName)) {
      for (const pattern of applianceConfig.annotationPatterns) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(annotationLower)) {
          matches.push({
            vmName: vm.vmName,
            matchedPattern: pattern,
            source: 'annotation',
          });
          break;
        }
      }
    }
  }

  return matches;
}

// Detect network equipment from VM names and annotations
function detectNetworkEquipment(
  vms: { vmName: string; annotation: string | null; guestOS?: string; cpus?: number; memory?: number }[]
): NetworkMatch[] {
  const matches: NetworkMatch[] = [];
  const networkCategory = (workloadPatterns.categories as Record<string, { name: string; patterns: string[] }>).network;

  for (const vm of vms) {
    const vmNameLower = vm.vmName.toLowerCase();
    const annotationLower = (vm.annotation || '').toLowerCase();

    for (const pattern of networkCategory.patterns) {
      if (vmNameLower.includes(pattern)) {
        matches.push({
          vmName: vm.vmName,
          matchedPattern: pattern,
          source: 'name',
          guestOS: vm.guestOS,
          cpus: vm.cpus,
          memory: vm.memory,
        });
        break;
      } else if (annotationLower.includes(pattern)) {
        matches.push({
          vmName: vm.vmName,
          matchedPattern: pattern,
          source: 'annotation',
          guestOS: vm.guestOS,
          cpus: vm.cpus,
          memory: vm.memory,
        });
        break;
      }
    }
  }

  return matches;
}

export function DiscoveryPage() {
  const { rawData } = useData();
  const vms = useVMs();

  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  const poweredOnVMs = vms.filter(vm => vm.powerState === 'poweredOn');

  // ===== WORKLOAD DETECTION =====
  const workloadMatches = detectWorkloads(poweredOnVMs.map(vm => ({
    vmName: vm.vmName,
    annotation: vm.annotation,
  })));

  // Group by category
  const workloadsByCategory = workloadMatches.reduce((acc, match) => {
    if (!acc[match.category]) {
      acc[match.category] = { name: match.categoryName, vms: new Set<string>() };
    }
    acc[match.category].vms.add(match.vmName);
    return acc;
  }, {} as Record<string, { name: string; vms: Set<string> }>);

  const workloadChartData = Object.entries(workloadsByCategory)
    .map(([, data]) => ({
      label: data.name,
      value: data.vms.size,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // ===== APPLIANCE DETECTION =====
  const applianceMatches = detectAppliances(poweredOnVMs.map(vm => ({
    vmName: vm.vmName,
    annotation: vm.annotation,
  })));

  const uniqueAppliances = new Set(applianceMatches.map(m => m.vmName)).size;

  // Group appliances by pattern
  const appliancesByType = applianceMatches.reduce((acc, match) => {
    const type = match.matchedPattern;
    if (!acc[type]) acc[type] = [];
    acc[type].push(match.vmName);
    return acc;
  }, {} as Record<string, string[]>);

  // ===== NETWORK EQUIPMENT DETECTION =====
  const networkMatches = detectNetworkEquipment(poweredOnVMs.map(vm => ({
    vmName: vm.vmName,
    annotation: vm.annotation,
    guestOS: vm.guestOS,
    cpus: vm.cpus,
    memory: vm.memory,
  })));

  // Group network equipment by matched pattern
  const networkByType = networkMatches.reduce((acc, match) => {
    const type = match.matchedPattern;
    if (!acc[type]) acc[type] = [];
    acc[type].push(match);
    return acc;
  }, {} as Record<string, NetworkMatch[]>);

  // ===== SUMMARY METRICS =====
  const totalWorkloadVMs = new Set(workloadMatches.map(m => m.vmName)).size;
  const workloadCategories = Object.keys(workloadsByCategory).length;

  // Get patterns for display
  const categories = workloadPatterns.categories as Record<string, { name: string; patterns: string[] }>;
  const applianceConfig = workloadPatterns.appliances;

  return (
    <div className="discovery-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="discovery-page__title">Workload Discovery</h1>
          <p className="discovery-page__subtitle">
            Workload detection, appliance identification, and infrastructure insights
          </p>
        </Column>

        {/* Summary Cards */}
        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Workload VMs"
            value={formatNumber(totalWorkloadVMs)}
            detail={`${workloadCategories} categories detected`}
            variant="primary"
            tooltip="VMs identified with known workload patterns (databases, middleware, applications) by name/annotation analysis."
          />
        </Column>
        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Appliances"
            value={formatNumber(uniqueAppliances)}
            detail="OVA/Virtual appliances"
            variant="purple"
            tooltip="Virtual appliances (OVAs) detected that may require special migration handling or vendor guidance."
          />
        </Column>
        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Network Equipment"
            value={formatNumber(networkMatches.length)}
            detail={`${Object.keys(networkByType).length} types detected`}
            variant="teal"
            tooltip="Virtual network appliances (routers, load balancers, firewalls) that may need platform-specific alternatives."
          />
        </Column>
        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Powered On VMs"
            value={formatNumber(poweredOnVMs.length)}
            detail="Total running VMs"
            variant="info"
            tooltip="Total running VMs being analyzed for workload detection."
          />
        </Column>

        {/* Tabs */}
        <Column lg={16} md={8} sm={4}>
          <Tabs>
            <TabList aria-label="Discovery tabs">
              <Tab>Workloads ({totalWorkloadVMs})</Tab>
              <Tab>Appliances ({uniqueAppliances})</Tab>
              <Tab>Network Equipment ({networkMatches.length})</Tab>
            </TabList>
            <TabPanels>
              {/* Workloads Panel */}
              <TabPanel>
                <Grid className="discovery-page__tab-content">
                  <Column lg={8} md={8} sm={4}>
                    <Tile className="discovery-page__chart-tile">
                      <HorizontalBarChart
                        title="Detected Workloads by Category"
                        subtitle={`${totalWorkloadVMs} VMs with identifiable workloads`}
                        data={workloadChartData}
                        height={350}
                        valueLabel="VMs"
                        formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
                      />
                    </Tile>
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="discovery-page__list-tile">
                      <h3>Workload Categories</h3>
                      <div className="discovery-page__workload-list">
                        {Object.entries(workloadsByCategory)
                          .sort((a, b) => b[1].vms.size - a[1].vms.size)
                          .map(([key, data]) => (
                            <div key={key} className="discovery-page__workload-item">
                              <span className="discovery-page__workload-name">{data.name}</span>
                              <Tag type="blue">{data.vms.size}</Tag>
                            </div>
                          ))}
                        {Object.keys(workloadsByCategory).length === 0 && (
                          <p className="discovery-page__empty">No workloads detected from VM names</p>
                        )}
                      </div>
                    </Tile>
                  </Column>

                  {/* Detection Patterns Info */}
                  <Column lg={16} md={8} sm={4}>
                    <Accordion>
                      <AccordionItem title="Detection Patterns Used">
                        <div className="discovery-page__patterns-grid">
                          {Object.entries(categories)
                            .filter(([key]) => key !== 'network') // Network has its own tab
                            .map(([key, cat]) => (
                              <div key={key} className="discovery-page__pattern-category">
                                <h5>{cat.name}</h5>
                                <div className="discovery-page__pattern-tags">
                                  {cat.patterns.map(p => (
                                    <Tag key={p} type="gray" size="sm">{p}</Tag>
                                  ))}
                                </div>
                              </div>
                            ))}
                        </div>
                      </AccordionItem>
                    </Accordion>
                  </Column>

                  {/* Detected VMs List */}
                  <Column lg={16} md={8} sm={4}>
                    <Accordion>
                      <AccordionItem title={`Identified Workload VMs (${totalWorkloadVMs})`}>
                        <div className="discovery-page__vm-table">
                          {workloadMatches.length > 0 ? (
                            <table className="discovery-page__simple-table">
                              <thead>
                                <tr>
                                  <th>VM Name</th>
                                  <th>Category</th>
                                  <th>Matched Pattern</th>
                                  <th>Source</th>
                                </tr>
                              </thead>
                              <tbody>
                                {workloadMatches.slice(0, 100).map((match, idx) => (
                                  <tr key={`${match.vmName}-${match.category}-${idx}`}>
                                    <td>{match.vmName}</td>
                                    <td><Tag type="blue" size="sm">{match.categoryName}</Tag></td>
                                    <td><code>{match.matchedPattern}</code></td>
                                    <td>{match.source === 'name' ? 'VM Name' : 'Annotation'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="discovery-page__empty">No workload VMs detected</p>
                          )}
                          {workloadMatches.length > 100 && (
                            <p className="discovery-page__more">Showing first 100 of {workloadMatches.length} matches</p>
                          )}
                        </div>
                      </AccordionItem>
                    </Accordion>
                  </Column>

                  <Column lg={16} md={8} sm={4}>
                    <Tile className="discovery-page__info-tile">
                      <h4>Workload Detection Method</h4>
                      <p>
                        Workloads are detected by analyzing VM names and annotations for common application patterns.
                        This includes middleware (JBoss, Tomcat), databases (Oracle, PostgreSQL), enterprise apps (SAP),
                        backup solutions (Veeam), and more. Detection helps identify application dependencies
                        and plan migration priorities.
                      </p>
                    </Tile>
                  </Column>
                </Grid>
              </TabPanel>

              {/* Appliances Panel */}
              <TabPanel>
                <Grid className="discovery-page__tab-content">
                  <Column lg={8} md={8} sm={4}>
                    <Tile className="discovery-page__list-tile">
                      <h3>Detected Appliances by Type</h3>
                      <div className="discovery-page__appliance-list">
                        {Object.entries(appliancesByType)
                          .sort((a, b) => b[1].length - a[1].length)
                          .map(([type, vmList]) => (
                            <div key={type} className="discovery-page__appliance-item">
                              <span className="discovery-page__appliance-type">{type}</span>
                              <Tag type="purple">{vmList.length}</Tag>
                            </div>
                          ))}
                        {Object.keys(appliancesByType).length === 0 && (
                          <p className="discovery-page__empty">No appliances detected</p>
                        )}
                      </div>
                    </Tile>
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="discovery-page__list-tile">
                      <h3>Detection Patterns</h3>
                      <div className="discovery-page__pattern-section">
                        <h5>Name Patterns</h5>
                        <div className="discovery-page__pattern-tags">
                          {applianceConfig.patterns.map(p => (
                            <Tag key={p} type="gray" size="sm">{p}</Tag>
                          ))}
                        </div>
                        <h5>Annotation Patterns</h5>
                        <div className="discovery-page__pattern-tags">
                          {applianceConfig.annotationPatterns.map(p => (
                            <Tag key={p} type="outline" size="sm">{p}</Tag>
                          ))}
                        </div>
                      </div>
                    </Tile>
                  </Column>

                  {/* Detected Appliances List */}
                  <Column lg={16} md={8} sm={4}>
                    <Accordion>
                      <AccordionItem title={`Identified Appliance VMs (${uniqueAppliances})`}>
                        <div className="discovery-page__vm-table">
                          {applianceMatches.length > 0 ? (
                            <table className="discovery-page__simple-table">
                              <thead>
                                <tr>
                                  <th>VM Name</th>
                                  <th>Matched Pattern</th>
                                  <th>Source</th>
                                </tr>
                              </thead>
                              <tbody>
                                {applianceMatches.slice(0, 100).map((match, idx) => (
                                  <tr key={`${match.vmName}-${idx}`}>
                                    <td>{match.vmName}</td>
                                    <td><code>{match.matchedPattern}</code></td>
                                    <td>{match.source === 'name' ? 'VM Name' : 'Annotation'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="discovery-page__empty">No appliance VMs detected</p>
                          )}
                          {applianceMatches.length > 100 && (
                            <p className="discovery-page__more">Showing first 100 of {applianceMatches.length} matches</p>
                          )}
                        </div>
                      </AccordionItem>
                    </Accordion>
                  </Column>

                  <Column lg={16} md={8} sm={4}>
                    <Tile className="discovery-page__info-tile">
                      <h4>Appliance Migration Considerations</h4>
                      <p>
                        Virtual appliances (OVAs) often have vendor-specific migration requirements.
                        VMware infrastructure appliances (vCenter, NSX) typically need to be rebuilt
                        rather than migrated. Third-party appliances may have licensing or support
                        implications when moved to a new platform.
                      </p>
                    </Tile>
                  </Column>
                </Grid>
              </TabPanel>

              {/* Network Equipment Panel */}
              <TabPanel>
                <Grid className="discovery-page__tab-content">
                  <Column lg={8} md={8} sm={4}>
                    <Tile className="discovery-page__list-tile">
                      <h3>Network Equipment by Type</h3>
                      <div className="discovery-page__network-type-list">
                        {Object.entries(networkByType)
                          .sort((a, b) => b[1].length - a[1].length)
                          .map(([type, matches]) => (
                            <div key={type} className="discovery-page__network-type-item">
                              <span className="discovery-page__network-type">{type}</span>
                              <Tag type="teal">{matches.length}</Tag>
                            </div>
                          ))}
                        {Object.keys(networkByType).length === 0 && (
                          <p className="discovery-page__empty">No network equipment detected</p>
                        )}
                      </div>
                    </Tile>
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="discovery-page__list-tile">
                      <h3>Detection Patterns</h3>
                      <div className="discovery-page__pattern-section">
                        <h5>Network Equipment Patterns</h5>
                        <div className="discovery-page__pattern-tags">
                          {categories.network.patterns.map(p => (
                            <Tag key={p} type="gray" size="sm">{p}</Tag>
                          ))}
                        </div>
                      </div>
                    </Tile>
                  </Column>

                  {/* Detected Network Equipment List */}
                  <Column lg={16} md={8} sm={4}>
                    <Accordion>
                      <AccordionItem title={`Identified Network Equipment VMs (${networkMatches.length})`}>
                        <div className="discovery-page__vm-table">
                          {networkMatches.length > 0 ? (
                            <table className="discovery-page__simple-table">
                              <thead>
                                <tr>
                                  <th>VM Name</th>
                                  <th>Matched Pattern</th>
                                  <th>Guest OS</th>
                                  <th>vCPUs</th>
                                  <th>Memory (MiB)</th>
                                  <th>Source</th>
                                </tr>
                              </thead>
                              <tbody>
                                {networkMatches.slice(0, 100).map((match, idx) => (
                                  <tr key={`${match.vmName}-${idx}`}>
                                    <td>{match.vmName}</td>
                                    <td><Tag type="teal" size="sm">{match.matchedPattern}</Tag></td>
                                    <td>{match.guestOS || 'Unknown'}</td>
                                    <td>{match.cpus || '-'}</td>
                                    <td>{match.memory ? formatNumber(match.memory) : '-'}</td>
                                    <td>{match.source === 'name' ? 'VM Name' : 'Annotation'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="discovery-page__empty">No network equipment VMs detected</p>
                          )}
                          {networkMatches.length > 100 && (
                            <p className="discovery-page__more">Showing first 100 of {networkMatches.length} matches</p>
                          )}
                        </div>
                      </AccordionItem>
                    </Accordion>
                  </Column>

                  <Column lg={16} md={8} sm={4}>
                    <Tile className="discovery-page__info-tile">
                      <h4>Network Equipment Migration Considerations</h4>
                      <p>
                        Virtual network appliances (Cisco, F5, NSX, firewalls, load balancers) often require
                        platform-specific alternatives in the target environment. Consider IBM Cloud VPC
                        native services like Load Balancer for VPC, Security Groups, and Network ACLs as
                        potential replacements. Physical or dedicated appliances may be needed for complex
                        networking requirements. Vendor licensing and support should be verified for any
                        migrated virtual network appliances.
                      </p>
                    </Tile>
                  </Column>
                </Grid>
              </TabPanel>

            </TabPanels>
          </Tabs>
        </Column>
      </Grid>
    </div>
  );
}
