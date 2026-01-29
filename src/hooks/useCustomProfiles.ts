/**
 * Custom Profile Management Hook
 *
 * Manages:
 * - Profile overrides: VM-specific profile selections that override auto-mapping
 * - Custom profiles: User-defined profiles with custom specs and pricing
 *
 * Data is persisted to localStorage for session continuity.
 */

import { useState, useCallback, useEffect } from 'react';

// ===== TYPES =====

export interface CustomProfile {
  id: string;
  name: string;
  family: 'balanced' | 'compute' | 'memory' | 'custom';
  vcpus: number;
  memoryGiB: number;
  bandwidth?: number;
  hourlyRate: number;
  monthlyRate: number;
  description?: string;
  isCustom: true;
}

export interface ProfileOverride {
  vmName: string;
  originalProfile: string;
  overrideProfile: string;
  reason?: string;
}

export interface UseCustomProfilesReturn {
  // Profile overrides (per VM)
  profileOverrides: Record<string, ProfileOverride>;
  setProfileOverride: (vmName: string, profileName: string, originalProfile: string, reason?: string) => void;
  removeProfileOverride: (vmName: string) => void;
  clearAllOverrides: () => void;
  getEffectiveProfile: (vmName: string, autoMappedProfile: string) => string;
  hasOverride: (vmName: string) => boolean;

  // Custom profiles
  customProfiles: CustomProfile[];
  addCustomProfile: (profile: Omit<CustomProfile, 'id' | 'isCustom'>) => CustomProfile;
  updateCustomProfile: (id: string, updates: Partial<CustomProfile>) => void;
  removeCustomProfile: (id: string) => void;
  getCustomProfile: (id: string) => CustomProfile | undefined;

  // All available profiles (standard + custom)
  getAllProfileNames: () => string[];

  // Persistence
  exportSettings: () => string;
  importSettings: (json: string) => boolean;
  resetAll: () => void;
}

// ===== CONSTANTS =====

const STORAGE_KEY_OVERRIDES = 'vcf-profile-overrides';
const STORAGE_KEY_CUSTOM = 'vcf-custom-profiles';
const HOURS_PER_MONTH = 730;

// Standard IBM Cloud VPC profiles for reference
const STANDARD_PROFILES = [
  // Balanced (bx2) - 1:4 ratio
  'bx2-2x8', 'bx2-4x16', 'bx2-8x32', 'bx2-16x64', 'bx2-32x128',
  'bx2-48x192', 'bx2-64x256', 'bx2-96x384', 'bx2-128x512',
  // Compute (cx2) - 1:2 ratio
  'cx2-2x4', 'cx2-4x8', 'cx2-8x16', 'cx2-16x32', 'cx2-32x64',
  'cx2-48x96', 'cx2-64x128', 'cx2-96x192', 'cx2-128x256',
  // Memory (mx2) - 1:8 ratio
  'mx2-2x16', 'mx2-4x32', 'mx2-8x64', 'mx2-16x128', 'mx2-32x256',
  'mx2-48x384', 'mx2-64x512', 'mx2-96x768', 'mx2-128x1024',
];

// ===== HELPER FUNCTIONS =====

