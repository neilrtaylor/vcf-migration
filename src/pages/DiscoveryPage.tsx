// Discovery page - Unified single-page layout for workload detection and VM management
import { useState, useMemo } from 'react';
import { Grid, Column, Tile, Accordion, AccordionItem, Tag, Tabs, TabList, Tab, TabPanels, TabPanel } from '@carbon/react';
import { Navigate } from 'react-router-dom';
import { useData, useVMs, useAllVMs, useVMOverrides, useAIClassification, useAutoExclusion } from '@/hooks';
import { ROUTES } from '@/utils/constants';
import { formatNumber } from '@/utils/formatters';
import { HorizontalBarChart } from '@/components/charts';
import { MetricCard } from '@/components/common';
import { DiscoveryVMTable } from '@/components/discovery';
import { NetworkSummaryTable } from '@/components/network';
import type { WorkloadMatch } from '@/components/discovery';
import { getVMIdentifier, getEnvironmentFingerprint } from '@/utils/vmIdentifier';
import workloadPatterns from '@/data/workloadPatterns.json';
import './DiscoveryPage.scss';

// Category type with description field
type CategoryDef = { name: string; icon: string; description?: string; patterns: string[] };

// Authoritative classification rule type
type AuthoritativeRule = {
  id: string;
  match: 'contains' | 'startsWith' | 'endsWith' | 'exact' | 'regex';
  patterns: string[];
  category: string;
  description?: string;
};

// Load authoritative classification rules from JSON
const authoritativeRules: AuthoritativeRule[] =
  ((workloadPatterns as Record<string, unknown>).authoritativeClassifications as { rules?: AuthoritativeRule[] })?.rules ?? [];

// Helper: find category key by display name (case-insensitive)
function findCategoryKeyByName(displayName: string): string | null {
  const categories = workloadPatterns.categories as Record<string, CategoryDef>;
  const nameLower = displayName.toLowerCase();
  for (const [key, cat] of Object.entries(categories)) {
    if (cat.name.toLowerCase() === nameLower) return key;
  }
  return null;
}

// Helper: check if a VM name matches an authoritative classification rule
function matchesAuthoritativeRule(vmName: string, rule: AuthoritativeRule): boolean {
  const nameLower = vmName.toLowerCase();
  for (const pattern of rule.patterns) {
    const patternLower = pattern.toLowerCase();
    switch (rule.match) {
      case 'startsWith':
        if (nameLower.startsWith(patternLower)) return true;
        break;
      case 'endsWith':
        if (nameLower.endsWith(patternLower)) return true;
        break;
      case 'exact':
        if (nameLower === patternLower) return true;
        break;
      case 'regex':
        if (new RegExp(pattern, 'i').test(nameLower)) return true;
        break;
      case 'contains':
      default:
        if (nameLower.includes(patternLower)) return true;
        break;
    }
  }
  return false;
}

