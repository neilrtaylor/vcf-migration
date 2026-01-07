// MTV (Migration Toolkit for Virtualization) YAML type definitions
// Based on Forklift Operator CRDs

export interface MTVMetadata {
  name: string;
  namespace: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

// Provider CRD
export interface MTVProvider {
  apiVersion: 'forklift.konveyor.io/v1beta1';
  kind: 'Provider';
  metadata: MTVMetadata;
  spec: {
    type: 'vsphere' | 'ovirt' | 'openstack';
    url?: string;
    secret?: {
      name: string;
      namespace: string;
    };
    settings?: Record<string, string>;
  };
}

// NetworkMap CRD
export interface MTVNetworkMap {
  apiVersion: 'forklift.konveyor.io/v1beta1';
  kind: 'NetworkMap';
  metadata: MTVMetadata;
  spec: {
    map: NetworkMapEntry[];
    provider: {
      source: {
        name: string;
        namespace: string;
      };
      destination: {
        name: string;
        namespace: string;
      };
    };
  };
}

export interface NetworkMapEntry {
  source: {
    id?: string;
    name?: string;
    type?: string;
  };
  destination: {
    type: 'pod' | 'multus';
    name?: string;
    namespace?: string;
  };
}

// StorageMap CRD
export interface MTVStorageMap {
  apiVersion: 'forklift.konveyor.io/v1beta1';
  kind: 'StorageMap';
  metadata: MTVMetadata;
  spec: {
    map: StorageMapEntry[];
    provider: {
      source: {
        name: string;
        namespace: string;
      };
      destination: {
        name: string;
        namespace: string;
      };
    };
  };
}

export interface StorageMapEntry {
  source: {
    id?: string;
    name?: string;
  };
  destination: {
    storageClass: string;
    accessMode?: 'ReadWriteOnce' | 'ReadWriteMany' | 'ReadOnlyMany';
    volumeMode?: 'Filesystem' | 'Block';
  };
}

// Plan CRD
export interface MTVPlan {
  apiVersion: 'forklift.konveyor.io/v1beta1';
  kind: 'Plan';
  metadata: MTVMetadata;
  spec: {
    warm?: boolean;
    archived?: boolean;
    targetNamespace: string;
    provider: {
      source: {
        name: string;
        namespace: string;
      };
      destination: {
        name: string;
        namespace: string;
      };
    };
    map: {
      network: {
        name: string;
        namespace: string;
      };
      storage: {
        name: string;
        namespace: string;
      };
    };
    vms: VMReference[];
    preserveClusterCpuModel?: boolean;
    preserveStaticIPs?: boolean;
  };
}

export interface VMReference {
  id?: string;
  name?: string;
  hooks?: VMHook[];
}

export interface VMHook {
  hook: {
    name: string;
    namespace: string;
  };
  step: 'PreHook' | 'PostHook';
}

// Migration CRD (created from Plan)
export interface MTVMigration {
  apiVersion: 'forklift.konveyor.io/v1beta1';
  kind: 'Migration';
  metadata: MTVMetadata;
  spec: {
    plan: {
      name: string;
      namespace: string;
    };
    cutover?: string; // ISO 8601 date-time
  };
}

// Export options for YAML generation
export interface MTVExportOptions {
  namespace: string;
  sourceProviderName: string;
  destinationProviderName: string;
  networkMapName: string;
  storageMapName: string;
  defaultStorageClass: string;
  targetNamespace: string;
  warm?: boolean;
  preserveStaticIPs?: boolean;
}