function generateId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn(`Failed to load ${key} from storage:`, error);
  }
  return defaultValue;
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to save ${key} to storage:`, error);
  }
}

// ===== HOOK =====

export function useCustomProfiles(): UseCustomProfilesReturn {
  // State
  const [profileOverrides, setProfileOverrides] = useState<Record<string, ProfileOverride>>(() =>
    loadFromStorage(STORAGE_KEY_OVERRIDES, {})
  );

  const [customProfiles, setCustomProfiles] = useState<CustomProfile[]>(() =>
    loadFromStorage(STORAGE_KEY_CUSTOM, [])
  );

  // Persist overrides to localStorage
  useEffect(() => {
    saveToStorage(STORAGE_KEY_OVERRIDES, profileOverrides);
  }, [profileOverrides]);

  // Persist custom profiles to localStorage
  useEffect(() => {
    saveToStorage(STORAGE_KEY_CUSTOM, customProfiles);
  }, [customProfiles]);

  // ===== OVERRIDE FUNCTIONS =====

  const setProfileOverride = useCallback((
    vmName: string,
    profileName: string,
    originalProfile: string,
    reason?: string
  ) => {
    setProfileOverrides(prev => ({
      ...prev,
      [vmName]: {
        vmName,
        originalProfile,
        overrideProfile: profileName,
        reason,
      },
    }));
  }, []);

  const removeProfileOverride = useCallback((vmName: string) => {
    setProfileOverrides(prev => {
      const { [vmName]: _removed, ...rest } = prev;
      void _removed; // Silence unused variable warning
      return rest;
    });
  }, []);

  const clearAllOverrides = useCallback(() => {
    setProfileOverrides({});
  }, []);

  const getEffectiveProfile = useCallback((vmName: string, autoMappedProfile: string): string => {
    const override = profileOverrides[vmName];
    return override ? override.overrideProfile : autoMappedProfile;
  }, [profileOverrides]);

  const hasOverride = useCallback((vmName: string): boolean => {
    return vmName in profileOverrides;
  }, [profileOverrides]);

  // ===== CUSTOM PROFILE FUNCTIONS =====

  const addCustomProfile = useCallback((profile: Omit<CustomProfile, 'id' | 'isCustom'>): CustomProfile => {
    const newProfile: CustomProfile = {
      ...profile,
      id: generateId(),
      isCustom: true,
      // Calculate monthly rate if not provided
      monthlyRate: profile.monthlyRate || Math.round(profile.hourlyRate * HOURS_PER_MONTH * 100) / 100,
    };

    setCustomProfiles(prev => [...prev, newProfile]);
    return newProfile;
  }, []);

  const updateCustomProfile = useCallback((id: string, updates: Partial<CustomProfile>) => {
    setCustomProfiles(prev => prev.map(p => {
      if (p.id === id) {
        const updated = { ...p, ...updates };
        // Recalculate monthly rate if hourly changed
        if (updates.hourlyRate && !updates.monthlyRate) {
          updated.monthlyRate = Math.round(updates.hourlyRate * HOURS_PER_MONTH * 100) / 100;
        }
        return updated;
      }
      return p;
    }));
  }, []);

  const removeCustomProfile = useCallback((id: string) => {
    // Also remove any overrides using this custom profile
    const profile = customProfiles.find(p => p.id === id);
    if (profile) {
      setProfileOverrides(prev => {
        const filtered: Record<string, ProfileOverride> = {};
        for (const [vmName, override] of Object.entries(prev)) {
          if (override.overrideProfile !== profile.name) {
            filtered[vmName] = override;
          }
        }
        return filtered;
      });
    }

    setCustomProfiles(prev => prev.filter(p => p.id !== id));
  }, [customProfiles]);

  const getCustomProfile = useCallback((id: string): CustomProfile | undefined => {
    return customProfiles.find(p => p.id === id);
  }, [customProfiles]);

  // ===== UTILITY FUNCTIONS =====

  const getAllProfileNames = useCallback((): string[] => {
    const customNames = customProfiles.map(p => p.name);
    return [...STANDARD_PROFILES, ...customNames];
  }, [customProfiles]);

  const exportSettings = useCallback((): string => {
    return JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      profileOverrides,
      customProfiles,
    }, null, 2);
  }, [profileOverrides, customProfiles]);

  const importSettings = useCallback((json: string): boolean => {
    try {
      const data = JSON.parse(json);
      if (data.profileOverrides) {
        setProfileOverrides(data.profileOverrides);
      }
      if (data.customProfiles) {
        setCustomProfiles(data.customProfiles);
      }
      return true;
    } catch (error) {
      console.error('Failed to import settings:', error);
      return false;
    }
  }, []);

  const resetAll = useCallback(() => {
    setProfileOverrides({});
    setCustomProfiles([]);
    localStorage.removeItem(STORAGE_KEY_OVERRIDES);
    localStorage.removeItem(STORAGE_KEY_CUSTOM);
  }, []);

  return {
    // Overrides
    profileOverrides,
    setProfileOverride,
    removeProfileOverride,
    clearAllOverrides,
    getEffectiveProfile,
    hasOverride,

    // Custom profiles
    customProfiles,
    addCustomProfile,
    updateCustomProfile,
    removeCustomProfile,
    getCustomProfile,

    // Utilities
    getAllProfileNames,
    exportSettings,
    importSettings,
    resetAll,
  };
}

export default useCustomProfiles;
