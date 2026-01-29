// Export hooks
export { useData, useHasData, useVMCount, usePoweredOnVMs, useTemplates, useVMs, useAllVMs, useNSXEdgeAppliances } from './useData';
export { useAutoExclusion } from './useAutoExclusion';
export type { UseAutoExclusionReturn } from './useAutoExclusion';
export { useChartFilter } from './useChartFilter';
export type { ChartFilter } from './useChartFilter';
export { useVMOverrides } from './useVMOverrides';
export type { VMOverride, VMOverridesData, UseVMOverridesReturn } from './useVMOverrides';
export { useSubnetOverrides, isValidCIDR, isValidCIDRList, parseCIDRList } from './useSubnetOverrides';
export type { SubnetOverride, SubnetOverridesData, UseSubnetOverridesReturn } from './useSubnetOverrides';

// Export hooks
export { usePDFExport } from './usePDFExport';
export type { PDFExportOptions, UsePDFExportReturn } from './usePDFExport';
export { useExcelExport } from './useExcelExport';
export type { UseExcelExportReturn } from './useExcelExport';
export { useDocxExport } from './useDocxExport';
export type { UseDocxExportReturn } from './useDocxExport';

// Dynamic pricing and profiles hooks
export { useDynamicPricing } from './useDynamicPricing';
export type { UseDynamicPricingConfig, UseDynamicPricingReturn } from './useDynamicPricing';
export { useDynamicProfiles } from './useDynamicProfiles';
export type { UseDynamicProfilesConfig, UseDynamicProfilesReturn } from './useDynamicProfiles';
export { useCustomProfiles } from './useCustomProfiles';
export type { CustomProfile, ProfileOverride, UseCustomProfilesReturn } from './useCustomProfiles';

// AI hooks
export { useAISettings } from './useAISettings';
export type { UseAISettingsReturn } from './useAISettings';
export { useAIStatus } from './useAIStatus';
export type { UseAIStatusReturn, AIProxyHealth } from './useAIStatus';
export { useAIClassification } from './useAIClassification';
export type { UseAIClassificationReturn } from './useAIClassification';
export { useAIRightsizing } from './useAIRightsizing';
export type { UseAIRightsizingReturn } from './useAIRightsizing';
export { useAIInsights } from './useAIInsights';
export type { UseAIInsightsReturn } from './useAIInsights';
export { useAIChat } from './useAIChat';
export type { UseAIChatReturn } from './useAIChat';
export { useAIWaveSuggestions } from './useAIWaveSuggestions';
export type { UseAIWaveSuggestionsReturn } from './useAIWaveSuggestions';
export { useAICostOptimization } from './useAICostOptimization';
export type { UseAICostOptimizationReturn } from './useAICostOptimization';
export { useAIRemediation } from './useAIRemediation';
export type { UseAIRemediationReturn } from './useAIRemediation';

// Migration hooks
export { useMigrationAssessment } from './useMigrationAssessment';
export type { UseMigrationAssessmentConfig, UseMigrationAssessmentReturn } from './useMigrationAssessment';
export { useWavePlanning } from './useWavePlanning';
export type { UseWavePlanningConfig, UseWavePlanningReturn, WavePlanningMode } from './useWavePlanning';
export { usePreflightChecks } from './usePreflightChecks';
export type { UsePreflightChecksConfig, UsePreflightChecksReturn } from './usePreflightChecks';
