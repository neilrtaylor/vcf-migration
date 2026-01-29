/**
 * Auto-Exclusion Logic
 *
 * Pure utility functions that determine which VMs should be automatically
 * excluded from migration scope. All rules are maintainer-configurable
 * in workloadPatterns.json under autoExclusionRules.
 *
 * Rule types:
 * - fieldRules: Match on VM properties (e.g., template=true, powerState!=poweredOn)
 * - namePatterns: Match on VM name using contains, startsWith, endsWith, exact, or regex
 *
 * No hardcoded exclusion logic — everything is driven by the JSON config.
 */

import type { VirtualMachine } from '@/types/rvtools';
import { getVMIdentifier } from '@/utils/vmIdentifier';
import workloadPatterns from '@/data/workloadPatterns.json';

// ===== TYPES =====

export interface AutoExclusionResult {
  /** Whether this VM is auto-excluded by at least one rule */
  isAutoExcluded: boolean;
  /** List of rule IDs that matched */
  reasons: string[];
  /** Human-readable labels for each matched rule */
  labels: string[];
}

// ===== JSON CONFIG TYPES =====

interface FieldRule {
  id: string;
  label: string;
  field: string;
  operator?: 'equals' | 'notEquals';
  value: unknown;
  description?: string;
}

interface NamePatternRule {
  id: string;
  label: string;
  match: 'contains' | 'startsWith' | 'endsWith' | 'exact' | 'regex';
  patterns: string[];
  excludePatterns?: string[];
  description?: string;
}

interface AutoExclusionRulesConfig {
  fieldRules?: FieldRule[];
  namePatterns?: NamePatternRule[];
}

// ===== LOAD CONFIG =====

const rulesConfig: AutoExclusionRulesConfig =
  (workloadPatterns as Record<string, unknown>).autoExclusionRules as AutoExclusionRulesConfig ?? { fieldRules: [], namePatterns: [] };

const fieldRules: FieldRule[] = rulesConfig.fieldRules ?? [];
const namePatternRules: NamePatternRule[] = rulesConfig.namePatterns ?? [];

// Pre-compile regex patterns for performance
const compiledRegexPatterns = new Map<string, RegExp[]>();
for (const rule of namePatternRules) {
  if (rule.match === 'regex') {
    compiledRegexPatterns.set(
      rule.id,
      rule.patterns.map(p => new RegExp(p, 'i'))
    );
  }
}

// ===== MATCHING LOGIC =====

function matchesFieldRule(vm: VirtualMachine, rule: FieldRule): boolean {
  const vmValue = (vm as unknown as Record<string, unknown>)[rule.field];
  const operator = rule.operator ?? 'equals';

  if (operator === 'notEquals') {
    return vmValue !== rule.value;
  }
  return vmValue === rule.value;
}

function matchesNamePatternRule(vmName: string, rule: NamePatternRule): boolean {
  const nameLower = vmName.toLowerCase();

  // Check exclude patterns first
  if (rule.excludePatterns) {
    for (const ep of rule.excludePatterns) {
      if (nameLower.includes(ep.toLowerCase())) {
        return false;
      }
    }
  }

  if (rule.match === 'regex') {
    const regexes = compiledRegexPatterns.get(rule.id) ?? [];
    return regexes.some(re => re.test(nameLower));
  }

  for (const pattern of rule.patterns) {
    const patternLower = pattern.toLowerCase();
    switch (rule.match) {
      case 'startsWith':
        if (nameLower.startsWith(patternLower) || nameLower === patternLower) return true;
        break;
      case 'endsWith':
        if (nameLower.endsWith(patternLower)) return true;
        break;
      case 'exact':
        if (nameLower === patternLower) return true;
        break;
      case 'contains':
      default:
        if (nameLower.includes(patternLower)) return true;
        break;
    }
  }

  return false;
}

// ===== PUBLIC API =====

/**
 * Determine auto-exclusion status for a single VM.
 * All rules are loaded from workloadPatterns.json.
 */
export function getAutoExclusion(vm: VirtualMachine): AutoExclusionResult {
  const reasons: string[] = [];
  const labels: string[] = [];

  // Evaluate field rules (e.g., template=true, powerState!=poweredOn)
  for (const rule of fieldRules) {
    if (matchesFieldRule(vm, rule)) {
      reasons.push(rule.id);
      labels.push(rule.label);
    }
  }

  // Evaluate name pattern rules
  // Track labels already added to avoid duplicates (e.g., multiple VMware rules)
  const seenLabels = new Set(labels);
  for (const rule of namePatternRules) {
    if (matchesNamePatternRule(vm.vmName, rule)) {
      reasons.push(rule.id);
      if (!seenLabels.has(rule.label)) {
        labels.push(rule.label);
        seenLabels.add(rule.label);
      }
    }
  }

  return {
    isAutoExcluded: reasons.length > 0,
    reasons,
    labels,
  };
}

/**
 * Check if a VM name matches any VMware infrastructure name pattern rule.
 * This is used by export generators that need to filter out VMware infra VMs
 * without having a full VirtualMachine object.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function isVMwareInfrastructureVM(vmName: string, _guestOS?: string): boolean {
  for (const rule of namePatternRules) {
    if (rule.label === 'VMware Infrastructure' && matchesNamePatternRule(vmName, rule)) {
      return true;
    }
  }
  return false;
}

/**
 * Compute auto-exclusion for all VMs, keyed by VM identifier.
 * Returns a Map for O(1) lookups in rendering loops.
 */
export function getAutoExclusionMap(vms: VirtualMachine[]): Map<string, AutoExclusionResult> {
  const map = new Map<string, AutoExclusionResult>();
  for (const vm of vms) {
    const vmId = getVMIdentifier(vm);
    map.set(vmId, getAutoExclusion(vm));
  }
  return map;
}

/**
 * Empty auto-exclusion result (convenience constant for VMs not in the map).
 */
export const NO_AUTO_EXCLUSION: AutoExclusionResult = {
  isAutoExcluded: false,
  reasons: [],
  labels: [],
};
