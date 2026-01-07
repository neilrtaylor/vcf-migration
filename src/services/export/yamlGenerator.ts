// MTV YAML Generator Service
import type {
  MTVPlan,
  MTVNetworkMap,
  MTVStorageMap,
  MTVExportOptions,
  NetworkMapEntry,
  StorageMapEntry,
  VMReference,
} from '@/types/mtvYaml';
import type { VNetworkInfo, VDatastoreInfo, VirtualMachine } from '@/types/rvtools';

// Simple YAML serializer (avoiding additional dependency)
function toYAML(obj: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent);

  if (obj === null || obj === undefined) {
    return 'null';
  }

  if (typeof obj === 'boolean') {
    return obj ? 'true' : 'false';
  }

  if (typeof obj === 'number') {
    return String(obj);
  }

  if (typeof obj === 'string') {
    // Quote strings that need quoting
    if (obj.includes(':') || obj.includes('#') || obj.includes('\n') ||
        obj.startsWith(' ') || obj.endsWith(' ') || /^\d/.test(obj) ||
        obj === 'true' || obj === 'false' || obj === 'null' || obj === '') {
      return `"${obj.replace(/"/g, '\\"')}"`;
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj.map(item => {
      const itemYaml = toYAML(item, indent + 1);
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        // Complex object - format with proper indentation
        const lines = itemYaml.split('\n');
        return `${spaces}- ${lines[0]}\n${lines.slice(1).map(l => `${spaces}  ${l}`).join('\n')}`;
      }
      return `${spaces}- ${itemYaml}`;
    }).join('\n');
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '{}';

    return entries.map(([key, value]) => {
      const valueYaml = toYAML(value, indent + 1);
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return `${key}:\n${'  '.repeat(indent + 1)}${valueYaml.split('\n').join('\n' + '  '.repeat(indent + 1))}`;
      }
      if (Array.isArray(value)) {
        return `${key}:\n${valueYaml}`;
      }
      return `${key}: ${valueYaml}`;
    }).join('\n' + spaces);
  }

  return String(obj);
}

// Format as proper YAML document
function formatYAMLDocument(obj: unknown): string {
  const yaml = toYAML(obj);
  return `---\n${yaml}\n`;
}

export class MTVYAMLGenerator {
  private options: MTVExportOptions;

  constructor(options: MTVExportOptions) {
    this.options = options;
  }

  /**
   * Generate a Migration Plan CRD for a wave of VMs
   */
  generatePlan(waveName: string, vms: VirtualMachine[]): string {
    const plan: MTVPlan = {
      apiVersion: 'forklift.konveyor.io/v1beta1',
      kind: 'Plan',
      metadata: {
        name: this.sanitizeName(waveName),
        namespace: this.options.namespace,
        labels: {
          'app.kubernetes.io/managed-by': 'rvtools-analyzer',
        },
      },
      spec: {
        warm: this.options.warm ?? false,
        targetNamespace: this.options.targetNamespace,
        provider: {
          source: {
            name: this.options.sourceProviderName,
            namespace: this.options.namespace,
          },
          destination: {
            name: this.options.destinationProviderName,
            namespace: this.options.namespace,
          },
        },
        map: {
          network: {
            name: this.options.networkMapName,
            namespace: this.options.namespace,
          },
          storage: {
            name: this.options.storageMapName,
            namespace: this.options.namespace,
          },
        },
        vms: vms.map(vm => this.vmToReference(vm)),
        preserveStaticIPs: this.options.preserveStaticIPs ?? false,
      },
    };

    return formatYAMLDocument(plan);
  }

