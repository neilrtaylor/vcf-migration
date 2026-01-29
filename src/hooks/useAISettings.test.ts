import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAISettings, _resetSettingsForTest } from './useAISettings';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useAISettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    _resetSettingsForTest();
  });

  it('returns default settings when none stored', () => {
    const { result } = renderHook(() => useAISettings());
    expect(result.current.settings).toEqual({
      enabled: false,
      consentGiven: false,
    });
  });

  it('persists settings to localStorage', () => {
    const { result } = renderHook(() => useAISettings());

    act(() => {
      result.current.updateSettings({ enabled: true });
    });

    expect(result.current.settings.enabled).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('loads stored settings on mount', () => {
    const stored = JSON.stringify({ enabled: true, consentGiven: true });
    localStorageMock.setItem('vcf-ai-settings', stored);
    localStorageMock.getItem.mockReturnValue(stored);
    _resetSettingsForTest();

    const { result } = renderHook(() => useAISettings());
    expect(result.current.settings.enabled).toBe(true);
    expect(result.current.settings.consentGiven).toBe(true);
  });

  it('resets settings to defaults', () => {
    const { result } = renderHook(() => useAISettings());

    act(() => {
      result.current.updateSettings({ enabled: true, consentGiven: true });
    });

    expect(result.current.settings.enabled).toBe(true);

    act(() => {
      result.current.resetSettings();
    });

    expect(result.current.settings.enabled).toBe(false);
    expect(result.current.settings.consentGiven).toBe(false);
  });

  it('handles corrupted localStorage data', () => {
    localStorageMock.getItem.mockReturnValue('not-json');
    _resetSettingsForTest();

    const { result } = renderHook(() => useAISettings());
    expect(result.current.settings).toEqual({
      enabled: false,
      consentGiven: false,
    });
  });
});
