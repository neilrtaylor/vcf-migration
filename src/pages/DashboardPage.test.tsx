// Dashboard Page Tests
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';

// Mock hooks
vi.mock('@/hooks', () => ({
  useData: vi.fn(),
  useVMs: vi.fn(),
  useChartFilter: vi.fn(),
  useVMOverrides: vi.fn(() => ({
    overrides: {},
    isExcluded: () => false,
    isForceIncluded: () => false,
    isEffectivelyExcluded: () => false,
    getWorkloadType: () => undefined,
    getNotes: () => undefined,
    excludedCount: 0,
    forceIncludedCount: 0,
    overrideCount: 0,
  })),
  useAutoExclusion: vi.fn(() => ({
    autoExclusionMap: new Map(),
    getAutoExclusionById: () => ({ isAutoExcluded: false, reasons: [], labels: [] }),
    autoExcludedCount: 0,
    autoExcludedBreakdown: { templates: 0, poweredOff: 0, vmwareInfrastructure: 0, windowsInfrastructure: 0 },
  })),
}));

// Mock AI components and services
vi.mock('@/components/ai/AIInsightsPanel', () => ({
  AIInsightsPanel: () => <div data-testid="ai-insights-panel" />,
}));

vi.mock('@/services/ai/aiProxyClient', () => ({
  isAIProxyConfigured: vi.fn(() => false),
}));

vi.mock('@/utils/vmIdentifier', () => ({
  getVMIdentifier: vi.fn((vm: { vmName: string }) => vm.vmName),
  getEnvironmentFingerprint: vi.fn(() => 'test-fingerprint'),
}));

// Mock chart components
vi.mock('@/components/charts', () => ({
  DoughnutChart: ({ title }: { title: string }) => <div data-testid="doughnut-chart">{title}</div>,
  HorizontalBarChart: ({ title }: { title: string }) => <div data-testid="bar-chart">{title}</div>,
  VerticalBarChart: ({ title }: { title: string }) => <div data-testid="vertical-bar-chart">{title}</div>,
}));

