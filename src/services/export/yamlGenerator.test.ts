// YAML Generator Tests
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MTVYAMLGenerator, downloadBlob, downloadYAML } from './yamlGenerator';
import type { MTVExportOptions } from '@/types/mtvYaml';
import type { VNetworkInfo, VDatastoreInfo, VirtualMachine } from '@/types/rvtools';

const defaultOptions: MTVExportOptions = {
  namespace: 'openshift-mtv',
  targetNamespace: 'migrated-vms',
  sourceProviderName: 'vmware-source',
  destinationProviderName: 'ocp-destination',
  networkMapName: 'test-network-map',
  storageMapName: 'test-storage-map',
  defaultStorageClass: 'ocs-storagecluster-ceph-rbd',
  warm: false,
  preserveStaticIPs: false,
};

const mockVMs: Partial<VirtualMachine>[] = [
  {
    vmName: 'test-vm-1',
    uuid: 'uuid-123-456',
    powerState: 'poweredOn',
    cpus: 4,
    memory: 8192,
  },
  {
    vmName: 'test-vm-2',
    uuid: 'uuid-789-abc',
    powerState: 'poweredOn',
    cpus: 2,
    memory: 4096,
  },
];

const mockNetworks: Partial<VNetworkInfo>[] = [
  {
    networkName: 'VM Network',
    switchName: 'vSwitch0',
  },
  {
    networkName: 'Production-VLAN-100',
    switchName: 'dvs-production',
  },
];

const mockDatastores: Partial<VDatastoreInfo>[] = [
  { name: 'datastore-ssd-1' },
  { name: 'datastore-hdd-2' },
];

