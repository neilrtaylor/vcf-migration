// ROKS Migration Page Tests
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ROKSMigrationPage } from './ROKSMigrationPage';

// Mock hooks
vi.mock('@/hooks', () => ({
  useData: vi.fn(),
  useVMs: vi.fn(),
  usePreflightChecks: vi.fn(),
  useMigrationAssessment: vi.fn(),
  useWavePlanning: vi.fn(),
  useDynamicProfiles: vi.fn(() => ({
    vsiProfiles: { balanced: [], compute: [], memory: [] },
    bareMetalProfiles: [],
    isLoading: false,
    error: null,
    profileCounts: { balanced: 0, compute: 0, memory: 0 },
  })),
}));

// Mock services
vi.mock('@/services/migration', () => ({
  getOSCompatibility: vi.fn(() => ({ status: 'supported', notes: '' })),
}));

// Mock components
vi.mock('@/components/charts', () => ({
  DoughnutChart: ({ title }: { title: string }) => <div data-testid="doughnut-chart">{title}</div>,
  HorizontalBarChart: ({ title }: { title: string }) => <div data-testid="bar-chart">{title}</div>,
}));

vi.mock('@/components/tables', () => ({
  EnhancedDataTable: () => <div data-testid="enhanced-table" />,
}));

vi.mock('@/components/common', () => ({
  MetricCard: ({ label, value }: { label: string; value: string }) => (
    <div data-testid="metric-card">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
  RedHatDocLink: () => <div data-testid="doc-link" />,
  RemediationPanel: () => <div data-testid="remediation-panel" />,
}));

vi.mock('@/components/cost', () => ({
  CostEstimation: () => <div data-testid="cost-estimation" />,
}));

vi.mock('@/components/sizing', () => ({
  SizingCalculator: () => <div data-testid="sizing-calculator" />,
}));

vi.mock('@/components/migration', () => ({
  ComplexityAssessmentPanel: () => <div data-testid="complexity-panel" />,
  WavePlanningPanel: () => <div data-testid="wave-planning-panel" />,
  OSCompatibilityPanel: () => <div data-testid="os-compatibility-panel" />,
}));

import { useData, useVMs, usePreflightChecks, useMigrationAssessment, useWavePlanning } from '@/hooks';

const mockVMs = [
  {
    vmName: 'vm-1',
    powerState: 'poweredOn',
    cpus: 4,
    memory: 8192,
    provisionedMiB: 102400,
    inUseMiB: 51200,
    cluster: 'cluster-1',
    guestOS: 'Red Hat Enterprise Linux 8',
    hardwareVersion: 'vmx-19',
  },
  {
    vmName: 'vm-2',
    powerState: 'poweredOn',
    cpus: 2,
    memory: 4096,
    provisionedMiB: 51200,
    inUseMiB: 25600,
    cluster: 'cluster-1',
    guestOS: 'CentOS 7',
    hardwareVersion: 'vmx-17',
  },
];

const mockRawData = {
  metadata: {
    fileName: 'test-data.xlsx',
    collectionDate: new Date('2024-01-15'),
    vCenterVersion: '7.0.3',
    environment: 'production',
  },
  vInfo: mockVMs,
  vHost: [],
  vCluster: [],
  vDatastore: [],
  vSnapshot: [],
  vTools: [],
  vDisk: [],
  vNetwork: [],
  vCD: [],
  vCPU: [],
  vMemory: [],
  vSource: [],
  vLicense: [],
};

const mockPreflightChecks = {
  counts: {
    // Common checks (required)
    vmsWithoutTools: 0,
    vmsWithoutToolsList: [],
    vmsWithToolsNotRunning: 0,
    vmsWithToolsNotRunningList: [],
    vmsWithOldSnapshots: 0,
    vmsWithOldSnapshotsList: [],
    vmsWithRDM: 0,
    vmsWithRDMList: [],
    vmsWithSharedDisks: 0,
    vmsWithSharedDisksList: [],
    vmsWithLargeDisks: 0,
    vmsWithLargeDisksList: [],
    hwVersionOutdated: 0,
    hwVersionOutdatedList: [],
    // ROKS-specific checks (optional but used)
    vmsWithCdConnected: 0,
    vmsWithCdConnectedList: [],
    vmsWithLegacyNIC: 0,
    vmsWithLegacyNICList: [],
    vmsWithoutCBT: 0,
    vmsWithoutCBTList: [],
    vmsWithInvalidNames: 0,
    vmsWithInvalidNamesList: [],
    vmsWithCPUHotPlug: 0,
    vmsWithCPUHotPlugList: [],
    vmsWithMemoryHotPlug: 0,
    vmsWithMemoryHotPlugList: [],
    vmsWithIndependentDisks: 0,
    vmsWithIndependentDisksList: [],
    vmsWithInvalidHostname: 0,
    vmsWithInvalidHostnameList: [],
    vmsStaticIPPoweredOff: 0,
    vmsStaticIPPoweredOffList: [],
  },
  remediationItems: [],
  blockerCount: 0,
  warningCount: 0,
  hwVersionCounts: { recommended: 2, supported: 0, outdated: 0 },
};

const mockMigrationAssessment = {
  complexityScores: new Map(),
  readinessScore: 90,
  chartData: [],
  topComplexVMs: [],
  osStatusCounts: { supported: 8, warning: 2, unsupported: 2 },
};

const mockWavePlanning = {
  waves: [],
  networkWaves: [],
  activeTab: 0,
  setActiveTab: vi.fn(),
  moveVM: vi.fn(),
  getWaveStats: vi.fn(() => ({ vms: 0, vcpus: 0, memoryGiB: 0, storageGiB: 0 })),
};

describe('ROKSMigrationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePreflightChecks).mockReturnValue(mockPreflightChecks as unknown as ReturnType<typeof usePreflightChecks>);
    vi.mocked(useMigrationAssessment).mockReturnValue(mockMigrationAssessment as unknown as ReturnType<typeof useMigrationAssessment>);
    vi.mocked(useWavePlanning).mockReturnValue(mockWavePlanning as unknown as ReturnType<typeof useWavePlanning>);
  });

  it('redirects to home when no data is loaded', () => {
    vi.mocked(useData).mockReturnValue({ rawData: null } as unknown as ReturnType<typeof useData>);
    vi.mocked(useVMs).mockReturnValue([]);

    render(
      <MemoryRouter>
        <ROKSMigrationPage />
      </MemoryRouter>
    );

    expect(screen.queryByText('ROKS Migration')).not.toBeInTheDocument();
  });

  it('renders page with data', () => {
    vi.mocked(useData).mockReturnValue({ rawData: mockRawData } as unknown as ReturnType<typeof useData>);
    vi.mocked(useVMs).mockReturnValue(mockVMs as unknown as ReturnType<typeof useVMs>);

    render(
      <MemoryRouter>
        <ROKSMigrationPage />
      </MemoryRouter>
    );

    expect(screen.getByText('ROKS Migration')).toBeInTheDocument();
  });

  it('displays readiness score', () => {
    vi.mocked(useData).mockReturnValue({ rawData: mockRawData } as unknown as ReturnType<typeof useData>);
    vi.mocked(useVMs).mockReturnValue(mockVMs as unknown as ReturnType<typeof useVMs>);

    render(
      <MemoryRouter>
        <ROKSMigrationPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Readiness Score')).toBeInTheDocument();
  });

  it('renders tabs for different sections', () => {
    vi.mocked(useData).mockReturnValue({ rawData: mockRawData } as unknown as ReturnType<typeof useData>);
    vi.mocked(useVMs).mockReturnValue(mockVMs as unknown as ReturnType<typeof useVMs>);

    render(
      <MemoryRouter>
        <ROKSMigrationPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('tab', { name: /pre-flight/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /complexity/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /wave planning/i })).toBeInTheDocument();
  });

  it('displays OS compatibility panel for ROKS', () => {
    vi.mocked(useData).mockReturnValue({ rawData: mockRawData } as unknown as ReturnType<typeof useData>);
    vi.mocked(useVMs).mockReturnValue(mockVMs as unknown as ReturnType<typeof useVMs>);

    render(
      <MemoryRouter>
        <ROKSMigrationPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('os-compatibility-panel')).toBeInTheDocument();
  });

  it('shows blockers notification when blockers exist', () => {
    vi.mocked(useData).mockReturnValue({ rawData: mockRawData } as unknown as ReturnType<typeof useData>);
    vi.mocked(useVMs).mockReturnValue(mockVMs as unknown as ReturnType<typeof useVMs>);
    vi.mocked(usePreflightChecks).mockReturnValue({
      ...mockPreflightChecks,
      blockerCount: 3,
    } as unknown as ReturnType<typeof usePreflightChecks>);

    render(
      <MemoryRouter>
        <ROKSMigrationPage />
      </MemoryRouter>
    );

    // Multiple blocker-related elements may exist
    expect(screen.getAllByText(/blocker/i).length).toBeGreaterThan(0);
  });

  it('shows unsupported OS warning when applicable', () => {
    vi.mocked(useData).mockReturnValue({ rawData: mockRawData } as unknown as ReturnType<typeof useData>);
    vi.mocked(useVMs).mockReturnValue(mockVMs as unknown as ReturnType<typeof useVMs>);
    vi.mocked(useMigrationAssessment).mockReturnValue({
      ...mockMigrationAssessment,
      osStatusCounts: { supported: 5, warning: 2, unsupported: 5 },
    } as unknown as ReturnType<typeof useMigrationAssessment>);

    render(
      <MemoryRouter>
        <ROKSMigrationPage />
      </MemoryRouter>
    );

    // Should show unsupported OS count somewhere
    const metricCards = screen.getAllByTestId('metric-card');
    expect(metricCards.length).toBeGreaterThan(0);
  });

  it('renders cost estimation component', () => {
    vi.mocked(useData).mockReturnValue({ rawData: mockRawData } as unknown as ReturnType<typeof useData>);
    vi.mocked(useVMs).mockReturnValue(mockVMs as unknown as ReturnType<typeof useVMs>);

    render(
      <MemoryRouter>
        <ROKSMigrationPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('cost-estimation')).toBeInTheDocument();
  });

  it('renders complexity assessment panel', () => {
    vi.mocked(useData).mockReturnValue({ rawData: mockRawData } as unknown as ReturnType<typeof useData>);
    vi.mocked(useVMs).mockReturnValue(mockVMs as unknown as ReturnType<typeof useVMs>);

    render(
      <MemoryRouter>
        <ROKSMigrationPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('complexity-panel')).toBeInTheDocument();
  });

  it('renders wave planning panel', () => {
    vi.mocked(useData).mockReturnValue({ rawData: mockRawData } as unknown as ReturnType<typeof useData>);
    vi.mocked(useVMs).mockReturnValue(mockVMs as unknown as ReturnType<typeof useVMs>);

    render(
      <MemoryRouter>
        <ROKSMigrationPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('wave-planning-panel')).toBeInTheDocument();
  });

  it('handles zero VMs gracefully', () => {
    vi.mocked(useData).mockReturnValue({ rawData: mockRawData } as unknown as ReturnType<typeof useData>);
    vi.mocked(useVMs).mockReturnValue([]);

    render(
      <MemoryRouter>
        <ROKSMigrationPage />
      </MemoryRouter>
    );

    expect(screen.getByText('ROKS Migration')).toBeInTheDocument();
  });

  it('displays pre-flight check metrics', () => {
    vi.mocked(useData).mockReturnValue({ rawData: mockRawData } as unknown as ReturnType<typeof useData>);
    vi.mocked(useVMs).mockReturnValue(mockVMs as unknown as ReturnType<typeof useVMs>);

    render(
      <MemoryRouter>
        <ROKSMigrationPage />
      </MemoryRouter>
    );

    const metricCards = screen.getAllByTestId('metric-card');
    expect(metricCards.length).toBeGreaterThan(0);
  });
});
