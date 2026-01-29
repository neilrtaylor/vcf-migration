/**
 * VM Overrides Hook
 *
 * Manages VM-level customizations for migration scope:
 * - Exclude/include VMs from migration analysis
 * - Override auto-detected workload types
 * - Add user notes per VM
 *
 * Data is persisted to localStorage and synced with RVTools environment fingerprinting.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useData } from './useData';
import { getEnvironmentFingerprint, fingerprintsMatch } from '@/utils/vmIdentifier';

// ===== TYPES =====

export interface VMOverride {
  vmId: string;
  vmName: string;
  excluded: boolean;
  forceIncluded?: boolean;
  workloadType?: string;
  notes?: string;
  modifiedAt: string;
}

export interface VMOverridesData {
  version: number;
  environmentFingerprint: string;
  overrides: Record<string, VMOverride>;
  createdAt: string;
  modifiedAt: string;
}

export interface UseVMOverridesReturn {
  // Core operations
  overrides: Record<string, VMOverride>;
  setExcluded: (vmId: string, vmName: string, excluded: boolean) => void;
  setForceIncluded: (vmId: string, vmName: string, forceIncluded: boolean) => void;
  setWorkloadType: (vmId: string, vmName: string, type: string | undefined) => void;
  setNotes: (vmId: string, vmName: string, notes: string | undefined) => void;
  removeOverride: (vmId: string) => void;
  clearAllOverrides: () => void;

  // Query helpers
  isExcluded: (vmId: string) => boolean;
  isForceIncluded: (vmId: string) => boolean;
  /**
   * Three-tier exclusion resolution:
   * 1. forceIncluded override → INCLUDED
   * 2. manually excluded override → EXCLUDED
   * 3. isAutoExcluded → AUTO-EXCLUDED
   * 4. default → INCLUDED
   */
  isEffectivelyExcluded: (vmId: string, isAutoExcluded: boolean) => boolean;
  getWorkloadType: (vmId: string) => string | undefined;
  getNotes: (vmId: string) => string | undefined;
  hasOverride: (vmId: string) => boolean;

  // Bulk operations
  bulkSetExcluded: (vmIds: Array<{ vmId: string; vmName: string }>, excluded: boolean) => void;
  bulkSetForceIncluded: (vmIds: Array<{ vmId: string; vmName: string }>, forceIncluded: boolean) => void;

  // Stats
  excludedCount: number;
  forceIncludedCount: number;
  overrideCount: number;

  // Import/Export
  exportSettings: () => string;
  importSettings: (json: string) => boolean;

  // Environment sync
  environmentMismatch: boolean;
  applyMismatchedOverrides: () => void;
  clearAndReset: () => void;
  storedEnvironmentFingerprint: string | null;
}

// ===== CONSTANTS =====

const STORAGE_KEY = 'vcf-vm-overrides';
const CURRENT_VERSION = 2;

// ===== HELPER FUNCTIONS =====

function loadFromStorage(): VMOverridesData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate structure
      if (parsed && typeof parsed === 'object' && parsed.version && parsed.overrides) {
        return parsed as VMOverridesData;
      }
    }
  } catch (error) {
    console.warn('[VMOverrides] Failed to load from storage:', error);
  }
  return null;
}

function saveToStorage(data: VMOverridesData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('[VMOverrides] Failed to save to storage:', error);
  }
}

function createEmptyData(fingerprint: string): VMOverridesData {
  const now = new Date().toISOString();
  return {
    version: CURRENT_VERSION,
    environmentFingerprint: fingerprint,
    overrides: {},
    createdAt: now,
    modifiedAt: now,
  };
}

// ===== HOOK =====

