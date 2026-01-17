// DOCX Generator Tests
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all the section builders before importing the module
vi.mock('./sections', () => ({
  buildCoverPage: vi.fn(() => []),
  buildExecutiveSummary: vi.fn(() => Promise.resolve([])),
  buildAssumptionsAndScope: vi.fn(() => []),
  buildEnvironmentAnalysis: vi.fn(() => Promise.resolve([])),
  buildMigrationReadiness: vi.fn(() => []),
  buildMigrationOptions: vi.fn(() => []),
  buildMigrationStrategy: vi.fn(() => []),
  buildROKSOverview: vi.fn(() => []),
  buildVSIOverview: vi.fn(() => []),
  buildCostEstimation: vi.fn(() => []),
  buildNextSteps: vi.fn(() => []),
  buildAppendices: vi.fn(() => []),
}));

// Mock utility functions
vi.mock('./utils/calculations', () => ({
  calculateVMReadiness: vi.fn(() => ({
    total: 10,
    ready: 8,
    blockers: 1,
    warnings: 1,
    readyVMs: [],
    blockerVMs: [],
    warningVMs: [],
    issuesByCategory: {},
  })),
  calculateROKSSizing: vi.fn(() => ({
    workerNodes: 3,
    controlPlaneNodes: 3,
    workerCores: 48,
    workerMemoryGiB: 192,
    totalVMs: 10,
    supportedVMs: 8,
  })),
  calculateVSIMappings: vi.fn(() => ({
    mappings: [],
    profileCounts: {},
    totalVCPUs: 40,
    totalMemoryGiB: 160,
  })),
}));

// Mock docx library
vi.mock('docx', () => {
  return {
    Document: class MockDocument {
      constructor() {}
    },
    Packer: {
      toBlob: vi.fn(() => Promise.resolve(new Blob(['DOCX content'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))),
    },
    Paragraph: class MockParagraph {
      constructor() {}
    },
    TextRun: class MockTextRun {
      constructor() {}
    },
    Header: class MockHeader {
      constructor() {}
    },
    Footer: class MockFooter {
      constructor() {}
    },
    PageNumber: {},
    NumberFormat: { DECIMAL: 'decimal' },
    AlignmentType: { CENTER: 'center', LEFT: 'left', RIGHT: 'right', JUSTIFIED: 'justified' },
    convertInchesToTwip: vi.fn((inches: number) => inches * 1440),
  };
});

// Mock report templates
vi.mock('@/data/reportTemplates.json', () => ({
  default: {
    placeholders: {
      clientName: 'Test Client',
      preparedBy: 'Test Author',
      companyName: 'Test Company',
    },
  },
}));

import { generateDocxReport } from './index';
import type { RVToolsData } from '@/types/rvtools';

const mockRVToolsData = {
  metadata: {
    fileName: 'test-export.xlsx',
    collectionDate: new Date('2024-01-15'),
    vCenterVersion: '7.0.3',
    environment: 'production',
  },
  vInfo: [
    {
      vmName: 'vm-1',
      powerState: 'poweredOn',
      template: false,
      cpus: 4,
      memory: 8192,
      provisionedMiB: 102400,
      inUseMiB: 51200,
      datacenter: 'dc-1',
      cluster: 'cluster-1',
      hardwareVersion: 'vmx-19',
      guestOS: 'Windows Server 2019',
    },
    {
      vmName: 'vm-2',
      powerState: 'poweredOn',
      template: false,
      cpus: 2,
      memory: 4096,
      provisionedMiB: 51200,
      inUseMiB: 25600,
      datacenter: 'dc-1',
      cluster: 'cluster-1',
      hardwareVersion: 'vmx-17',
      guestOS: 'Red Hat Enterprise Linux 8',
    },
  ],
  vHost: [],
  vCluster: [],
  vDatastore: [],
  vSnapshot: [],
  vTools: [],
  vCD: [],
  vDisk: [],
  vCPU: [],
  vMemory: [],
  vNetwork: [],
  vSource: [],
  vLicense: [],
} as unknown as RVToolsData;

describe('generateDocxReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates a DOCX blob with default options', async () => {
    const blob = await generateDocxReport(mockRVToolsData);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  it('generates a DOCX blob with custom client name', async () => {
    const blob = await generateDocxReport(mockRVToolsData, {
      clientName: 'Custom Client',
    });

    expect(blob).toBeInstanceOf(Blob);
  });

  it('generates a DOCX blob with all options', async () => {
    const blob = await generateDocxReport(mockRVToolsData, {
      clientName: 'Test Client',
      preparedBy: 'Test Author',
      companyName: 'Test Company',
      includeROKS: true,
      includeVSI: true,
      includeCosts: true,
      maxIssueVMs: 10,
    });

    expect(blob).toBeInstanceOf(Blob);
  });

  it('generates a DOCX blob without ROKS section', async () => {
    const blob = await generateDocxReport(mockRVToolsData, {
      includeROKS: false,
    });

    expect(blob).toBeInstanceOf(Blob);
  });

  it('generates a DOCX blob without VSI section', async () => {
    const blob = await generateDocxReport(mockRVToolsData, {
      includeVSI: false,
    });

    expect(blob).toBeInstanceOf(Blob);
  });

  it('generates a DOCX blob without costs section', async () => {
    const blob = await generateDocxReport(mockRVToolsData, {
      includeCosts: false,
    });

    expect(blob).toBeInstanceOf(Blob);
  });

  it('handles empty VM list', async () => {
    const emptyData = {
      ...mockRVToolsData,
      vInfo: [],
    } as unknown as RVToolsData;

    const blob = await generateDocxReport(emptyData);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('respects maxIssueVMs option', async () => {
    const blob = await generateDocxReport(mockRVToolsData, {
      maxIssueVMs: 5,
    });

    expect(blob).toBeInstanceOf(Blob);
  });

  it('uses default values when options not provided', async () => {
    const blob = await generateDocxReport(mockRVToolsData);
    expect(blob).toBeInstanceOf(Blob);
  });
});
