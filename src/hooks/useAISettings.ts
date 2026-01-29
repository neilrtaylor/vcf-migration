// AI Settings hook - manages AI feature toggle and consent
// Uses useSyncExternalStore to share state across all component instances

import { useSyncExternalStore, useCallback } from 'react';
import type { AISettings } from '@/services/ai/types';
import { AI_SETTINGS_KEY, DEFAULT_AI_SETTINGS } from '@/services/ai/types';

export interface UseAISettingsReturn {
  settings: AISettings;
  updateSettings: (updates: Partial<AISettings>) => void;
  resetSettings: () => void;
}

// ===== SHARED STORE =====

let currentSettings: AISettings = loadFromStorage();
const listeners = new Set<() => void>();

function loadFromStorage(): AISettings {
  try {
    const stored = localStorage.getItem(AI_SETTINGS_KEY);
    if (!stored) return DEFAULT_AI_SETTINGS;
    return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

function saveToStorage(settings: AISettings): void {
  try {
    localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Silently fail
  }
}

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

function getSnapshot(): AISettings {
  return currentSettings;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Sync across browser tabs via storage event
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === AI_SETTINGS_KEY) {
      currentSettings = loadFromStorage();
      notifyListeners();
    }
  });
}

/** @internal Reset shared state from localStorage — for tests only */
export function _resetSettingsForTest(): void {
  currentSettings = loadFromStorage();
  notifyListeners();
}

// ===== HOOK =====

/**
 * Hook for managing AI settings (enable/disable, consent).
 * State is shared across all component instances — updating settings
 * in one component immediately reflects in all others.
 */
export function useAISettings(): UseAISettingsReturn {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const updateSettings = useCallback((updates: Partial<AISettings>) => {
    currentSettings = { ...currentSettings, ...updates };
    saveToStorage(currentSettings);
    notifyListeners();
  }, []);

  const resetSettings = useCallback(() => {
    currentSettings = DEFAULT_AI_SETTINGS;
    saveToStorage(DEFAULT_AI_SETTINGS);
    notifyListeners();
  }, []);

  return {
    settings,
    updateSettings,
    resetSettings,
  };
}