export function useVMOverrides(): UseVMOverridesReturn {
  const { rawData } = useData();

  // Current environment fingerprint
  const currentFingerprint = useMemo(() => {
    if (!rawData) return '';
    return getEnvironmentFingerprint(rawData);
  }, [rawData]);

  // Load stored data
  const storedData = useMemo(() => loadFromStorage(), []);

  // State
  const [data, setData] = useState<VMOverridesData>(() => {
    if (storedData && currentFingerprint) {
      if (fingerprintsMatch(storedData.environmentFingerprint, currentFingerprint)) {
        // Same environment - use stored data
        return storedData;
      }
      // Different environment - start fresh but keep stored for comparison
      return createEmptyData(currentFingerprint);
    }
    if (currentFingerprint) {
      return createEmptyData(currentFingerprint);
    }
    // No data loaded yet
    return storedData || createEmptyData('');
  });

  // Track if there's a mismatch
  const [environmentMismatch, setEnvironmentMismatch] = useState<boolean>(() => {
    if (!storedData || !currentFingerprint) return false;
    const hasOverrides = Object.keys(storedData.overrides).length > 0;
    const mismatch = !fingerprintsMatch(storedData.environmentFingerprint, currentFingerprint);
    return hasOverrides && mismatch;
  });

  // Update fingerprint when data changes
  useEffect(() => {
    if (!currentFingerprint) return;

    const stored = loadFromStorage();
    if (!stored) {
      // No stored data - create new
      const newData = createEmptyData(currentFingerprint);
      setData(newData);
      saveToStorage(newData);
      setEnvironmentMismatch(false);
      return;
    }

    if (fingerprintsMatch(stored.environmentFingerprint, currentFingerprint)) {
      // Same environment - use stored data
      setData(stored);
      setEnvironmentMismatch(false);
    } else {
      // Different environment
      const hasOverrides = Object.keys(stored.overrides).length > 0;
      if (hasOverrides) {
        setEnvironmentMismatch(true);
        // Keep current empty state, don't auto-apply
        setData(createEmptyData(currentFingerprint));
      } else {
        // No overrides to worry about - just update fingerprint
        const newData = createEmptyData(currentFingerprint);
        setData(newData);
        saveToStorage(newData);
        setEnvironmentMismatch(false);
      }
    }
  }, [currentFingerprint]);

  // Persist to localStorage on changes
  useEffect(() => {
    if (data.environmentFingerprint) {
      saveToStorage(data);
    }
  }, [data]);

  // ===== CORE OPERATIONS =====

  const updateOverride = useCallback((
    vmId: string,
    vmName: string,
    updates: Partial<Omit<VMOverride, 'vmId' | 'vmName' | 'modifiedAt'>>
  ) => {
    setData(prev => {
      const existing = prev.overrides[vmId];
      const now = new Date().toISOString();

      // Merge with existing or create new
      // Use 'in' operator to check if key was explicitly provided (even if undefined)
      const override: VMOverride = {
        vmId,
        vmName,
        excluded: updates.excluded ?? existing?.excluded ?? false,
        forceIncluded: 'forceIncluded' in updates ? updates.forceIncluded : existing?.forceIncluded,
        workloadType: 'workloadType' in updates ? updates.workloadType : existing?.workloadType,
        notes: 'notes' in updates ? updates.notes : existing?.notes,
        modifiedAt: now,
      };

      // If all values are default, remove the override
      const isDefault = !override.excluded && !override.forceIncluded && !override.workloadType && !override.notes;
      if (isDefault && existing) {
        const { [vmId]: _removed, ...rest } = prev.overrides;
        void _removed; // Silence unused variable warning
        return {
          ...prev,
          overrides: rest,
          modifiedAt: now,
        };
      }

      if (isDefault) {
        return prev; // No change needed
      }

      return {
        ...prev,
        overrides: {
          ...prev.overrides,
          [vmId]: override,
        },
        modifiedAt: now,
      };
    });
  }, []);

  const setExcluded = useCallback((vmId: string, vmName: string, excluded: boolean) => {
    updateOverride(vmId, vmName, { excluded });
  }, [updateOverride]);

  const setForceIncluded = useCallback((vmId: string, vmName: string, forceIncluded: boolean) => {
    updateOverride(vmId, vmName, { forceIncluded: forceIncluded || undefined });
  }, [updateOverride]);

  const setWorkloadType = useCallback((vmId: string, vmName: string, type: string | undefined) => {
    updateOverride(vmId, vmName, { workloadType: type || undefined });
  }, [updateOverride]);

  const setNotes = useCallback((vmId: string, vmName: string, notes: string | undefined) => {
    updateOverride(vmId, vmName, { notes: notes || undefined });
  }, [updateOverride]);

  const removeOverride = useCallback((vmId: string) => {
    setData(prev => {
      const { [vmId]: _removed, ...rest } = prev.overrides;
      void _removed; // Silence unused variable warning
      return {
        ...prev,
        overrides: rest,
        modifiedAt: new Date().toISOString(),
      };
    });
  }, []);

  const clearAllOverrides = useCallback(() => {
    setData(prev => ({
      ...prev,
      overrides: {},
      modifiedAt: new Date().toISOString(),
    }));
  }, []);

  // ===== QUERY HELPERS =====

  const isExcluded = useCallback((vmId: string): boolean => {
    return data.overrides[vmId]?.excluded ?? false;
  }, [data.overrides]);

  const isForceIncluded = useCallback((vmId: string): boolean => {
    return data.overrides[vmId]?.forceIncluded ?? false;
  }, [data.overrides]);

  const isEffectivelyExcluded = useCallback((vmId: string, isAutoExcluded: boolean): boolean => {
    const override = data.overrides[vmId];
    // 1. User force-included → INCLUDED
    if (override?.forceIncluded) return false;
    // 2. User manually excluded → EXCLUDED
    if (override?.excluded) return true;
    // 3. Auto-exclusion rule → AUTO-EXCLUDED
    if (isAutoExcluded) return true;
    // 4. Default → INCLUDED
    return false;
  }, [data.overrides]);

  const getWorkloadType = useCallback((vmId: string): string | undefined => {
    return data.overrides[vmId]?.workloadType;
  }, [data.overrides]);

  const getNotes = useCallback((vmId: string): string | undefined => {
    return data.overrides[vmId]?.notes;
  }, [data.overrides]);

  const hasOverride = useCallback((vmId: string): boolean => {
    return vmId in data.overrides;
  }, [data.overrides]);

  // ===== BULK OPERATIONS =====

  const bulkSetExcluded = useCallback((
    vms: Array<{ vmId: string; vmName: string }>,
    excluded: boolean
  ) => {
    setData(prev => {
      const now = new Date().toISOString();
      const newOverrides = { ...prev.overrides };

      for (const { vmId, vmName } of vms) {
        const existing = newOverrides[vmId];

        if (excluded) {
          // Set as excluded
          newOverrides[vmId] = {
            vmId,
            vmName,
            excluded: true,
            workloadType: existing?.workloadType,
            notes: existing?.notes,
            modifiedAt: now,
          };
        } else {
          // Clear exclusion
          if (existing) {
            const updated = {
              ...existing,
              excluded: false,
              modifiedAt: now,
            };
            // Remove if no other overrides
            if (!updated.workloadType && !updated.notes) {
              delete newOverrides[vmId];
            } else {
              newOverrides[vmId] = updated;
            }
          }
        }
      }

      return {
        ...prev,
        overrides: newOverrides,
        modifiedAt: now,
      };
    });
  }, []);

  const bulkSetForceIncluded = useCallback((
    vms: Array<{ vmId: string; vmName: string }>,
    forceIncluded: boolean
  ) => {
    setData(prev => {
      const now = new Date().toISOString();
      const newOverrides = { ...prev.overrides };

      for (const { vmId, vmName } of vms) {
        const existing = newOverrides[vmId];

        if (forceIncluded) {
          newOverrides[vmId] = {
            vmId,
            vmName,
            excluded: existing?.excluded ?? false,
            forceIncluded: true,
            workloadType: existing?.workloadType,
            notes: existing?.notes,
            modifiedAt: now,
          };
        } else {
          // Clear force-include
          if (existing) {
            const updated = {
              ...existing,
              forceIncluded: undefined,
              modifiedAt: now,
            };
            // Remove if no other overrides
            if (!updated.excluded && !updated.workloadType && !updated.notes) {
              delete newOverrides[vmId];
            } else {
              newOverrides[vmId] = updated;
            }
          }
        }
      }

      return {
        ...prev,
        overrides: newOverrides,
        modifiedAt: now,
      };
    });
  }, []);

  // ===== STATS =====

  const excludedCount = useMemo(() => {
    return Object.values(data.overrides).filter(o => o.excluded).length;
  }, [data.overrides]);

  const forceIncludedCount = useMemo(() => {
    return Object.values(data.overrides).filter(o => o.forceIncluded).length;
  }, [data.overrides]);

  const overrideCount = useMemo(() => {
    return Object.keys(data.overrides).length;
  }, [data.overrides]);

  // ===== IMPORT/EXPORT =====

  const exportSettings = useCallback((): string => {
    return JSON.stringify({
      ...data,
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }, [data]);

  const importSettings = useCallback((json: string): boolean => {
    try {
      const imported = JSON.parse(json) as VMOverridesData;

      // Validate structure
      if (!imported.version || !imported.overrides) {
        console.error('[VMOverrides] Invalid import format');
        return false;
      }

      // Update fingerprint to current environment
      const now = new Date().toISOString();
      setData({
        ...imported,
        environmentFingerprint: currentFingerprint,
        modifiedAt: now,
      });
      setEnvironmentMismatch(false);
      return true;
    } catch (error) {
      console.error('[VMOverrides] Failed to import settings:', error);
      return false;
    }
  }, [currentFingerprint]);

  // ===== ENVIRONMENT SYNC =====

  const applyMismatchedOverrides = useCallback(() => {
    const stored = loadFromStorage();
    if (!stored) return;

    const now = new Date().toISOString();
    setData({
      ...stored,
      environmentFingerprint: currentFingerprint,
      modifiedAt: now,
    });
    setEnvironmentMismatch(false);
  }, [currentFingerprint]);

  const clearAndReset = useCallback(() => {
    const newData = createEmptyData(currentFingerprint);
    setData(newData);
    saveToStorage(newData);
    setEnvironmentMismatch(false);
  }, [currentFingerprint]);

  const storedEnvironmentFingerprint = useMemo(() => {
    const stored = loadFromStorage();
    return stored?.environmentFingerprint ?? null;
  }, []);

  return {
    // Core operations
    overrides: data.overrides,
    setExcluded,
    setForceIncluded,
    setWorkloadType,
    setNotes,
    removeOverride,
    clearAllOverrides,

    // Query helpers
    isExcluded,
    isForceIncluded,
    isEffectivelyExcluded,
    getWorkloadType,
    getNotes,
    hasOverride,

    // Bulk operations
    bulkSetExcluded,
    bulkSetForceIncluded,

    // Stats
    excludedCount,
    forceIncludedCount,
    overrideCount,

    // Import/Export
    exportSettings,
    importSettings,

    // Environment sync
    environmentMismatch,
    applyMismatchedOverrides,
    clearAndReset,
    storedEnvironmentFingerprint,
  };
}

export default useVMOverrides;
