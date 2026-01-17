// Unit tests for useCustomProfiles hook
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCustomProfiles } from './useCustomProfiles';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useCustomProfiles', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('profile overrides', () => {
    it('initializes with empty overrides', () => {
      const { result } = renderHook(() => useCustomProfiles());
      expect(result.current.profileOverrides).toEqual({});
    });

    it('sets a profile override', () => {
      const { result } = renderHook(() => useCustomProfiles());

      act(() => {
        result.current.setProfileOverride('test-vm', 'bx2-4x16', 'bx2-2x8', 'Need more memory');
      });

      expect(result.current.profileOverrides['test-vm']).toEqual({
        vmName: 'test-vm',
        originalProfile: 'bx2-2x8',
        overrideProfile: 'bx2-4x16',
        reason: 'Need more memory',
      });
    });

    it('removes a profile override', () => {
      const { result } = renderHook(() => useCustomProfiles());

      act(() => {
        result.current.setProfileOverride('test-vm', 'bx2-4x16', 'bx2-2x8');
      });

      expect(result.current.hasOverride('test-vm')).toBe(true);

      act(() => {
        result.current.removeProfileOverride('test-vm');
      });

      expect(result.current.hasOverride('test-vm')).toBe(false);
    });

    it('clears all overrides', () => {
      const { result } = renderHook(() => useCustomProfiles());

      act(() => {
        result.current.setProfileOverride('vm1', 'bx2-4x16', 'bx2-2x8');
        result.current.setProfileOverride('vm2', 'mx2-2x16', 'bx2-2x8');
      });

      expect(Object.keys(result.current.profileOverrides).length).toBe(2);

      act(() => {
        result.current.clearAllOverrides();
      });

      expect(result.current.profileOverrides).toEqual({});
    });

    it('returns effective profile with override', () => {
      const { result } = renderHook(() => useCustomProfiles());

      act(() => {
        result.current.setProfileOverride('test-vm', 'bx2-8x32', 'bx2-2x8');
      });

      expect(result.current.getEffectiveProfile('test-vm', 'bx2-2x8')).toBe('bx2-8x32');
    });

    it('returns auto-mapped profile when no override exists', () => {
      const { result } = renderHook(() => useCustomProfiles());
      expect(result.current.getEffectiveProfile('other-vm', 'bx2-2x8')).toBe('bx2-2x8');
    });

    it('hasOverride returns correct boolean', () => {
      const { result } = renderHook(() => useCustomProfiles());

      expect(result.current.hasOverride('test-vm')).toBe(false);

      act(() => {
        result.current.setProfileOverride('test-vm', 'bx2-4x16', 'bx2-2x8');
      });

      expect(result.current.hasOverride('test-vm')).toBe(true);
    });
  });

  describe('custom profiles', () => {
    it('initializes with empty custom profiles', () => {
      const { result } = renderHook(() => useCustomProfiles());
      expect(result.current.customProfiles).toEqual([]);
    });

    it('adds a custom profile', () => {
      const { result } = renderHook(() => useCustomProfiles());

      let addedProfile;
      act(() => {
        addedProfile = result.current.addCustomProfile({
          name: 'custom-8x64',
          family: 'custom',
          vcpus: 8,
          memoryGiB: 64,
          hourlyRate: 0.5,
          monthlyRate: 365,
          description: 'Custom profile for testing',
        });
      });

      expect(result.current.customProfiles.length).toBe(1);
      expect(result.current.customProfiles[0].name).toBe('custom-8x64');
      expect(result.current.customProfiles[0].isCustom).toBe(true);
      expect(addedProfile).toBeDefined();
    });

    it('calculates monthly rate from hourly if not provided', () => {
      const { result } = renderHook(() => useCustomProfiles());

      act(() => {
        result.current.addCustomProfile({
          name: 'test-profile',
          family: 'balanced',
          vcpus: 4,
          memoryGiB: 16,
          hourlyRate: 0.1,
          monthlyRate: 0, // Will be calculated
        });
      });

      // 0.1 * 730 = 73
      expect(result.current.customProfiles[0].monthlyRate).toBe(73);
    });

    it('updates a custom profile', () => {
      const { result } = renderHook(() => useCustomProfiles());

      let profileId: string;
      act(() => {
        const profile = result.current.addCustomProfile({
          name: 'original-name',
          family: 'balanced',
          vcpus: 4,
          memoryGiB: 16,
          hourlyRate: 0.2,
          monthlyRate: 146,
        });
        profileId = profile.id;
      });

      act(() => {
        result.current.updateCustomProfile(profileId, { name: 'updated-name', vcpus: 8 });
      });

      expect(result.current.customProfiles[0].name).toBe('updated-name');
      expect(result.current.customProfiles[0].vcpus).toBe(8);
    });

    it('recalculates monthly rate when hourly is updated', () => {
      const { result } = renderHook(() => useCustomProfiles());

      let profileId: string;
      act(() => {
        const profile = result.current.addCustomProfile({
          name: 'test',
          family: 'balanced',
          vcpus: 4,
          memoryGiB: 16,
          hourlyRate: 0.1,
          monthlyRate: 73,
        });
        profileId = profile.id;
      });

      act(() => {
        result.current.updateCustomProfile(profileId, { hourlyRate: 0.2 });
      });

      // 0.2 * 730 = 146
      expect(result.current.customProfiles[0].monthlyRate).toBe(146);
    });

    it('removes a custom profile', () => {
      const { result } = renderHook(() => useCustomProfiles());

      let profileId: string;
      act(() => {
        const profile = result.current.addCustomProfile({
          name: 'to-delete',
          family: 'balanced',
          vcpus: 2,
          memoryGiB: 8,
          hourlyRate: 0.1,
          monthlyRate: 73,
        });
        profileId = profile.id;
      });

      expect(result.current.customProfiles.length).toBe(1);

      act(() => {
        result.current.removeCustomProfile(profileId);
      });

      expect(result.current.customProfiles.length).toBe(0);
    });

    it('removes overrides when custom profile is deleted', () => {
      const { result } = renderHook(() => useCustomProfiles());

      act(() => {
        result.current.addCustomProfile({
          name: 'custom-profile',
          family: 'custom',
          vcpus: 4,
          memoryGiB: 32,
          hourlyRate: 0.3,
          monthlyRate: 219,
        });
      });

      act(() => {
        result.current.setProfileOverride('vm1', 'custom-profile', 'bx2-2x8');
        result.current.setProfileOverride('vm2', 'bx2-4x16', 'bx2-2x8');
      });

      expect(result.current.hasOverride('vm1')).toBe(true);
      expect(result.current.hasOverride('vm2')).toBe(true);

      const profileId = result.current.customProfiles[0].id;
      act(() => {
        result.current.removeCustomProfile(profileId);
      });

      // Override using the custom profile should be removed
      expect(result.current.hasOverride('vm1')).toBe(false);
      // Override using standard profile should remain
      expect(result.current.hasOverride('vm2')).toBe(true);
    });

    it('getCustomProfile returns profile by id', () => {
      const { result } = renderHook(() => useCustomProfiles());

      let profileId = '';
      act(() => {
        const profile = result.current.addCustomProfile({
          name: 'findable',
          family: 'memory',
          vcpus: 2,
          memoryGiB: 16,
          hourlyRate: 0.15,
          monthlyRate: 109.5,
        });
        profileId = profile.id;
      });

      expect(result.current.getCustomProfile(profileId)?.name).toBe('findable');
      expect(result.current.getCustomProfile('non-existent')).toBeUndefined();
    });
  });

  describe('utility functions', () => {
    it('getAllProfileNames includes standard and custom profiles', () => {
      const { result } = renderHook(() => useCustomProfiles());

      // Should include standard profiles
      const names = result.current.getAllProfileNames();
      expect(names).toContain('bx2-2x8');
      expect(names).toContain('cx2-4x8');
      expect(names).toContain('mx2-2x16');

      // Add custom profile
      act(() => {
        result.current.addCustomProfile({
          name: 'my-custom',
          family: 'custom',
          vcpus: 4,
          memoryGiB: 16,
          hourlyRate: 0.2,
          monthlyRate: 146,
        });
      });

      const updatedNames = result.current.getAllProfileNames();
      expect(updatedNames).toContain('my-custom');
    });

    it('exportSettings returns JSON string', () => {
      const { result } = renderHook(() => useCustomProfiles());

      act(() => {
        result.current.addCustomProfile({
          name: 'export-test',
          family: 'balanced',
          vcpus: 4,
          memoryGiB: 16,
          hourlyRate: 0.2,
          monthlyRate: 146,
        });
        result.current.setProfileOverride('vm1', 'bx2-4x16', 'bx2-2x8');
      });

      const exported = result.current.exportSettings();
      const parsed = JSON.parse(exported);

      expect(parsed.version).toBe(1);
      expect(parsed.exportedAt).toBeDefined();
      expect(parsed.customProfiles.length).toBe(1);
      expect(Object.keys(parsed.profileOverrides).length).toBe(1);
    });

    it('importSettings restores data from JSON', () => {
      const { result } = renderHook(() => useCustomProfiles());

      const importData = JSON.stringify({
        version: 1,
        profileOverrides: {
          'imported-vm': {
            vmName: 'imported-vm',
            originalProfile: 'bx2-2x8',
            overrideProfile: 'bx2-8x32',
          },
        },
        customProfiles: [
          {
            id: 'imported-1',
            name: 'imported-profile',
            family: 'balanced',
            vcpus: 8,
            memoryGiB: 32,
            hourlyRate: 0.4,
            monthlyRate: 292,
            isCustom: true,
          },
        ],
      });

      let success: boolean;
      act(() => {
        success = result.current.importSettings(importData);
      });

      expect(success!).toBe(true);
      expect(result.current.hasOverride('imported-vm')).toBe(true);
      expect(result.current.customProfiles.length).toBe(1);
      expect(result.current.customProfiles[0].name).toBe('imported-profile');
    });

    it('importSettings returns false for invalid JSON', () => {
      const { result } = renderHook(() => useCustomProfiles());

      let success: boolean;
      act(() => {
        success = result.current.importSettings('not valid json');
      });

      expect(success!).toBe(false);
    });

    it('resetAll clears all data', () => {
      const { result } = renderHook(() => useCustomProfiles());

      act(() => {
        result.current.addCustomProfile({
          name: 'to-clear',
          family: 'balanced',
          vcpus: 2,
          memoryGiB: 8,
          hourlyRate: 0.1,
          monthlyRate: 73,
        });
        result.current.setProfileOverride('vm1', 'bx2-4x16', 'bx2-2x8');
      });

      expect(result.current.customProfiles.length).toBe(1);
      expect(Object.keys(result.current.profileOverrides).length).toBe(1);

      act(() => {
        result.current.resetAll();
      });

      expect(result.current.customProfiles.length).toBe(0);
      expect(result.current.profileOverrides).toEqual({});
    });
  });

  describe('localStorage persistence', () => {
    it('saves overrides to localStorage', () => {
      const { result } = renderHook(() => useCustomProfiles());

      act(() => {
        result.current.setProfileOverride('persistent-vm', 'bx2-4x16', 'bx2-2x8');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'vcf-profile-overrides',
        expect.any(String)
      );

      // Find the last call to setItem with the overrides key
      const calls = localStorageMock.setItem.mock.calls as [string, string][];
      const overrideCall = calls.filter(call => call[0] === 'vcf-profile-overrides').pop();
      expect(overrideCall).toBeDefined();
      const savedData = JSON.parse(overrideCall![1]);
      expect(savedData['persistent-vm']).toBeDefined();
    });

    it('saves custom profiles to localStorage', () => {
      const { result } = renderHook(() => useCustomProfiles());

      act(() => {
        result.current.addCustomProfile({
          name: 'persistent-profile',
          family: 'balanced',
          vcpus: 4,
          memoryGiB: 16,
          hourlyRate: 0.2,
          monthlyRate: 146,
        });
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'vcf-custom-profiles',
        expect.any(String)
      );
    });

    it('loads existing data from localStorage on mount', () => {
      const existingOverrides = {
        'preloaded-vm': {
          vmName: 'preloaded-vm',
          originalProfile: 'bx2-2x8',
          overrideProfile: 'mx2-2x16',
        },
      };

      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'vcf-profile-overrides') {
          return JSON.stringify(existingOverrides);
        }
        return null;
      });

      const { result } = renderHook(() => useCustomProfiles());

      expect(result.current.profileOverrides['preloaded-vm']).toBeDefined();
    });
  });
});
