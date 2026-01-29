import { describe, it, expect } from 'vitest';
import { getAutoExclusion, getAutoExclusionMap, NO_AUTO_EXCLUSION } from './autoExclusion';
import type { VirtualMachine } from '@/types/rvtools';

// Helper to create a minimal VM for testing
function createVM(overrides: Partial<VirtualMachine> = {}): VirtualMachine {
  return {
    vmName: 'test-vm',
    powerState: 'poweredOn',
    template: false,
    srmPlaceholder: false,
    configStatus: 'green',
    dnsName: null,
    connectionState: 'connected',
    guestState: 'running',
    heartbeat: 'green',
    consolidationNeeded: false,
    powerOnDate: null,
    suspendedToMemory: false,
    suspendTime: null,
    creationDate: null,
    cpus: 4,
    memory: 8192,
    nics: 1,
    disks: 1,
    resourcePool: null,
    folder: null,
    vApp: null,
    ftState: null,
    ftRole: null,
    cbrcEnabled: false,
    hardwareVersion: 'vmx-19',
    guestOS: 'Red Hat Enterprise Linux 9 (64-bit)',
    osToolsConfig: '',
    guestHostname: null,
    guestIP: null,
    annotation: null,
    datacenter: 'DC1',
    cluster: 'Cluster1',
    host: 'host1',
    provisionedMiB: 102400,
    inUseMiB: 51200,
    uuid: 'test-uuid-123',
    firmwareType: 'BIOS',
    latencySensitivity: null,
    cbtEnabled: false,
    ...overrides,
  };
}

