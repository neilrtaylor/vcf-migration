// Application constants

// MTV Hardware Version Thresholds
export const HW_VERSION_MINIMUM = 10;
export const HW_VERSION_RECOMMENDED = 14;

// Snapshot age thresholds (days)
export const SNAPSHOT_WARNING_AGE_DAYS = 7;
export const SNAPSHOT_BLOCKER_AGE_DAYS = 30;

// File upload limits
export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const ACCEPTED_FILE_TYPES = ['.xlsx', '.xls'];

// Table defaults
export const DEFAULT_PAGE_SIZE = 50;
export const PAGE_SIZE_OPTIONS = [25, 50, 100, 250];

// Chart defaults
export const TOP_N_DEFAULT = 20;
export const CHART_HEIGHT = 400;

// IBM Carbon color palette for charts
export const CHART_COLORS = {
  blue: '#0f62fe',
  cyan: '#1192e8',
  teal: '#009d9a',
  green: '#24a148',
  yellow: '#f1c21b',
  orange: '#ff832b',
  red: '#da1e28',
  purple: '#8a3ffc',
  magenta: '#d02670',
  gray: '#6f6f6f',
} as const;

// Sequential color palette for bar charts
export const CHART_PALETTE = [
  CHART_COLORS.blue,
  CHART_COLORS.cyan,
  CHART_COLORS.teal,
  CHART_COLORS.green,
  CHART_COLORS.purple,
  CHART_COLORS.magenta,
  CHART_COLORS.orange,
  CHART_COLORS.yellow,
];

// Status colors
export const STATUS_COLORS = {
  success: CHART_COLORS.green,
  warning: CHART_COLORS.yellow,
  error: CHART_COLORS.red,
  info: CHART_COLORS.blue,
  neutral: CHART_COLORS.gray,
} as const;

// Power state colors
export const POWER_STATE_COLORS = {
  poweredOn: CHART_COLORS.green,
  poweredOff: CHART_COLORS.gray,
  suspended: CHART_COLORS.yellow,
} as const;

// MTV readiness colors
export const MTV_STATUS_COLORS = {
  ready: CHART_COLORS.green,
  'needs-prep': CHART_COLORS.yellow,
  blocker: CHART_COLORS.red,
} as const;

// OS compatibility status colors
export const OS_STATUS_COLORS = {
  'fully-supported': CHART_COLORS.green,
  'supported-with-caveats': CHART_COLORS.yellow,
  unsupported: CHART_COLORS.red,
} as const;

// Complexity category colors
export const COMPLEXITY_COLORS = {
  simple: CHART_COLORS.green,
  moderate: CHART_COLORS.cyan,
  complex: CHART_COLORS.orange,
  blocker: CHART_COLORS.red,
} as const;

// RVTools sheet names
export const RVTOOLS_SHEETS = {
  vInfo: 'vInfo',
  vCPU: 'vCPU',
  vMemory: 'vMemory',
  vDisk: 'vDisk',
  vPartition: 'vPartition',
  vNetwork: 'vNetwork',
  vCD: 'vCD',
  vUSB: 'vUSB',
  vSnapshot: 'vSnapshot',
  vTools: 'vTools',
  vRP: 'vRP',
  vCluster: 'vCluster',
  vHost: 'vHost',
  vDatastore: 'vDatastore',
  vHealth: 'vHealth',
  vMetaData: 'vMetaData',
} as const;

// Required sheets for basic analysis
export const REQUIRED_SHEETS = ['vInfo', 'vDisk', 'vDatastore'] as const;

// Recommended sheets for full analysis
export const RECOMMENDED_SHEETS = [
  'vInfo',
  'vCPU',
  'vMemory',
  'vDisk',
  'vPartition',
  'vNetwork',
  'vCD',
  'vSnapshot',
  'vTools',
  'vCluster',
  'vHost',
  'vDatastore',
  'vRP',
  'vSource',
] as const;

// Navigation routes
export const ROUTES = {
  home: '/',
  dashboard: '/dashboard',
  compute: '/compute',
  storage: '/storage',
  network: '/network',
  cluster: '/cluster',
  hosts: '/hosts',
  resourcePools: '/resource-pools',
  config: '/config',
  roksMigration: '/roks-migration',
  vsiMigration: '/vsi-migration',
  preflightReport: '/preflight-report',
  discovery: '/discovery',
  tables: '/tables',
  info: '/info',
  userGuide: '/user-guide',
  documentation: '/documentation',
  vsiMigrationMethods: '/vsi-migration-methods',
  mtvDocumentation: '/mtv-documentation',
  overheadReference: '/overhead-reference',
  settings: '/settings',
  about: '/about',
  chat: '/chat',
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  lastUpload: 'rvtools_last_upload',
  settings: 'rvtools_settings',
} as const;
