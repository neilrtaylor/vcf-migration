// PDF Generator Tests
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PDFGenerator, generatePDF, downloadPDF } from './pdfGenerator';
import type { RVToolsData } from '@/types/rvtools';

// Mock jsPDF - factory must be inline for hoisting
vi.mock('jspdf', () => {
  return {
    default: class MockJsPDF {
      internal = {
        pageSize: {
          getWidth: () => 210,
          getHeight: () => 297,
        },
      };
      setFontSize() {}
      setTextColor() {}
      setDrawColor() {}
      setFillColor() {}
      setLineWidth() {}
      text() {}
      line() {}
      rect() {}
      roundedRect() {}
      addPage() {}
      setPage() {}
      getNumberOfPages() { return 5; }
      output() { return new Blob(['PDF content'], { type: 'application/pdf' }); }
    },
  };
});

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
      annotation: '',
      cbtEnabled: true,
      guestHostname: 'server1.example.com',
      uuid: 'uuid-1',
    },
    {
      vmName: 'vm-2',
      powerState: 'poweredOff',
      template: false,
      cpus: 2,
      memory: 4096,
      provisionedMiB: 51200,
      inUseMiB: 25600,
      datacenter: 'dc-1',
      cluster: 'cluster-1',
      hardwareVersion: 'vmx-17',
      guestOS: 'Red Hat Enterprise Linux',
      annotation: '',
      cbtEnabled: false,
      guestHostname: 'localhost',
      uuid: 'uuid-2',
    },
    {
      vmName: 'template-1',
      powerState: 'poweredOff',
      template: true,
      cpus: 2,
      memory: 2048,
      provisionedMiB: 20480,
      inUseMiB: 10240,
      datacenter: 'dc-1',
      cluster: 'cluster-1',
      hardwareVersion: 'vmx-19',
      guestOS: 'Ubuntu Linux',
      annotation: '',
      cbtEnabled: false,
      guestHostname: '',
      uuid: 'uuid-3',
    },
  ] as RVToolsData['vInfo'],
  vHost: [
    {
      name: 'host-1',
      cluster: 'cluster-1',
      totalCpuCores: 32,
      vmCpuCount: 48,
      memoryMiB: 131072,
      vmMemoryMiB: 98304,
      esxiVersion: '7.0.3',
      vendor: 'Dell',
      model: 'PowerEdge R740',
    },
  ],
  vCluster: [
    {
      name: 'cluster-1',
      hostCount: 3,
      haEnabled: true,
      drsEnabled: true,
    },
  ] as RVToolsData['vCluster'],
  vDatastore: [
    {
      name: 'ds-1',
      type: 'VMFS',
      capacityMiB: 1048576,
      inUseMiB: 838861,
      freeMiB: 209715,
    },
    {
      name: 'ds-2',
      type: 'NFS',
      capacityMiB: 524288,
      inUseMiB: 262144,
      freeMiB: 262144,
    },
  ] as RVToolsData['vDatastore'],
  vTools: [
    { vmName: 'vm-1', toolsStatus: 'toolsOk', toolsVersion: '12345' },
    { vmName: 'vm-2', toolsStatus: 'toolsNotInstalled', toolsVersion: '' },
  ] as RVToolsData['vTools'],
  vSnapshot: [
    { vmName: 'vm-1', snapshotName: 'snap-1', ageInDays: 5 },
    { vmName: 'vm-1', snapshotName: 'snap-2', ageInDays: 14 },
  ] as RVToolsData['vSnapshot'],
  vCD: [
    { vmName: 'vm-1', connected: true },
    { vmName: 'vm-2', connected: false },
  ],
  vDisk: [
    { vmName: 'vm-1', diskLabel: 'Hard disk 1', raw: false, sharingMode: 'sharingNone', diskMode: 'persistent' },
    { vmName: 'vm-2', diskLabel: 'Hard disk 1', raw: true, sharingMode: 'sharingNone', diskMode: 'persistent' },
  ],
  vCPU: [
    { vmName: 'vm-1', hotAddEnabled: false },
    { vmName: 'vm-2', hotAddEnabled: true },
  ],
  vMemory: [
    { vmName: 'vm-1', hotAddEnabled: false, ballooned: 0 },
    { vmName: 'vm-2', hotAddEnabled: true, ballooned: 512 },
  ],
  vNetwork: [],
  vSource: [],
  vLicense: [],
} as unknown as RVToolsData;

