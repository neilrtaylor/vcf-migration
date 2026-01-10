// Discovery page - Workload detection and appliance identification
import { Grid, Column, Tile, Tag, Tabs, TabList, Tab, TabPanels, TabPanel } from '@carbon/react';
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
  const networkCategory = (workloadPatterns.categories as Record<string, { name: string; patterns: string[] }>).network;
  const networkEquipment = poweredOnVMs.filter(vm => {
    const vmNameLower = vm.vmName.toLowerCase();
    return networkCategory.patterns.some(p => vmNameLower.includes(p));
  });

  // ===== SUMMARY METRICS =====
  const totalWorkloadVMs = new Set(workloadMatches.map(m => m.vmName)).size;
  const workloadCategories = Object.keys(workloadsByCategory).length;

  return (
    <div className="discovery-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="discovery-page__title">Infrastructure Discovery</h1>
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
          />
        </Column>
        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Appliances"
            value={formatNumber(uniqueAppliances)}
            detail="OVA/Virtual appliances"
            variant="purple"
          />
        </Column>
        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Network Equipment"
            value={formatNumber(networkEquipment.length)}
            detail="Cisco, F5, NSX, etc."
            variant="teal"
          />
        </Column>
        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Powered On VMs"
            value={formatNumber(poweredOnVMs.length)}
            detail="Total running VMs"
            variant="info"
          />
        </Column>

        {/* Tabs */}
        <Column lg={16} md={8} sm={4}>
          <Tabs>
            <TabList aria-label="Discovery tabs">
              <Tab>Workloads</Tab>
              <Tab>Appliances</Tab>
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
                      <h3>Detected Appliances</h3>
                      <div className="discovery-page__appliance-list">
                        {Object.entries(appliancesByType)
                          .sort((a, b) => b[1].length - a[1].length)
                          .map(([type, vms]) => (
                            <div key={type} className="discovery-page__appliance-item">
                              <span className="discovery-page__appliance-type">{type}</span>
                              <Tag type="purple">{vms.length}</Tag>
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
                      <h3>Network Equipment VMs</h3>
                      <div className="discovery-page__network-list">
                        {networkEquipment.slice(0, 20).map(vm => (
                          <div key={vm.vmName} className="discovery-page__network-item">
                            <span>{vm.vmName}</span>
                            <Tag type="teal">{vm.powerState === 'poweredOn' ? 'On' : 'Off'}</Tag>
                          </div>
                        ))}
                        {networkEquipment.length > 20 && (
                          <p className="discovery-page__more">
                            ... and {networkEquipment.length - 20} more
                          </p>
                        )}
                        {networkEquipment.length === 0 && (
                          <p className="discovery-page__empty">No network equipment detected</p>
                        )}
                      </div>
                    </Tile>
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

            </TabPanels>
          </Tabs>
        </Column>
      </Grid>
    </div>
  );
}
