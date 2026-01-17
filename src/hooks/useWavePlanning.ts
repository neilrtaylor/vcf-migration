// Wave planning hook - manages migration wave organization

import { useState, useMemo, useCallback } from 'react';
import {
  type MigrationMode,
  type VMWaveData,
  type WaveGroup,
  type NetworkWaveGroup,
  type NetworkGroupBy,
  type ComplexityScore,
  buildVMWaveData,
  createComplexityWaves,
  createNetworkWaves,
  getWaveChartData,
  getWaveResources,
} from '@/services/migration';
import type { VirtualMachine, VDiskInfo, VSnapshotInfo, VToolsInfo, VNetworkInfo } from '@/types/rvtools';

export type WavePlanningMode = 'complexity' | 'network';

export interface UseWavePlanningConfig {
  mode: MigrationMode;
  vms: VirtualMachine[];
  complexityScores: ComplexityScore[];
  disks: VDiskInfo[];
  snapshots: VSnapshotInfo[];
  tools: VToolsInfo[];
  networks: VNetworkInfo[];
}

export interface UseWavePlanningReturn {
  // State
  wavePlanningMode: WavePlanningMode;
  networkGroupBy: NetworkGroupBy;

  // State setters
  setWavePlanningMode: (mode: WavePlanningMode) => void;
  setNetworkGroupBy: (groupBy: NetworkGroupBy) => void;

  // Computed data
  vmWaveData: VMWaveData[];
  complexityWaves: WaveGroup[];
  networkWaves: NetworkWaveGroup[];
  activeWaves: WaveGroup[] | NetworkWaveGroup[];
  waveChartData: Array<{ label: string; value: number }>;
  waveResources: Array<{
    name: string;
    description: string;
    vmCount: number;
    vcpus: number;
    memoryGiB: number;
    storageGiB: number;
    hasBlockers: boolean;
  }>;
}

/**
 * Hook for managing migration wave planning
 */
export function useWavePlanning(config: UseWavePlanningConfig): UseWavePlanningReturn {
  const { mode, vms, complexityScores, disks, snapshots, tools, networks } = config;

  // Wave planning state
  const [wavePlanningMode, setWavePlanningMode] = useState<WavePlanningMode>('network');
  const [networkGroupBy, setNetworkGroupBy] = useState<NetworkGroupBy>('cluster');

  // Build VM wave data with all necessary info
  const vmWaveData = useMemo(
    () => buildVMWaveData(vms, complexityScores, disks, snapshots, tools, networks, mode),
    [vms, complexityScores, disks, snapshots, tools, networks, mode]
  );

  // Create complexity-based waves
  const complexityWaves = useMemo(
    () => createComplexityWaves(vmWaveData, mode),
    [vmWaveData, mode]
  );

  // Create network-based waves
  const networkWaves = useMemo(
    () => createNetworkWaves(vmWaveData, networkGroupBy),
    [vmWaveData, networkGroupBy]
  );

  // Get active waves based on mode
  const activeWaves = useMemo(
    () => (wavePlanningMode === 'network' ? networkWaves : complexityWaves),
    [wavePlanningMode, networkWaves, complexityWaves]
  );

  // Get wave chart data
  const waveChartData = useMemo(
    () => getWaveChartData(activeWaves, wavePlanningMode === 'network'),
    [activeWaves, wavePlanningMode]
  );

  // Get wave resources
  const waveResources = useMemo(
    () => getWaveResources(activeWaves, wavePlanningMode === 'network'),
    [activeWaves, wavePlanningMode]
  );

  // Memoized setters
  const handleSetWavePlanningMode = useCallback((newMode: WavePlanningMode) => {
    setWavePlanningMode(newMode);
  }, []);

  const handleSetNetworkGroupBy = useCallback((groupBy: NetworkGroupBy) => {
    setNetworkGroupBy(groupBy);
  }, []);

  return {
    wavePlanningMode,
    networkGroupBy,
    setWavePlanningMode: handleSetWavePlanningMode,
    setNetworkGroupBy: handleSetNetworkGroupBy,
    vmWaveData,
    complexityWaves,
    networkWaves,
    activeWaves,
    waveChartData,
    waveResources,
  };
}

export default useWavePlanning;