describe('PDFGenerator', () => {
  let generator: PDFGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new PDFGenerator();
  });

  describe('generate', () => {
    it('generates a PDF blob with default options', async () => {
      const blob = await generator.generate(mockRVToolsData);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/pdf');
    });

    it('generates a PDF blob with all sections enabled', async () => {
      const blob = await generator.generate(mockRVToolsData, {
        includeExecutiveSummary: true,
        includeComputeAnalysis: true,
        includeStorageAnalysis: true,
        includeMTVReadiness: true,
        includeVMList: true,
      });

      expect(blob).toBeInstanceOf(Blob);
    });

    it('generates a PDF blob with minimal sections', async () => {
      const blob = await generator.generate(mockRVToolsData, {
        includeExecutiveSummary: false,
        includeComputeAnalysis: false,
        includeStorageAnalysis: false,
        includeMTVReadiness: false,
        includeVMList: false,
      });

      expect(blob).toBeInstanceOf(Blob);
    });
  });
});

describe('generatePDF', () => {
  it('creates a PDF generator and returns blob', async () => {
    const blob = await generatePDF(mockRVToolsData);

    expect(blob).toBeInstanceOf(Blob);
  });

  it('accepts partial options', async () => {
    const blob = await generatePDF(mockRVToolsData, {
      includeVMList: true,
    });

    expect(blob).toBeInstanceOf(Blob);
  });
});

describe('downloadPDF', () => {
  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
    global.URL.revokeObjectURL = vi.fn();

    const mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLAnchorElement);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as unknown as HTMLAnchorElement);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as unknown as HTMLAnchorElement);
  });

  it('creates object URL and triggers download', () => {
    const blob = new Blob(['PDF content'], { type: 'application/pdf' });
    downloadPDF(blob, 'report.pdf');

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});

describe('PDF Content Sections', () => {
  let generator: PDFGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new PDFGenerator();
  });

  it('handles empty VM list gracefully', async () => {
    const emptyData: RVToolsData = {
      ...mockRVToolsData,
      vInfo: [],
      vHost: [],
      vCluster: [],
      vDatastore: [],
    };

    const blob = await generator.generate(emptyData);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('handles data without collection date', async () => {
    const noDateData = {
      ...mockRVToolsData,
      metadata: {
        ...mockRVToolsData.metadata,
        collectionDate: null,
      },
    } as unknown as RVToolsData;

    const blob = await generator.generate(noDateData);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('handles VMs with missing optional fields', async () => {
    const sparseData: RVToolsData = {
      ...mockRVToolsData,
      vInfo: [
        {
          vmName: 'sparse-vm',
          powerState: 'poweredOn',
          template: false,
          cpus: 1,
          memory: 1024,
          provisionedMiB: 10240,
          inUseMiB: 5120,
          datacenter: '',
          cluster: '',
          hardwareVersion: '',
          guestOS: '',
          annotation: '',
          cbtEnabled: false,
          guestHostname: '',
          uuid: '',
        },
      ] as RVToolsData['vInfo'],
    };

    const blob = await generator.generate(sparseData);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('correctly identifies VMs with RDM disks', async () => {
    const rdmData = {
      ...mockRVToolsData,
      vDisk: [
        { vmName: 'vm-1', diskLabel: 'Hard disk 1', raw: true, sharingMode: 'sharingNone', diskMode: 'persistent' },
        { vmName: 'vm-2', diskLabel: 'Hard disk 1', raw: true, sharingMode: 'sharingNone', diskMode: 'persistent' },
      ],
    } as unknown as RVToolsData;

    const blob = await generator.generate(rdmData, { includeMTVReadiness: true });
    expect(blob).toBeInstanceOf(Blob);
  });

  it('correctly identifies shared disks', async () => {
    const sharedDiskData = {
      ...mockRVToolsData,
      vDisk: [
        { vmName: 'vm-1', diskLabel: 'Hard disk 1', raw: false, sharingMode: 'sharingMultiWriter', diskMode: 'persistent' },
      ],
    } as unknown as RVToolsData;

    const blob = await generator.generate(sharedDiskData, { includeMTVReadiness: true });
    expect(blob).toBeInstanceOf(Blob);
  });

  it('correctly identifies independent disks', async () => {
    const independentDiskData = {
      ...mockRVToolsData,
      vDisk: [
        { vmName: 'vm-1', diskLabel: 'Hard disk 1', raw: false, sharingMode: 'sharingNone', diskMode: 'independent_persistent' },
      ],
    } as unknown as RVToolsData;

    const blob = await generator.generate(independentDiskData, { includeMTVReadiness: true });
    expect(blob).toBeInstanceOf(Blob);
  });
});

describe('OS Distribution Analysis', () => {
  let generator: PDFGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new PDFGenerator();
  });

  it('correctly categorizes Windows Server versions', async () => {
    const windowsData: RVToolsData = {
      ...mockRVToolsData,
      vInfo: [
        { ...mockRVToolsData.vInfo[0], guestOS: 'Microsoft Windows Server 2019 (64-bit)' },
        { ...mockRVToolsData.vInfo[0], guestOS: 'Microsoft Windows Server 2016 Standard' },
        { ...mockRVToolsData.vInfo[0], guestOS: 'Microsoft Windows Server 2022 Datacenter' },
      ] as RVToolsData['vInfo'],
    };

    const blob = await generator.generate(windowsData, { includeExecutiveSummary: true });
    expect(blob).toBeInstanceOf(Blob);
  });

  it('correctly categorizes Linux distributions', async () => {
    const linuxData: RVToolsData = {
      ...mockRVToolsData,
      vInfo: [
        { ...mockRVToolsData.vInfo[0], guestOS: 'Red Hat Enterprise Linux 8 (64-bit)' },
        { ...mockRVToolsData.vInfo[0], guestOS: 'CentOS 7 (64-bit)' },
        { ...mockRVToolsData.vInfo[0], guestOS: 'Ubuntu Linux (64-bit)' },
        { ...mockRVToolsData.vInfo[0], guestOS: 'SUSE Linux Enterprise Server 15' },
      ] as RVToolsData['vInfo'],
    };

    const blob = await generator.generate(linuxData, { includeExecutiveSummary: true });
    expect(blob).toBeInstanceOf(Blob);
  });
});

describe('CPU Distribution Analysis', () => {
  let generator: PDFGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new PDFGenerator();
  });

  it('correctly buckets VMs by CPU count', async () => {
    const cpuData: RVToolsData = {
      ...mockRVToolsData,
      vInfo: [
        { ...mockRVToolsData.vInfo[0], cpus: 1 },
        { ...mockRVToolsData.vInfo[0], cpus: 4 },
        { ...mockRVToolsData.vInfo[0], cpus: 8 },
        { ...mockRVToolsData.vInfo[0], cpus: 16 },
        { ...mockRVToolsData.vInfo[0], cpus: 32 },
        { ...mockRVToolsData.vInfo[0], cpus: 64 },
      ] as RVToolsData['vInfo'],
    };

    const blob = await generator.generate(cpuData, { includeComputeAnalysis: true });
    expect(blob).toBeInstanceOf(Blob);
  });
});