  /**
   * Generate a NetworkMap CRD from network info
   */
  generateNetworkMap(networks: VNetworkInfo[]): string {
    // Get unique network names
    const uniqueNetworks = new Map<string, VNetworkInfo>();
    networks.forEach(net => {
      if (!uniqueNetworks.has(net.networkName)) {
        uniqueNetworks.set(net.networkName, net);
      }
    });

    const networkMap: MTVNetworkMap = {
      apiVersion: 'forklift.konveyor.io/v1beta1',
      kind: 'NetworkMap',
      metadata: {
        name: this.options.networkMapName,
        namespace: this.options.namespace,
        labels: {
          'app.kubernetes.io/managed-by': 'rvtools-analyzer',
        },
      },
      spec: {
        map: Array.from(uniqueNetworks.values()).map(net => this.networkToMapEntry(net)),
        provider: {
          source: {
            name: this.options.sourceProviderName,
            namespace: this.options.namespace,
          },
          destination: {
            name: this.options.destinationProviderName,
            namespace: this.options.namespace,
          },
        },
      },
    };

    return formatYAMLDocument(networkMap);
  }

  /**
   * Generate a StorageMap CRD from datastore info
   */
  generateStorageMap(datastores: VDatastoreInfo[]): string {
    // Get unique datastore names
    const uniqueDatastores = new Map<string, VDatastoreInfo>();
    datastores.forEach(ds => {
      if (!uniqueDatastores.has(ds.name)) {
        uniqueDatastores.set(ds.name, ds);
      }
    });

    const storageMap: MTVStorageMap = {
      apiVersion: 'forklift.konveyor.io/v1beta1',
      kind: 'StorageMap',
      metadata: {
        name: this.options.storageMapName,
        namespace: this.options.namespace,
        labels: {
          'app.kubernetes.io/managed-by': 'rvtools-analyzer',
        },
      },
      spec: {
        map: Array.from(uniqueDatastores.values()).map(ds => this.datastoreToMapEntry(ds)),
        provider: {
          source: {
            name: this.options.sourceProviderName,
            namespace: this.options.namespace,
          },
          destination: {
            name: this.options.destinationProviderName,
            namespace: this.options.namespace,
          },
        },
      },
    };

    return formatYAMLDocument(storageMap);
  }

  /**
   * Generate all YAML files and bundle them
   */
  async generateBundle(
    waves: { name: string; vms: VirtualMachine[] }[],
    networks: VNetworkInfo[],
    datastores: VDatastoreInfo[]
  ): Promise<Blob> {
    const files: { name: string; content: string }[] = [];

    // Generate NetworkMap
    files.push({
      name: 'network-map.yaml',
      content: this.generateNetworkMap(networks),
    });

    // Generate StorageMap
    files.push({
      name: 'storage-map.yaml',
      content: this.generateStorageMap(datastores),
    });

    // Generate Plan for each wave
    waves.forEach((wave, index) => {
      files.push({
        name: `plan-wave-${index + 1}-${this.sanitizeName(wave.name)}.yaml`,
        content: this.generatePlan(wave.name, wave.vms),
      });
    });

    // Generate combined file
    const combined = files.map(f => `# ${f.name}\n${f.content}`).join('\n');
    files.push({
      name: 'all-resources.yaml',
      content: combined,
    });

    // Create ZIP file
    return this.createZipBlob(files);
  }

  /**
   * Generate a quick preview of what will be generated
   */
  generatePreview(vms: VirtualMachine[]): string {
    const plan = this.generatePlan('preview', vms.slice(0, 3));
    return plan;
  }

  // Private helper methods

  private vmToReference(vm: VirtualMachine): VMReference {
    return {
      name: vm.vmName,
      // UUID is preferred but may not always be available
      ...(vm.uuid && { id: vm.uuid }),
    };
  }

  private networkToMapEntry(network: VNetworkInfo): NetworkMapEntry {
    return {
      source: {
        name: network.networkName,
        type: network.switchName?.includes('dvs') ? 'dvportgroup' : 'network',
      },
      destination: {
        type: 'pod',
        // Default to pod networking - users can customize
        // For multus: type: 'multus', name: 'nad-name', namespace: 'nad-namespace'
      },
    };
  }