describe('MTVYAMLGenerator', () => {
  let generator: MTVYAMLGenerator;

  beforeEach(() => {
    generator = new MTVYAMLGenerator(defaultOptions);
  });

  describe('generatePlan', () => {
    it('generates a valid migration plan YAML', () => {
      const yaml = generator.generatePlan('wave-1', mockVMs as VirtualMachine[]);

      expect(yaml).toContain('---');
      expect(yaml).toContain('apiVersion: forklift.konveyor.io/v1beta1');
      expect(yaml).toContain('kind: Plan');
      expect(yaml).toContain('name: wave-1');
      expect(yaml).toContain('namespace: openshift-mtv');
    });

    it('includes VM references with name and id', () => {
      const yaml = generator.generatePlan('test-wave', mockVMs as VirtualMachine[]);

      expect(yaml).toContain('test-vm-1');
      expect(yaml).toContain('uuid-123-456');
    });

    it('includes provider references', () => {
      const yaml = generator.generatePlan('wave', mockVMs as VirtualMachine[]);

      expect(yaml).toContain('vmware-source');
      expect(yaml).toContain('ocp-destination');
    });

    it('includes map references', () => {
      const yaml = generator.generatePlan('wave', mockVMs as VirtualMachine[]);

      expect(yaml).toContain('test-network-map');
      expect(yaml).toContain('test-storage-map');
    });

    it('sanitizes wave names to valid k8s names', () => {
      const yaml = generator.generatePlan('Wave 1 - Production VMs!', mockVMs as VirtualMachine[]);

      // The sanitizeName function replaces multiple hyphens with single hyphen
      expect(yaml).toContain('name: wave-1-production-vms');
    });

    it('respects warm migration option', () => {
      const warmGenerator = new MTVYAMLGenerator({ ...defaultOptions, warm: true });
      const yaml = warmGenerator.generatePlan('warm-wave', mockVMs as VirtualMachine[]);

      expect(yaml).toContain('warm: true');
    });

    it('respects preserveStaticIPs option', () => {
      const staticIPGenerator = new MTVYAMLGenerator({ ...defaultOptions, preserveStaticIPs: true });
      const yaml = staticIPGenerator.generatePlan('static-ip-wave', mockVMs as VirtualMachine[]);

      expect(yaml).toContain('preserveStaticIPs: true');
    });
  });

  describe('generateNetworkMap', () => {
    it('generates a valid network map YAML', () => {
      const yaml = generator.generateNetworkMap(mockNetworks as VNetworkInfo[]);

      expect(yaml).toContain('---');
      expect(yaml).toContain('apiVersion: forklift.konveyor.io/v1beta1');
      expect(yaml).toContain('kind: NetworkMap');
      expect(yaml).toContain('name: test-network-map');
    });

    it('maps each unique network', () => {
      const yaml = generator.generateNetworkMap(mockNetworks as VNetworkInfo[]);

      expect(yaml).toContain('VM Network');
      expect(yaml).toContain('Production-VLAN-100');
    });

    it('identifies dvportgroup type for DVS networks', () => {
      const yaml = generator.generateNetworkMap(mockNetworks as VNetworkInfo[]);

      expect(yaml).toContain('dvportgroup');
    });

    it('deduplicates networks with same name', () => {
      const duplicateNetworks = [
        { networkName: 'VM Network', switchName: 'vSwitch0' },
        { networkName: 'VM Network', switchName: 'vSwitch0' },
        { networkName: 'Other Network', switchName: 'vSwitch1' },
      ] as VNetworkInfo[];

      const yaml = generator.generateNetworkMap(duplicateNetworks);
      const vmNetworkMatches = (yaml.match(/VM Network/g) || []).length;

      // Should only appear once in the map (plus possibly in source reference)
      expect(vmNetworkMatches).toBeLessThanOrEqual(2);
    });

    it('includes provider references', () => {
      const yaml = generator.generateNetworkMap(mockNetworks as VNetworkInfo[]);

      expect(yaml).toContain('vmware-source');
      expect(yaml).toContain('ocp-destination');
    });
  });

  describe('generateStorageMap', () => {
    it('generates a valid storage map YAML', () => {
      const yaml = generator.generateStorageMap(mockDatastores as VDatastoreInfo[]);

      expect(yaml).toContain('---');
      expect(yaml).toContain('apiVersion: forklift.konveyor.io/v1beta1');
      expect(yaml).toContain('kind: StorageMap');
      expect(yaml).toContain('name: test-storage-map');
    });

    it('maps each unique datastore', () => {
      const yaml = generator.generateStorageMap(mockDatastores as VDatastoreInfo[]);

      expect(yaml).toContain('datastore-ssd-1');
      expect(yaml).toContain('datastore-hdd-2');
    });

    it('includes destination storage class', () => {
      const yaml = generator.generateStorageMap(mockDatastores as VDatastoreInfo[]);

      expect(yaml).toContain('ocs-storagecluster-ceph-rbd');
    });

    it('includes access mode and volume mode', () => {
      const yaml = generator.generateStorageMap(mockDatastores as VDatastoreInfo[]);

      expect(yaml).toContain('ReadWriteOnce');
      expect(yaml).toContain('Filesystem');
    });

    it('deduplicates datastores with same name', () => {
      const duplicateDatastores = [
        { name: 'datastore-1' },
        { name: 'datastore-1' },
        { name: 'datastore-2' },
      ] as VDatastoreInfo[];

      const yaml = generator.generateStorageMap(duplicateDatastores);
      const ds1Matches = (yaml.match(/datastore-1/g) || []).length;

      expect(ds1Matches).toBeLessThanOrEqual(2);
    });
  });

  describe('generatePreview', () => {
    it('generates preview with limited VMs', () => {
      const manyVMs = Array(10).fill(null).map((_, i) => ({
        vmName: `vm-${i}`,
        uuid: `uuid-${i}`,
      })) as VirtualMachine[];

      const preview = generator.generatePreview(manyVMs);

      // Should only include first 3 VMs
      expect(preview).toContain('vm-0');
      expect(preview).toContain('vm-1');
      expect(preview).toContain('vm-2');
      expect(preview).not.toContain('vm-3');
    });
  });

  describe('generateBundle', () => {
    it('generates a zip blob with all resources', async () => {
      const waves = [
        { name: 'wave-1', vms: mockVMs as VirtualMachine[] },
      ];

      const blob = await generator.generateBundle(
        waves,
        mockNetworks as VNetworkInfo[],
        mockDatastores as VDatastoreInfo[]
      );

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/zip');
      expect(blob.size).toBeGreaterThan(0);
    });

    it('includes multiple wave plans', async () => {
      const waves = [
        { name: 'wave-1', vms: [mockVMs[0]] as VirtualMachine[] },
        { name: 'wave-2', vms: [mockVMs[1]] as VirtualMachine[] },
      ];

      const blob = await generator.generateBundle(
        waves,
        mockNetworks as VNetworkInfo[],
        mockDatastores as VDatastoreInfo[]
      );

      expect(blob.size).toBeGreaterThan(0);
    });
  });

  describe('sanitizeName', () => {
    it('converts to lowercase', () => {
      const yaml = generator.generatePlan('UPPERCASE', mockVMs as VirtualMachine[]);
      expect(yaml).toContain('name: uppercase');
    });

    it('replaces spaces with hyphens', () => {
      const yaml = generator.generatePlan('my wave name', mockVMs as VirtualMachine[]);
      expect(yaml).toContain('name: my-wave-name');
    });

    it('removes special characters', () => {
      const yaml = generator.generatePlan('wave@#$%!', mockVMs as VirtualMachine[]);
      expect(yaml).toContain('name: wave');
    });

    it('truncates to 63 characters', () => {
      const longName = 'a'.repeat(100);
      const yaml = generator.generatePlan(longName, mockVMs as VirtualMachine[]);

      // Extract the name value
      const nameMatch = yaml.match(/name: ([a-z]+)/);
      expect(nameMatch?.[1]?.length).toBeLessThanOrEqual(63);
    });
  });
});

describe('downloadBlob', () => {
  beforeEach(() => {
    // Mock DOM methods
    global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
    global.URL.revokeObjectURL = vi.fn();

    // Mock document.createElement and body methods
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
    const blob = new Blob(['test content'], { type: 'text/plain' });
    downloadBlob(blob, 'test.txt');

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});

describe('downloadYAML', () => {
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

  it('creates blob with yaml content type', () => {
    downloadYAML('key: value', 'config.yaml');

    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});