describe('Storage Analysis', () => {
  let generator: PDFGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new PDFGenerator();
  });

  it('correctly identifies high utilization datastores', async () => {
    const highUtilData: RVToolsData = {
      ...mockRVToolsData,
      vDatastore: [
        { name: 'ds-high', type: 'VMFS', capacityMiB: 100000, inUseMiB: 95000, freeMiB: 5000 },
        { name: 'ds-critical', type: 'VMFS', capacityMiB: 100000, inUseMiB: 99000, freeMiB: 1000 },
      ] as RVToolsData['vDatastore'],
    };

    const blob = await generator.generate(highUtilData, { includeStorageAnalysis: true });
    expect(blob).toBeInstanceOf(Blob);
  });

  it('handles datastores with zero capacity', async () => {
    const zeroCap: RVToolsData = {
      ...mockRVToolsData,
      vDatastore: [
        { name: 'ds-empty', type: 'VMFS', capacityMiB: 0, inUseMiB: 0, freeMiB: 0 },
      ] as RVToolsData['vDatastore'],
    };

    const blob = await generator.generate(zeroCap, { includeStorageAnalysis: true });
    expect(blob).toBeInstanceOf(Blob);
  });
});

describe('Tools Status Analysis', () => {
  let generator: PDFGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new PDFGenerator();
  });

  it('correctly analyzes VMware Tools status', async () => {
    const toolsData: RVToolsData = {
      ...mockRVToolsData,
      vTools: [
        { vmName: 'vm-1', toolsStatus: 'toolsOk', toolsVersion: '12345' },
        { vmName: 'vm-2', toolsStatus: 'toolsOld', toolsVersion: '10000' },
        { vmName: 'vm-3', toolsStatus: 'toolsNotInstalled', toolsVersion: '' },
        { vmName: 'vm-4', toolsStatus: 'toolsNotRunning', toolsVersion: '12345' },
      ] as RVToolsData['vTools'],
      vInfo: [
        { ...mockRVToolsData.vInfo[0], vmName: 'vm-1' },
        { ...mockRVToolsData.vInfo[0], vmName: 'vm-2' },
        { ...mockRVToolsData.vInfo[0], vmName: 'vm-3' },
        { ...mockRVToolsData.vInfo[0], vmName: 'vm-4' },
      ] as RVToolsData['vInfo'],
    };

    const blob = await generator.generate(toolsData, { includeMTVReadiness: true });
    expect(blob).toBeInstanceOf(Blob);
  });
});