// Detect workloads from VM names and annotations
function detectWorkloads(vms: { vmName: string; annotation: string | null }[]): WorkloadMatch[] {
  const matches: WorkloadMatch[] = [];
  const categories = workloadPatterns.categories as Record<string, CategoryDef>;

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
          break;
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

export function DiscoveryPage() {
  const { rawData } = useData();
  const vms = useVMs();
  const allVMs = useAllVMs();
  const vmOverrides = useVMOverrides();
  const { autoExclusionMap, autoExcludedCount } = useAutoExclusion();

  // Chart <-> Table category selection sync
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // AI classification - environment fingerprint for cache scoping
  const envFingerprint = useMemo(() => {
    return rawData ? getEnvironmentFingerprint(rawData) : '';
  }, [rawData]);

  // AI classification inputs (empty array when no data, so hook won't fetch)
  const aiClassificationInputs = useMemo(() => {
    if (!rawData) return [];
    return vms.filter(vm => vm.powerState === 'poweredOn').map(vm => ({
      vmName: vm.vmName,
      guestOS: vm.guestOS || undefined,
      annotation: vm.annotation || undefined,
      vCPUs: vm.cpus,
      memoryMB: vm.memory,
      diskCount: 1,
      nicCount: 1,
      powerState: vm.powerState,
    }));
  }, [rawData, vms]);

  const { classifications: aiClassifications } = useAIClassification(
    aiClassificationInputs,
    envFingerprint
  );

  // Filter out excluded VMs for analysis
  const includedVMs = useMemo(() => {
    return vms.filter(vm => {
      const vmId = getVMIdentifier(vm);
      return !vmOverrides.isExcluded(vmId);
    });
  }, [vms, vmOverrides]);

  const poweredOnVMs = useMemo(() => {
    return includedVMs.filter(vm => vm.powerState === 'poweredOn');
  }, [includedVMs]);

  // ===== WORKLOAD DETECTION =====
  const ruleBasedMatches = useMemo(() => {
    return detectWorkloads(poweredOnVMs.map(vm => ({
      vmName: vm.vmName,
      annotation: vm.annotation,
    })));
  }, [poweredOnVMs]);

  // ===== UNIFIED CLASSIFICATION MERGE (User > Maintainer > AI > Rule-based) =====
  // Precedence:
  //   1. User override (via UI) — highest priority, can override everything
  //   2. Maintainer authoritative (authoritativeClassifications in JSON) — AI cannot override
  //   3. AI classification (if available) — overrides pattern matching
  //   4. Rule-based pattern match (fallback when no AI)
  // Note: Auto-exclusion is a SEPARATE concern (managed via autoExclusionRules in JSON)
  const workloadMatches = useMemo(() => {
    const categories = workloadPatterns.categories as Record<string, CategoryDef>;
    const allMatches: WorkloadMatch[] = [];
    const classifiedVMs = new Set<string>();

    // === PASS 1: User overrides (highest priority) ===
    for (const vm of includedVMs) {
      const vmId = getVMIdentifier(vm);
      const userType = vmOverrides.getWorkloadType(vmId);
      if (!userType) continue;

      const categoryKey = findCategoryKeyByName(userType);
      if (categoryKey) {
        allMatches.push({
          vmName: vm.vmName,
          category: categoryKey,
          categoryName: categories[categoryKey].name,
          matchedPattern: `User: ${userType}`,
          source: 'user',
        });
      } else {
        allMatches.push({
          vmName: vm.vmName,
          category: '_custom',
          categoryName: userType,
          matchedPattern: `User: ${userType}`,
          source: 'user',
        });
      }
      classifiedVMs.add(vm.vmName);
    }

    // === PASS 2: Maintainer authoritative classifications (AI cannot override) ===
    for (const vm of poweredOnVMs) {
      if (classifiedVMs.has(vm.vmName)) continue;
      for (const rule of authoritativeRules) {
        if (matchesAuthoritativeRule(vm.vmName, rule)) {
          const catKey = rule.category;
          if (categories[catKey]) {
            allMatches.push({
              vmName: vm.vmName,
              category: catKey,
              categoryName: categories[catKey].name,
              matchedPattern: `Maintainer: ${rule.description || rule.id}`,
              source: 'maintainer',
            });
            classifiedVMs.add(vm.vmName);
            break; // First matching rule wins
          }
        }
      }
    }

    // === PASS 3: AI classifications (if available — overrides pattern matching) ===
    if (aiClassifications && Object.keys(aiClassifications).length > 0) {
      for (const vm of poweredOnVMs) {
        if (classifiedVMs.has(vm.vmName)) continue;
        const aiResult = aiClassifications[vm.vmName];
        if (aiResult?.source === 'ai' && aiResult.workloadType) {
          const aiCategoryKey = findCategoryKeyByName(aiResult.workloadType);
          if (aiCategoryKey) {
            allMatches.push({
              vmName: vm.vmName,
              category: aiCategoryKey,
              categoryName: categories[aiCategoryKey]?.name || aiResult.workloadType,
              matchedPattern: `AI: ${aiResult.reasoning || aiResult.workloadType}`,
              source: 'ai',
            });
            classifiedVMs.add(vm.vmName);
          }
        }
      }
    }

    // === PASS 4: Rule-based detection (fallback when AI not available or didn't classify) ===
    for (const match of ruleBasedMatches) {
      if (!classifiedVMs.has(match.vmName)) {
        allMatches.push(match);
        classifiedVMs.add(match.vmName);
      }
    }

    return allMatches;
  }, [includedVMs, poweredOnVMs, vmOverrides, aiClassifications, ruleBasedMatches]);

  // Group by category (exclude _custom pseudo-category)
  const workloadsByCategory = useMemo(() => {
    return workloadMatches.reduce((acc, match) => {
      if (match.category === '_custom') return acc;
      if (!acc[match.category]) {
        acc[match.category] = { name: match.categoryName, vms: new Set<string>() };
      }
      acc[match.category].vms.add(match.vmName);
      return acc;
    }, {} as Record<string, { name: string; vms: Set<string> }>);
  }, [workloadMatches]);

  const workloadChartData = useMemo(() => {
    return Object.entries(workloadsByCategory)
      .map(([, data]) => ({
        label: data.name,
        value: data.vms.size,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [workloadsByCategory]);

  // ===== SUMMARY METRICS =====
  const totalClassifiedVMs = useMemo(() => {
    const classified = new Set<string>();
    for (const m of workloadMatches) classified.add(m.vmName);
    return classified.size;
  }, [workloadMatches]);

  const workloadCategories = useMemo(() => {
    return Object.keys(workloadsByCategory).length;
  }, [workloadsByCategory]);

  const unclassifiedCount = useMemo(() => {
    const classifiedNames = new Set(workloadMatches.map(m => m.vmName));
    return allVMs.filter(vm => !classifiedNames.has(vm.vmName)).length;
  }, [allVMs, workloadMatches]);

  const includedVMCount = useMemo(() => {
    return allVMs.filter(vm => {
      const vmId = getVMIdentifier(vm);
      const autoResult = autoExclusionMap.get(vmId);
      return !vmOverrides.isEffectivelyExcluded(vmId, autoResult?.isAutoExcluded ?? false);
    }).length;
  }, [allVMs, vmOverrides, autoExclusionMap]);

  const totalExcludedCount = useMemo(() => {
    return autoExcludedCount + vmOverrides.excludedCount;
  }, [autoExcludedCount, vmOverrides.excludedCount]);

  // Early return AFTER all hooks have been called
  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  // Get patterns for display
  const categories = workloadPatterns.categories as Record<string, CategoryDef>;

  // Helper: find category key from chart label
  function findCategoryKeyByLabel(label: string): string | null {
    for (const [key, data] of Object.entries(workloadsByCategory)) {
      if (data.name === label) return key;
    }
    return null;
  }

  // Get description for selected category
  const selectedCategoryInfo = selectedCategory && selectedCategory !== '_unclassified'
    ? categories[selectedCategory]
    : null;

  return (
    <div className="discovery-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="discovery-page__title">Discovery</h1>
          <p className="discovery-page__subtitle">
            Explore workload types, manage migration scope, and analyze network configuration.
          </p>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <Tabs>
            <TabList aria-label="Discovery tabs" contained>
              <Tab>Workload</Tab>
              <Tab>Networks</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                <Grid className="discovery-page__tab-content">

        {/* Metric Cards Row */}
        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Total VMs"
            value={formatNumber(allVMs.length)}
            detail={totalExcludedCount > 0 ? `${formatNumber(totalExcludedCount)} excluded` : 'All included'}
            variant="info"
            tooltip="Total VMs from the RVTools export."
          />
        </Column>
        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Classified VMs"
            value={formatNumber(totalClassifiedVMs)}
            detail={`${workloadCategories} workload types detected`}
            variant="primary"
            tooltip="VMs classified by user override, rule-based pattern matching, or AI classification."
          />
        </Column>
        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Unclassified"
            value={formatNumber(unclassifiedCount)}
            detail="Need categorization"
            variant={unclassifiedCount > 0 ? 'teal' : 'info'}
            tooltip="VMs not yet classified by any detection method. Use the table below to assign workload types."
          />
        </Column>
        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="VMs in Scope"
            value={formatNumber(includedVMCount)}
            detail={totalExcludedCount > 0 ? `${formatNumber(totalExcludedCount)} excluded` : 'All VMs included'}
            variant="primary"
            tooltip="VMs included in migration analysis (not excluded or auto-excluded)."
          />
        </Column>

        {/* Chart + Info Row */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="discovery-page__chart-tile">
            <HorizontalBarChart
              title="Detected Workloads by Type"
              subtitle={`${totalClassifiedVMs} VMs classified across ${workloadCategories} workload types`}
              data={workloadChartData}
              height={350}
              valueLabel="VMs"
              formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
              onBarClick={(label) => {
                const key = findCategoryKeyByLabel(label);
                if (key) {
                  setSelectedCategory(prev => prev === key ? null : key);
                }
              }}
            />
          </Tile>
        </Column>

        <Column lg={8} md={8} sm={4}>
          <Tile className="discovery-page__info-tile">
            {selectedCategoryInfo ? (
              <>
                <h4>{selectedCategoryInfo.name}</h4>
                {selectedCategoryInfo.description && <p>{selectedCategoryInfo.description}</p>}
                <div style={{ marginTop: '0.75rem' }}>
                  <span className="discovery-page__filters-label">Detection patterns:</span>
                  <div className="discovery-page__pattern-tags" style={{ marginTop: '0.5rem' }}>
                    {selectedCategoryInfo.patterns.map(p => (
                      <Tag key={p} type="gray" size="sm">{p}</Tag>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <h4>Workload Detection</h4>
                <p>
                  Click a bar in the chart or a workload type tile below to filter the VM table.
                  VMs are classified using a four-tier precedence:
                </p>
                <ol className="discovery-page__precedence-list">
                  <li><Tag type="cyan" size="sm">User</Tag> Manual overrides (highest priority)</li>
                  <li><Tag type="teal" size="sm">Maintainer</Tag> Authoritative classifications set in config — AI cannot override</li>
                  <li><Tag type="purple" size="sm">AI</Tag> AI classification when available</li>
                  <li><Tag type="gray" size="sm">Rule</Tag> Pattern matching fallback when no AI</li>
                </ol>
                <p style={{ marginTop: '0.75rem' }}>
                  Use the table actions to exclude/include VMs, assign workload types, or add notes.
                  Changes are saved automatically and persist across sessions.
                </p>
              </>
            )}
          </Tile>
        </Column>

        {/* Unified VM Table */}
        <Column lg={16} md={8} sm={4}>
          <DiscoveryVMTable
            vms={allVMs}
            workloadMatches={workloadMatches}
            vmOverrides={vmOverrides}
            autoExclusionMap={autoExclusionMap}
            aiClassifications={aiClassifications}
            selectedCategory={selectedCategory}
            onCategorySelect={setSelectedCategory}
            workloadsByCategory={workloadsByCategory}
          />
        </Column>

        {/* Detection Patterns accordion */}
        <Column lg={16} md={8} sm={4}>
          <Accordion>
            <AccordionItem title="Detection Patterns">
              <div className="discovery-page__patterns-grid">
                {Object.entries(categories).map(([key, cat]) => (
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
                </Grid>
              </TabPanel>
              <TabPanel>
                <div className="discovery-page__tab-content">
                  <h3 className="discovery-page__section-title">Network Summary</h3>
                  <p className="discovery-page__section-subtitle">
                    Port groups with VM counts and estimated IP subnets. Click any subnet cell to edit.
                  </p>
                  <NetworkSummaryTable networks={rawData.vNetwork} />
                </div>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Column>
      </Grid>
    </div>
  );
}
