/**
 * Auto-Exclusion Hook
 *
 * React hook wrapper around the pure auto-exclusion utility.
 * Computes the auto-exclusion map from all VMs in rawData.vInfo,
 * memoized so it only recomputes when the data changes.
 */

import { useMemo } from 'react';
import { useData } from './useData';
import { getAutoExclusionMap, NO_AUTO_EXCLUSION } from '@/utils/autoExclusion';
import type { AutoExclusionResult } from '@/utils/autoExclusion';

export interface UseAutoExclusionReturn {
  /** Map of vmId -> auto-exclusion result for all VMs */
  autoExclusionMap: Map<string, AutoExclusionResult>;
  /** Get auto-exclusion result for a specific VM by ID */
  getAutoExclusionById: (vmId: string) => AutoExclusionResult;
  /** Count of auto-excluded VMs */
  autoExcludedCount: number;
  /** Breakdown of auto-excluded VMs by reason */
  autoExcludedBreakdown: {
    templates: number;
    poweredOff: number;
    vmwareInfrastructure: number;
    windowsInfrastructure: number;
  };
}

export function useAutoExclusion(): UseAutoExclusionReturn {
  const { rawData } = useData();

  const autoExclusionMap = useMemo(() => {
    if (!rawData) return new Map<string, AutoExclusionResult>();
    return getAutoExclusionMap(rawData.vInfo);
  }, [rawData]);

  const getAutoExclusionById = useMemo(() => {
    return (vmId: string): AutoExclusionResult => {
      return autoExclusionMap.get(vmId) ?? NO_AUTO_EXCLUSION;
    };
  }, [autoExclusionMap]);

  const { autoExcludedCount, autoExcludedBreakdown } = useMemo(() => {
    let count = 0;
    let templates = 0;
    let poweredOff = 0;
    let vmwareInfrastructure = 0;
    let windowsInfrastructure = 0;

    for (const result of autoExclusionMap.values()) {
      if (result.isAutoExcluded) {
        count++;
        if (result.reasons.includes('template')) templates++;
        if (result.reasons.includes('powered-off')) poweredOff++;
        if (result.reasons.includes('vmware-infrastructure')) vmwareInfrastructure++;
        if (result.reasons.includes('windows-infrastructure')) windowsInfrastructure++;
      }
    }

    return {
      autoExcludedCount: count,
      autoExcludedBreakdown: { templates, poweredOff, vmwareInfrastructure, windowsInfrastructure },
    };
  }, [autoExclusionMap]);

  return {
    autoExclusionMap,
    getAutoExclusionById,
    autoExcludedCount,
    autoExcludedBreakdown,
  };
}