  private datastoreToMapEntry(datastore: VDatastoreInfo): StorageMapEntry {
    return {
      source: {
        name: datastore.name,
      },
      destination: {
        storageClass: this.options.defaultStorageClass,
        accessMode: 'ReadWriteOnce',
        volumeMode: 'Filesystem',
      },
    };
  }

  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 63);
  }

  private async createZipBlob(files: { name: string; content: string }[]): Promise<Blob> {
    // Simple ZIP implementation without external dependency
    // For a production app, consider using JSZip

    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    const centralDir: Uint8Array[] = [];
    let offset = 0;

    for (const file of files) {
      const data = encoder.encode(file.content);
      const nameBytes = encoder.encode(file.name);

      // Local file header
      const localHeader = new Uint8Array(30 + nameBytes.length);
      const view = new DataView(localHeader.buffer);

      view.setUint32(0, 0x04034b50, true); // Signature
      view.setUint16(4, 20, true); // Version needed
      view.setUint16(6, 0, true); // Flags
      view.setUint16(8, 0, true); // Compression (none)
      view.setUint16(10, 0, true); // Mod time
      view.setUint16(12, 0, true); // Mod date
      view.setUint32(14, this.crc32(data), true); // CRC
      view.setUint32(18, data.length, true); // Compressed size
      view.setUint32(22, data.length, true); // Uncompressed size
      view.setUint16(26, nameBytes.length, true); // Name length
      view.setUint16(28, 0, true); // Extra length
      localHeader.set(nameBytes, 30);

      chunks.push(localHeader);
      chunks.push(data);

      // Central directory entry
      const centralEntry = new Uint8Array(46 + nameBytes.length);
      const centralView = new DataView(centralEntry.buffer);

      centralView.setUint32(0, 0x02014b50, true); // Signature
      centralView.setUint16(4, 20, true); // Version made by
      centralView.setUint16(6, 20, true); // Version needed
      centralView.setUint16(8, 0, true); // Flags
      centralView.setUint16(10, 0, true); // Compression
      centralView.setUint16(12, 0, true); // Mod time
      centralView.setUint16(14, 0, true); // Mod date
      centralView.setUint32(16, this.crc32(data), true); // CRC
      centralView.setUint32(20, data.length, true); // Compressed size
      centralView.setUint32(24, data.length, true); // Uncompressed size
      centralView.setUint16(28, nameBytes.length, true); // Name length
      centralView.setUint16(30, 0, true); // Extra length
      centralView.setUint16(32, 0, true); // Comment length
      centralView.setUint16(34, 0, true); // Disk number
      centralView.setUint16(36, 0, true); // Internal attributes
      centralView.setUint32(38, 0, true); // External attributes
      centralView.setUint32(42, offset, true); // Relative offset
      centralEntry.set(nameBytes, 46);

      centralDir.push(centralEntry);
      offset += localHeader.length + data.length;
    }

    // Add central directory
    const centralDirOffset = offset;
    let centralDirSize = 0;
    for (const entry of centralDir) {
      chunks.push(entry);
      centralDirSize += entry.length;
    }

    // End of central directory
    const endRecord = new Uint8Array(22);
    const endView = new DataView(endRecord.buffer);
    endView.setUint32(0, 0x06054b50, true); // Signature
    endView.setUint16(4, 0, true); // Disk number
    endView.setUint16(6, 0, true); // Central dir disk
    endView.setUint16(8, files.length, true); // Entries on disk
    endView.setUint16(10, files.length, true); // Total entries
    endView.setUint32(12, centralDirSize, true); // Central dir size
    endView.setUint32(16, centralDirOffset, true); // Central dir offset
    endView.setUint16(20, 0, true); // Comment length

    chunks.push(endRecord);

    // Concatenate all chunks into a single Uint8Array
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const result = new Uint8Array(totalLength);
    let resultOffset = 0;
    for (const chunk of chunks) {
      result.set(chunk, resultOffset);
      resultOffset += chunk.length;
    }

    return new Blob([result], { type: 'application/zip' });
  }

  private crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    const table = this.getCRC32Table();

    for (let i = 0; i < data.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
    }

    return (crc ^ 0xffffffff) >>> 0;
  }

  private crc32Table: Uint32Array | null = null;

  private getCRC32Table(): Uint32Array {
    if (this.crc32Table) return this.crc32Table;

    this.crc32Table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      this.crc32Table[i] = c;
    }

    return this.crc32Table;
  }
}

/**
 * Helper to download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Helper to download YAML as a text file
 */
export function downloadYAML(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/yaml' });
  downloadBlob(blob, filename);
}
