/**
 * Subnet Overrides Hook
 *
 * Manages manual subnet assignments for network port groups.
 * When a user manually enters a subnet, it overrides the auto-guessed value.
 * Data is persisted to localStorage.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';

// ===== TYPES =====

export interface SubnetOverride {
  portGroup: string;
  subnet: string;  // CIDR notation (e.g., "10.0.1.0/24")
  modifiedAt: string;
}

export interface SubnetOverridesData {
  version: number;
  overrides: Record<string, SubnetOverride>;
  createdAt: string;
  modifiedAt: string;
}

export interface UseSubnetOverridesReturn {
  // Core operations
  overrides: Record<string, SubnetOverride>;
  setSubnet: (portGroup: string, subnet: string) => void;
  removeOverride: (portGroup: string) => void;
  clearAllOverrides: () => void;

  // Query helpers
  getSubnet: (portGroup: string) => string | undefined;
  hasOverride: (portGroup: string) => boolean;

  // Stats
  overrideCount: number;

  // Import/Export
  exportSettings: () => string;
  importSettings: (json: string) => boolean;
}

// ===== CONSTANTS =====

const STORAGE_KEY = 'vcf-subnet-overrides';
const CURRENT_VERSION = 1;

// ===== VALIDATION =====

/**
 * Validate CIDR notation
 * Accepts formats like: 10.0.1.0/24, 192.168.1.0/16
 */
export function isValidCIDR(subnet: string): boolean {
  if (!subnet || typeof subnet !== 'string') return false;

  // Match IPv4 CIDR format
  const cidrRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/;
  const match = subnet.match(cidrRegex);

  if (!match) return false;

  // Validate each octet is 0-255
  const octets = [match[1], match[2], match[3], match[4]].map(Number);
  if (octets.some(o => o < 0 || o > 255)) return false;

  // Validate prefix length is 0-32
  const prefix = Number(match[5]);
  if (prefix < 0 || prefix > 32) return false;

  return true;
}

/**
 * Validate comma-separated list of CIDRs
 * Accepts formats like: "10.0.1.0/24" or "10.0.1.0/24, 10.0.2.0/24"
 * Rejects trailing/leading commas
 */
export function isValidCIDRList(subnets: string): boolean {
  if (!subnets || typeof subnets !== 'string') return false;

  // Reject trailing/leading commas
  const trimmed = subnets.trim();
  if (trimmed.startsWith(',') || trimmed.endsWith(',')) return false;

  const cidrs = trimmed.split(',').map(s => s.trim()).filter(s => s.length > 0);
  if (cidrs.length === 0) return false;

  return cidrs.every(cidr => isValidCIDR(cidr));
}

/**
 * Parse and normalize a CIDR list string
 * Returns array of trimmed, valid CIDRs
 */
export function parseCIDRList(subnets: string): string[] {
  if (!subnets || typeof subnets !== 'string') return [];
  return subnets.split(',').map(s => s.trim()).filter(s => isValidCIDR(s));
}

// ===== HELPER FUNCTIONS =====

function loadFromStorage(): SubnetOverridesData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object' && parsed.version && parsed.overrides) {
        return parsed as SubnetOverridesData;
      }
    }
  } catch (error) {
    console.warn('[SubnetOverrides] Failed to load from storage:', error);
  }
  return null;
}

function saveToStorage(data: SubnetOverridesData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('[SubnetOverrides] Failed to save to storage:', error);
  }
}

function createEmptyData(): SubnetOverridesData {
  const now = new Date().toISOString();
  return {
    version: CURRENT_VERSION,
    overrides: {},
    createdAt: now,
    modifiedAt: now,
  };
}

// ===== HOOK =====

export function useSubnetOverrides(): UseSubnetOverridesReturn {
  // Load initial state from localStorage
  const [data, setData] = useState<SubnetOverridesData>(() => {
    const stored = loadFromStorage();
    return stored || createEmptyData();
  });

  // Persist to localStorage on changes
  useEffect(() => {
    saveToStorage(data);
  }, [data]);

  // ===== CORE OPERATIONS =====

  const setSubnet = useCallback((portGroup: string, subnet: string) => {
    // Don't save empty or invalid subnets
    if (!subnet || subnet.trim() === '') {
      // Remove the override if clearing
      setData(prev => {
        const { [portGroup]: _removed, ...rest } = prev.overrides;
        void _removed; // Silence unused variable warning
        return {
          ...prev,
          overrides: rest,
          modifiedAt: new Date().toISOString(),
        };
      });
      return;
    }

    const now = new Date().toISOString();
    setData(prev => ({
      ...prev,
      overrides: {
        ...prev.overrides,
        [portGroup]: {
          portGroup,
          subnet: subnet.trim(),
          modifiedAt: now,
        },
      },
      modifiedAt: now,
    }));
  }, []);

  const removeOverride = useCallback((portGroup: string) => {
    setData(prev => {
      const { [portGroup]: _removed, ...rest } = prev.overrides;
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

  const getSubnet = useCallback((portGroup: string): string | undefined => {
    return data.overrides[portGroup]?.subnet;
  }, [data.overrides]);

  const hasOverride = useCallback((portGroup: string): boolean => {
    return portGroup in data.overrides;
  }, [data.overrides]);

  // ===== STATS =====

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
      const imported = JSON.parse(json) as SubnetOverridesData;

      if (!imported.version || !imported.overrides) {
        console.error('[SubnetOverrides] Invalid import format');
        return false;
      }

      const now = new Date().toISOString();
      setData({
        ...imported,
        modifiedAt: now,
      });
      return true;
    } catch (error) {
      console.error('[SubnetOverrides] Failed to import settings:', error);
      return false;
    }
  }, []);

  return {
    // Core operations
    overrides: data.overrides,
    setSubnet,
    removeOverride,
    clearAllOverrides,

    // Query helpers
    getSubnet,
    hasOverride,

    // Stats
    overrideCount,

    // Import/Export
    exportSettings,
    importSettings,
  };
}

export default useSubnetOverrides;