describe('getAutoExclusion', () => {
  it('returns no exclusion for a normal powered-on VM', () => {
    const vm = createVM();
    const result = getAutoExclusion(vm);

    expect(result.isAutoExcluded).toBe(false);
    expect(result.reasons).toEqual([]);
    expect(result.labels).toEqual([]);
  });

  it('excludes template VMs', () => {
    const vm = createVM({ template: true });
    const result = getAutoExclusion(vm);

    expect(result.isAutoExcluded).toBe(true);
    expect(result.reasons).toContain('template');
    expect(result.labels).toContain('Template');
  });

  it('excludes powered-off VMs', () => {
    const vm = createVM({ powerState: 'poweredOff' });
    const result = getAutoExclusion(vm);

    expect(result.isAutoExcluded).toBe(true);
    expect(result.reasons).toContain('powered-off');
    expect(result.labels).toContain('Powered Off');
  });

  it('excludes suspended VMs', () => {
    const vm = createVM({ powerState: 'suspended' });
    const result = getAutoExclusion(vm);

    expect(result.isAutoExcluded).toBe(true);
    expect(result.reasons).toContain('powered-off');
    expect(result.labels).toContain('Powered Off');
  });

  it('excludes VMware infrastructure VMs (NSX)', () => {
    const vm = createVM({ vmName: 'nsx-edge-01' });
    const result = getAutoExclusion(vm);

    expect(result.isAutoExcluded).toBe(true);
    expect(result.labels).toContain('VMware Infrastructure');
  });

  it('excludes VMware infrastructure VMs (vCLS)', () => {
    const vm = createVM({ vmName: 'vCLS-abc123' });
    const result = getAutoExclusion(vm);

    expect(result.isAutoExcluded).toBe(true);
    expect(result.labels).toContain('VMware Infrastructure');
  });

  it('excludes VMware infrastructure VMs (vCenter)', () => {
    const vm = createVM({ vmName: 'vcenter-appliance-01' });
    const result = getAutoExclusion(vm);

    expect(result.isAutoExcluded).toBe(true);
    expect(result.labels).toContain('VMware Infrastructure');
  });

  it('excludes cust-edge network appliances via pattern', () => {
    const vm = createVM({ vmName: 'cust-edge-01' });
    const result = getAutoExclusion(vm);

    expect(result.isAutoExcluded).toBe(true);
    expect(result.reasons).toContain('network-edge-appliance');
    // cust-edge is excluded from VMware regex patterns via excludePatterns
    expect(result.labels).not.toContain('VMware Infrastructure');
    expect(result.labels).toContain('Network Edge Appliance');
  });

  it('excludes service-edge network appliances via pattern', () => {
    const vm = createVM({ vmName: 'service-edge-02' });
    const result = getAutoExclusion(vm);

    expect(result.isAutoExcluded).toBe(true);
    expect(result.reasons).toContain('network-edge-appliance');
    expect(result.labels).not.toContain('VMware Infrastructure');
    expect(result.labels).toContain('Network Edge Appliance');
  });

  it('excludes Windows AD/DNS servers (ADNSvcs*)', () => {
    const vm = createVM({ vmName: 'ADNSvcs-prod-01' });
    const result = getAutoExclusion(vm);

    expect(result.isAutoExcluded).toBe(true);
    expect(result.reasons).toContain('windows-adns');
    expect(result.labels).toContain('Windows AD/DNS');
  });

  it('excludes ADNSvcs VMs case-insensitively', () => {
    const vm = createVM({ vmName: 'adnsvcs-test-02' });
    const result = getAutoExclusion(vm);

    expect(result.isAutoExcluded).toBe(true);
    expect(result.reasons).toContain('windows-adns');
  });

  it('can have multiple exclusion reasons', () => {
    const vm = createVM({
      template: true,
      powerState: 'poweredOff',
      vmName: 'nsx-manager-template',
    });
    const result = getAutoExclusion(vm);

    expect(result.isAutoExcluded).toBe(true);
    expect(result.reasons.length).toBeGreaterThanOrEqual(3);
    expect(result.reasons).toContain('template');
    expect(result.reasons).toContain('powered-off');
    // VMware infrastructure label should appear (deduplicated)
    expect(result.labels).toContain('Template');
    expect(result.labels).toContain('Powered Off');
    expect(result.labels).toContain('VMware Infrastructure');
  });

  it('deduplicates labels when multiple VMware rules match', () => {
    // nsx-edge matches both nsx-edge contains rule and edge regex rule
    const vm = createVM({ vmName: 'nsx-edge-01' });
    const result = getAutoExclusion(vm);

    // Should have VMware Infrastructure label only once
    const vmwareLabels = result.labels.filter(l => l === 'VMware Infrastructure');
    expect(vmwareLabels).toHaveLength(1);
  });
});

describe('getAutoExclusionMap', () => {
  it('returns empty map for empty array', () => {
    const map = getAutoExclusionMap([]);
    expect(map.size).toBe(0);
  });

  it('creates map keyed by VM identifier', () => {
    const vms = [
      createVM({ vmName: 'vm1', uuid: 'uuid-1' }),
      createVM({ vmName: 'vm2', uuid: 'uuid-2', powerState: 'poweredOff' }),
      createVM({ vmName: 'nsx-edge-01', uuid: 'uuid-3' }),
    ];

    const map = getAutoExclusionMap(vms);
    expect(map.size).toBe(3);

    const vm1Result = map.get('vm1::uuid-1');
    expect(vm1Result?.isAutoExcluded).toBe(false);

    const vm2Result = map.get('vm2::uuid-2');
    expect(vm2Result?.isAutoExcluded).toBe(true);
    expect(vm2Result?.labels).toContain('Powered Off');

    const nsxResult = map.get('nsx-edge-01::uuid-3');
    expect(nsxResult?.isAutoExcluded).toBe(true);
    expect(nsxResult?.labels).toContain('VMware Infrastructure');
  });
});

describe('NO_AUTO_EXCLUSION', () => {
  it('represents a non-excluded state', () => {
    expect(NO_AUTO_EXCLUSION.isAutoExcluded).toBe(false);
    expect(NO_AUTO_EXCLUSION.reasons).toEqual([]);
    expect(NO_AUTO_EXCLUSION.labels).toEqual([]);
  });
});
