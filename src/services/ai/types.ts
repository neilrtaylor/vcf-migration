// TypeScript interfaces for all AI service requests and responses

// ===== SHARED TYPES =====

export type AISource = 'watsonx' | 'rule-based' | 'cached';

export interface AIProxyHealthResponse {
  status: string;
  model?: string;
  projectId?: string;
}

// ===== CLASSIFICATION TYPES =====

export interface VMClassificationInput {
  vmName: string;
  guestOS?: string;
  annotation?: string;
  vCPUs: number;
  memoryMB: number;
  diskCount: number;
  nicCount: number;
  powerState?: string;
}

export interface VMClassificationResult {
  vmName: string;
  workloadType: string;
  confidence: number; // 0-1
  reasoning: string;
  alternatives: Array<{
    workloadType: string;
    confidence: number;
  }>;
  source: 'ai' | 'pattern';
}

export interface ClassificationRequest {
  vms: VMClassificationInput[];
}

export interface ClassificationResponse {
  classifications: VMClassificationResult[];
  model: string;
  processingTimeMs: number;
}

// ===== RIGHT-SIZING TYPES =====

export interface RightsizingInput {
  vmName: string;
  vCPUs: number;
  memoryMB: number;
  storageMB: number;
  workloadType?: string;
  guestOS?: string;
  powerState?: string;
  avgCpuUsage?: number;
  avgMemUsage?: number;
}

export interface ProfileRecommendation {
  vmName: string;
  recommendedProfile: string;
  reasoning: string;
  costSavingsEstimate?: string;
  alternativeProfile?: string;
  alternativeReasoning?: string;
  isOverprovisioned: boolean;
  source: 'ai' | 'rule-based';
}

export interface RightsizingRequest {
  vms: RightsizingInput[];
  availableProfiles: Array<{
    name: string;
    vcpus: number;
    memoryGiB: number;
    family: string;
  }>;
}

export interface RightsizingResponse {
  recommendations: ProfileRecommendation[];
  model: string;
  processingTimeMs: number;
}

// ===== INSIGHTS TYPES =====

export interface NetworkSummaryForAI {
  portGroup: string;
  subnet: string;
  vmCount: number;
}

export interface InsightsInput {
  totalVMs: number;
  totalExcluded: number;
  totalVCPUs: number;
  totalMemoryGiB: number;
  totalStorageTiB: number;
  clusterCount: number;
  hostCount: number;
  datastoreCount: number;
  workloadBreakdown: Record<string, number>;
  complexitySummary: {
    simple: number;
    moderate: number;
    complex: number;
    blocker: number;
  };
  blockerSummary: string[];
  networkSummary?: NetworkSummaryForAI[];
  costEstimate?: {
    monthly: number;
    annual: number;
    region: string;
  };
  migrationTarget?: 'roks' | 'vsi' | 'both';
}

export interface MigrationInsights {
  executiveSummary: string;
  riskAssessment: string;
  recommendations: string[];
  costOptimizations: string[];
  migrationStrategy: string;
  source: AISource;
}

export interface InsightsRequest {
  data: InsightsInput;
}

export interface InsightsResponse {
  insights: MigrationInsights;
  model: string;
  processingTimeMs: number;
}

// ===== CHAT TYPES =====

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatContext {
  summary: {
    totalVMs: number;
    totalExcluded: number;
    totalVCPUs: number;
    totalMemoryGiB: number;
    totalStorageTiB: number;
    clusterCount: number;
    hostCount: number;
    datastoreCount: number;
  };
  workloadBreakdown: Record<string, number>;
  complexitySummary: {
    simple: number;
    moderate: number;
    complex: number;
    blocker: number;
  };
  blockerSummary: string[];
  costEstimate?: {
    monthly: number;
    annual: number;
    region: string;
  };
  currentPage: string;
}

export interface ChatRequest {
  message: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  context?: ChatContext;
}

export interface ChatResponse {
  response: string;
  suggestedFollowUps?: string[];
  model: string;
  processingTimeMs: number;
}

// ===== WAVE SUGGESTIONS TYPES =====

export interface WaveSuggestionInput {
  waves: Array<{
    name: string;
    vmCount: number;
    totalVCPUs: number;
    totalMemoryGiB: number;
    totalStorageGiB: number;
    avgComplexity: number;
    hasBlockers: boolean;
    workloadTypes: string[];
  }>;
  totalVMs: number;
  migrationTarget: 'roks' | 'vsi' | 'both';
}

export interface WaveSuggestionResult {
  suggestions: string[];
  riskNarratives: Array<{ waveName: string; narrative: string }>;
  dependencyWarnings: string[];
  source: AISource;
}

export interface WaveSuggestionRequest {
  data: WaveSuggestionInput;
}

export interface WaveSuggestionResponse {
  result: WaveSuggestionResult;
  model: string;
  processingTimeMs: number;
}

// ===== COST OPTIMIZATION TYPES =====

export interface CostOptimizationInput {
  vmProfiles: Array<{
    profile: string;
    count: number;
    workloadType: string;
  }>;
  totalMonthlyCost: number;
  migrationTarget: 'roks' | 'vsi' | 'both';
  region: string;
}

export interface CostOptimizationRecommendation {
  category: string;
  description: string;
  estimatedSavings: string;
  priority: 'high' | 'medium' | 'low';
}

export interface CostOptimizationResult {
  recommendations: CostOptimizationRecommendation[];
  architectureRecommendations: string[];
  source: AISource;
}

export interface CostOptimizationRequest {
  data: CostOptimizationInput;
}

export interface CostOptimizationResponse {
  result: CostOptimizationResult;
  model: string;
  processingTimeMs: number;
}

// ===== REMEDIATION TYPES =====

export interface RemediationInput {
  blockers: Array<{
    type: string;
    affectedVMCount: number;
    details: string;
  }>;
  migrationTarget: 'roks' | 'vsi';
}

export interface RemediationGuidance {
  blockerType: string;
  steps: string[];
  estimatedEffort: string;
  alternatives: string[];
}

export interface RemediationResult {
  guidance: RemediationGuidance[];
  source: AISource;
}

export interface RemediationRequest {
  data: RemediationInput;
}

export interface RemediationResponse {
  result: RemediationResult;
  model: string;
  processingTimeMs: number;
}

// ===== SETTINGS TYPES =====

export interface AISettings {
  enabled: boolean;
  consentGiven: boolean;
}

export const AI_SETTINGS_KEY = 'vcf-ai-settings';

export const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: false,
  consentGiven: false,
};
