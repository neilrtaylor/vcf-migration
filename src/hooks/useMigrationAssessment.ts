// Migration assessment hook - manages complexity scoring and readiness calculations

import { useMemo } from 'react';
import {
  type MigrationMode,
  type ComplexityScore,
  type AssessmentSummary,
  calculateComplexityScores,
  getComplexityDistribution,
  getAssessmentSummary,
  calculateReadinessScore,
  getComplexityChartData,
  getTopComplexVMs,
  countByOSStatus,
} from '@/services/migration';
import type { VirtualMachine, VDiskInfo, VNetworkInfo } from '@/types/rvtools';

export interface UseMigrationAssessmentConfig {
  mode: MigrationMode;
  vms: VirtualMachine[];
  disks: VDiskInfo[];
  networks: VNetworkInfo[];
  blockerCount: number;
  warningCount: number;
}

export interface UseMigrationAssessmentReturn {
  complexityScores: ComplexityScore[];
  complexityDistribution: Record<string, number>;
  assessmentSummary: AssessmentSummary;
  readinessScore: number;
  chartData: Array<{ label: string; value: number }>;
  topComplexVMs: Array<{ label: string; value: number }>;
  osStatusCounts: Record<string, number>;
  getFilteredScores: (category: string | null) => ComplexityScore[];
  getSortedScores: (scores: ComplexityScore[]) => ComplexityScore[];
}

/**
 * Hook for managing migration complexity assessment
 */
export function useMigrationAssessment(
  config: UseMigrationAssessmentConfig
): UseMigrationAssessmentReturn {
  const { mode, vms, disks, networks, blockerCount, warningCount } = config;

  // Calculate complexity scores for all VMs
  const complexityScores = useMemo(
    () => calculateComplexityScores(vms, disks, networks, mode),
    [vms, disks, networks, mode]
  );

  // Get complexity distribution
  const complexityDistribution = useMemo(
    () => getComplexityDistribution(complexityScores),
    [complexityScores]
  );

  // Get assessment summary
  const assessmentSummary = useMemo(
    () => getAssessmentSummary(complexityScores),
    [complexityScores]
  );

  // Count by OS status
  const osStatusCounts = useMemo(
    () => countByOSStatus(vms, mode),
    [vms, mode]
  );

  // Calculate readiness score
  const readinessScore = useMemo(() => {
    const unsupportedKey = mode === 'vsi' ? 'unsupported' : 'unsupported';
    const unsupportedOSCount = osStatusCounts[unsupportedKey] || 0;
    return calculateReadinessScore(blockerCount, warningCount, unsupportedOSCount, vms.length);
  }, [blockerCount, warningCount, osStatusCounts, vms.length, mode]);

  // Get chart data
  const chartData = useMemo(
    () => getComplexityChartData(complexityDistribution),
    [complexityDistribution]
  );

  // Get top complex VMs for chart
  const topComplexVMs = useMemo(
    () => getTopComplexVMs(complexityScores, 10),
    [complexityScores]
  );

  // Filter scores by category
  const getFilteredScores = useMemo(() => {
    return (category: string | null): ComplexityScore[] => {
      if (!category) return complexityScores;
      return complexityScores.filter(cs => cs.category === category);
    };
  }, [complexityScores]);

  // Sort scores by complexity descending
  const getSortedScores = useMemo(() => {
    return (scores: ComplexityScore[]): ComplexityScore[] => {
      return [...scores].sort((a, b) => b.score - a.score);
    };
  }, []);

  return {
    complexityScores,
    complexityDistribution,
    assessmentSummary,
    readinessScore,
    chartData,
    topComplexVMs,
    osStatusCounts,
    getFilteredScores,
    getSortedScores,
  };
}

export default useMigrationAssessment;