// Mock common components
vi.mock('@/components/common', () => ({
  FilterBadge: () => <div data-testid="filter-badge" />,
  MetricCard: ({ label, value }: { label: string; value: string }) => (
    <div data-testid="metric-card">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
}));

import { useData, useVMs, useChartFilter } from '@/hooks';

const mockVMs = [
  {
    vmName: 'vm-1',
    powerState: 'poweredOn',
    cpus: 4,
    memory: 8192,
    provisionedMiB: 102400,
    inUseMiB: 51200,
    cluster: 'cluster-1',
    datacenter: 'dc-1',
    hardwareVersion: 'vmx-19',
    guestOS: 'Windows Server 2019',
    firmwareType: 'efi',
    consolidationNeeded: false,
  },
  {
    vmName: 'vm-2',
    powerState: 'poweredOff',
    cpus: 2,
    memory: 4096,
    provisionedMiB: 51200,
    inUseMiB: 25600,
    cluster: 'cluster-1',
    datacenter: 'dc-1',
    hardwareVersion: 'vmx-17',
    guestOS: 'Red Hat Enterprise Linux',
    firmwareType: 'bios',
    consolidationNeeded: true,
  },
  {
    vmName: 'vm-3',
    powerState: 'suspended',
    cpus: 8,
    memory: 16384,
    provisionedMiB: 204800,
    inUseMiB: 102400,
    cluster: 'cluster-2',
    datacenter: 'dc-1',
    hardwareVersion: 'vmx-19',
    guestOS: 'Ubuntu Linux',
    firmwareType: 'efi',
    consolidationNeeded: false,
  },
];

const mockRawData = {
  metadata: {
    fileName: 'test-data.xlsx',
    collectionDate: new Date('2024-01-15'),
    vCenterVersion: '7.0.3',
    environment: 'production',
  },
  vInfo: [
    { template: false },
    { template: true },
  ],
  vHost: [
    {
      cluster: 'cluster-1',
      totalCpuCores: 32,
      vmCpuCount: 48,
      memoryMiB: 131072,
      vmMemoryMiB: 98304,
    },
    {
      cluster: 'cluster-2',
      totalCpuCores: 24,
      vmCpuCount: 24,
      memoryMiB: 65536,
      vmMemoryMiB: 49152,
    },
  ],
  vSource: [
    {
      server: 'vcenter.example.com',
      version: '7.0.3',
      build: '12345',
      fullName: 'VMware vCenter Server',
      ipAddress: '192.168.1.10',
      apiVersion: '7.0.3.0',
    },
  ],
  vTools: [
    { toolsStatus: 'toolsOk' },
    { toolsStatus: 'toolsNotInstalled' },
  ],
  vSnapshot: [
    { vmName: 'vm-1', ageInDays: 10 },
    { vmName: 'vm-2', ageInDays: 60 },
  ],
  vCD: [
    { vmName: 'vm-1', connected: true },
    { vmName: 'vm-2', connected: false },
  ],
  vDatastore: [
    { name: 'ds-1' },
    { name: 'ds-2' },
  ],
};

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useChartFilter).mockReturnValue({
      chartFilter: null,
      setFilter: vi.fn(),
      clearFilter: vi.fn(),
      applyFilter: vi.fn((items) => items),
      isFilterActive: vi.fn(() => false),
      getFilterValue: vi.fn(() => null),
    });
  });

  it('redirects to home when no data is loaded', () => {
    vi.mocked(useData).mockReturnValue({ rawData: null } as ReturnType<typeof useData>);
    vi.mocked(useVMs).mockReturnValue([]);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    // Component should redirect, so content won't be visible
    expect(screen.queryByText('Executive Dashboard')).not.toBeInTheDocument();
  });

  it('renders dashboard with data', () => {
    vi.mocked(useData).mockReturnValue({ rawData: mockRawData } as ReturnType<typeof useData>);
    vi.mocked(useVMs).mockReturnValue(mockVMs as ReturnType<typeof useVMs>);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Executive Dashboard')).toBeInTheDocument();
    expect(screen.getByText(/test-data.xlsx/)).toBeInTheDocument();
  });

  it('displays correct VM count metrics', () => {
    vi.mocked(useData).mockReturnValue({ rawData: mockRawData } as ReturnType<typeof useData>);
    vi.mocked(useVMs).mockReturnValue(mockVMs as ReturnType<typeof useVMs>);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    const metricCards = screen.getAllByTestId('metric-card');
    expect(metricCards.length).toBeGreaterThan(0);

    // Check Total VMs card
    expect(screen.getByText('Total VMs')).toBeInTheDocument();
  });

  it('displays vCenter source information', () => {
    vi.mocked(useData).mockReturnValue({ rawData: mockRawData } as ReturnType<typeof useData>);
    vi.mocked(useVMs).mockReturnValue(mockVMs as ReturnType<typeof useVMs>);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Source Environment')).toBeInTheDocument();
    expect(screen.getByText('vcenter.example.com')).toBeInTheDocument();
  });

  it('renders charts', () => {
    vi.mocked(useData).mockReturnValue({ rawData: mockRawData } as ReturnType<typeof useData>);
    vi.mocked(useVMs).mockReturnValue(mockVMs as ReturnType<typeof useVMs>);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getAllByTestId('doughnut-chart').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('bar-chart').length).toBeGreaterThan(0);
  });

  it('displays cluster overview section', () => {
    vi.mocked(useData).mockReturnValue({ rawData: mockRawData } as ReturnType<typeof useData>);
    vi.mocked(useVMs).mockReturnValue(mockVMs as ReturnType<typeof useVMs>);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Cluster Overview')).toBeInTheDocument();
    expect(screen.getByText('VMs by Cluster')).toBeInTheDocument();
  });

  it('displays configuration analysis section', () => {
    vi.mocked(useData).mockReturnValue({ rawData: mockRawData } as ReturnType<typeof useData>);
    vi.mocked(useVMs).mockReturnValue(mockVMs as ReturnType<typeof useVMs>);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Configuration Analysis')).toBeInTheDocument();
    expect(screen.getByText('Configuration Issues')).toBeInTheDocument();
  });

  it('shows filter badge when chart filter is active', () => {
    vi.mocked(useData).mockReturnValue({ rawData: mockRawData } as ReturnType<typeof useData>);
    vi.mocked(useVMs).mockReturnValue(mockVMs as ReturnType<typeof useVMs>);
    vi.mocked(useChartFilter).mockReturnValue({
      chartFilter: { dimension: 'powerState', value: 'Powered On', source: 'powerStateChart' },
      setFilter: vi.fn(),
      clearFilter: vi.fn(),
      applyFilter: vi.fn((items) => items),
      isFilterActive: vi.fn(() => true),
      getFilterValue: vi.fn(() => 'Powered On'),
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('filter-badge')).toBeInTheDocument();
  });

  it('handles empty vSource gracefully', () => {
    const dataWithNoSource = {
      ...mockRawData,
      metadata: {
        ...mockRawData.metadata,
      },
      vSource: [],
    };
    vi.mocked(useData).mockReturnValue({ rawData: dataWithNoSource } as unknown as ReturnType<typeof useData>);
    vi.mocked(useVMs).mockReturnValue(mockVMs as ReturnType<typeof useVMs>);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.queryByText('Source Environment')).not.toBeInTheDocument();
  });

  it('calculates storage efficiency correctly', () => {
    vi.mocked(useData).mockReturnValue({ rawData: mockRawData } as ReturnType<typeof useData>);
    vi.mocked(useVMs).mockReturnValue(mockVMs as ReturnType<typeof useVMs>);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Storage Efficiency')).toBeInTheDocument();
  });

  it('displays hardware version distribution chart', () => {
    vi.mocked(useData).mockReturnValue({ rawData: mockRawData } as ReturnType<typeof useData>);
    vi.mocked(useVMs).mockReturnValue(mockVMs as ReturnType<typeof useVMs>);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Hardware Version Distribution')).toBeInTheDocument();
  });

  it('displays firmware type distribution chart', () => {
    vi.mocked(useData).mockReturnValue({ rawData: mockRawData } as ReturnType<typeof useData>);
    vi.mocked(useVMs).mockReturnValue(mockVMs as ReturnType<typeof useVMs>);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Firmware Type')).toBeInTheDocument();
  });
});
