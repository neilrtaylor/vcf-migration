// Migration services barrel export

// OS Compatibility
export {
  type MigrationMode,
  type VSIOSCompatibility,
  type ROKSOSCompatibility,
  type OSCompatibilityResult,
  getVSIOSCompatibility,
  getROKSOSCompatibility,
  getOSCompatibility,
  isOSBlocker,
  getNormalizedOSStatus,
  getOSCompatibilityResults,
  countByOSStatus,
} from './osCompatibility';

// Migration Assessment
export {
  type ComplexityScore,
  type AssessmentSummary,
  type VMData,
  type DiskData,
  type NetworkData,
  calculateVSIComplexityScore,
  calculateROKSComplexityScore,
  getComplexityCategory,
  calculateComplexityScores,
  getComplexityDistribution,
  getAssessmentSummary,
  calculateReadinessScore,
  getComplexityChartData,
  getTopComplexVMs,
} from './migrationAssessment';

// Wave Planning
export {
  type VMWaveData,
  type WaveGroup,
  type NetworkWaveGroup,
  type NetworkGroupBy,
  type VMInput,
  type SnapshotData,
  type ToolsData,
  buildVMWaveData,
  createComplexityWaves,
  createNetworkWaves,
  getWaveChartData,
  getWaveResources,
} from './wavePlanning';

// Remediation
export {
  VPC_BOOT_DISK_MAX_GB,
  VPC_MAX_DISKS_PER_VM,
  type PreflightCheckCounts,
  generateVSIRemediationItems,
  generateROKSRemediationItems,
  generateRemediationItems,
  countRemediationSeverity,
} from './remediation';

// VSI Profile Mapping
export {
  type VSIProfile,
  type CustomProfile,
  type VMProfileMapping,
  type ProfileFamily,
  getVSIProfiles,
  determineProfileFamily,
  mapVMToVSIProfile,
  findProfileByName,
  getProfileFamilyFromName,
  createVMProfileMappings,
  countByProfile,
  countByFamily,
  getTopProfiles,
  getFamilyChartData,
  calculateProfileTotals,
} from './vsiProfileMapping';
