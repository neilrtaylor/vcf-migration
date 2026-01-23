// Unit tests for vDatastore parser
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseVDatastore } from './vDatastoreParser';

function createMockSheet(headers: string[], rows: unknown[][]): XLSX.WorkSheet {
  const data = [headers, ...rows];
  return XLSX.utils.aoa_to_sheet(data);
}

describe('parseVDatastore', () => {
  describe('basic parsing', () => {
    it('parses datastore data with standard column names', () => {
      const headers = [
        'Name', 'Type', 'Accessible', 'Capacity MB', 'Free MB', 'Free %',
        '# VMs', 'Datacenter', 'Cluster'
      ];
      const rows = [
        ['datastore1', 'VMFS', true, 2097152, 1048576, 50, 25, 'DC1', 'Prod-Cluster'],
        ['datastore2', 'NFS', true, 4194304, 3145728, 75, 10, 'DC1', 'Prod-Cluster'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDatastore(sheet);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        name: 'datastore1',
        type: 'VMFS',
        accessible: true,
        capacityMiB: 2097152,
        freeMiB: 1048576,
        freePercent: 50,
        vmCount: 25,
        datacenter: 'DC1',
        cluster: 'Prod-Cluster',
      });
      expect(result[1]).toMatchObject({
        name: 'datastore2',
        type: 'NFS',
        freePercent: 75,
      });
    });

    it('parses datastore data with alternative column names', () => {
      const headers = [
        'Datastore Name', 'Datastore Type', 'Capacity MiB', 'Free MiB',
        'VM Count', 'Datacenter'
      ];
      const rows = [
        ['vsan-datastore', 'vsan', 8388608, 4194304, 50, 'DC2'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDatastore(sheet);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'vsan-datastore',
        type: 'vsan',
        capacityMiB: 8388608,
        freeMiB: 4194304,
        vmCount: 50,
      });
    });
  });

  describe('capacity fields', () => {
    it('parses all capacity-related fields', () => {
      const headers = [
        'Name', 'Capacity MB', 'Provisioned MB', 'In Use MB', 'Free MB', 'Free %', 'Datacenter'
      ];
      const rows = [
        ['datastore1', 1048576, 2097152, 524288, 524288, 50, 'DC1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDatastore(sheet);

      expect(result[0].capacityMiB).toBe(1048576);
      expect(result[0].provisionedMiB).toBe(2097152);
      expect(result[0].inUseMiB).toBe(524288);
      expect(result[0].freeMiB).toBe(524288);
      expect(result[0].freePercent).toBe(50);
    });

    it('handles over-provisioned datastores', () => {
      const headers = ['Name', 'Capacity MB', 'Provisioned MB', 'Datacenter'];
      const rows = [
        ['thin-ds', 1048576, 3145728, 'DC1'], // 300% provisioned
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDatastore(sheet);

      expect(result[0].capacityMiB).toBe(1048576);
      expect(result[0].provisionedMiB).toBe(3145728);
    });
  });

  describe('VM counts', () => {
    it('parses VM count and total VM count', () => {
      const headers = ['Name', '# VMs', '# VM Total', 'Datacenter'];
      const rows = [
        ['datastore1', 20, 25, 'DC1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDatastore(sheet);

      expect(result[0].vmCount).toBe(20);
      expect(result[0].vmTotalCount).toBe(25);
    });
  });

  describe('SIOC settings', () => {
    it('parses SIOC enabled and threshold', () => {
      const headers = ['Name', 'SIOC Enabled', 'SIOC Threshold', 'Datacenter'];
      const rows = [
        ['datastore1', true, 30, 'DC1'],
        ['datastore2', false, 0, 'DC1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDatastore(sheet);

      expect(result[0].siocEnabled).toBe(true);
      expect(result[0].siocThreshold).toBe(30);
      expect(result[1].siocEnabled).toBe(false);
    });

    it('returns null for missing SIOC threshold', () => {
      const headers = ['Name', 'Datacenter'];
      const rows = [['datastore1', 'DC1']];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDatastore(sheet);

      expect(result[0].siocThreshold).toBeNull();
    });
  });

  describe('host count', () => {
    it('parses numeric host count from # Hosts column', () => {
      const headers = ['Name', '# Hosts', 'Datacenter'];
      const rows = [
        ['shared-ds', 8, 'DC1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDatastore(sheet);

      expect(result[0].hostCount).toBe(8);
    });

    it('calculates host count from comma-separated host names in # Hosts column', () => {
      const headers = ['Name', '# Hosts', 'Datacenter'];
      const rows = [
        ['shared-ds', 'host1.example.com, host2.example.com, host3.example.com', 'DC1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDatastore(sheet);

      expect(result[0].hostCount).toBe(3);
    });

    it('parses host names from separate Hosts column', () => {
      const headers = ['Name', 'Hosts', 'Datacenter'];
      const rows = [
        ['shared-ds', 'host1.example.com, host2.example.com', 'DC1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDatastore(sheet);

      expect(result[0].hosts).toBe('host1.example.com, host2.example.com');
      expect(result[0].hostCount).toBe(2);
    });

    it('handles single host', () => {
      const headers = ['Name', '# Hosts', 'Datacenter'];
      const rows = [
        ['local-ds', 'host1.example.com', 'DC1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDatastore(sheet);

      expect(result[0].hostCount).toBe(1);
    });

    it('handles empty hosts', () => {
      const headers = ['Name', '# Hosts', 'Datacenter'];
      const rows = [
        ['orphan-ds', '', 'DC1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDatastore(sheet);

      expect(result[0].hostCount).toBe(0);
    });
  });

  describe('status and address', () => {
    it('parses config status', () => {
      const headers = ['Name', 'Config Status', 'Datacenter'];
      const rows = [
        ['datastore1', 'green', 'DC1'],
        ['datastore2', 'yellow', 'DC1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDatastore(sheet);

      expect(result[0].configStatus).toBe('green');
      expect(result[1].configStatus).toBe('yellow');
    });

    it('parses address for NFS datastores', () => {
      const headers = ['Name', 'Type', 'Address', 'Datacenter'];
      const rows = [
        ['nfs-ds', 'NFS', '192.168.1.100:/exports/vmware', 'DC1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDatastore(sheet);

      expect(result[0].address).toBe('192.168.1.100:/exports/vmware');
    });

    it('returns null for missing address', () => {
      const headers = ['Name', 'Datacenter'];
      const rows = [['datastore1', 'DC1']];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDatastore(sheet);

      expect(result[0].address).toBeNull();
    });
  });

  describe('datastore types', () => {
    it('parses various datastore types', () => {
      const headers = ['Name', 'Type', 'Datacenter'];
      const rows = [
        ['vmfs-ds', 'VMFS', 'DC1'],
        ['nfs-ds', 'NFS', 'DC1'],
        ['vsan-ds', 'vsan', 'DC1'],
        ['vvol-ds', 'VVOL', 'DC1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDatastore(sheet);

      expect(result[0].type).toBe('VMFS');
      expect(result[1].type).toBe('NFS');
      expect(result[2].type).toBe('vsan');
      expect(result[3].type).toBe('VVOL');
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty sheet', () => {
      const sheet = XLSX.utils.aoa_to_sheet([]);
      const result = parseVDatastore(sheet);
      expect(result).toEqual([]);
    });

    it('filters out rows without name', () => {
      const headers = ['Name', 'Type', 'Datacenter'];
      const rows = [
        ['datastore1', 'VMFS', 'DC1'],
        ['', 'NFS', 'DC1'],
        ['datastore2', 'VMFS', 'DC1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDatastore(sheet);

      expect(result).toHaveLength(2);
    });

    it('returns null for missing cluster', () => {
      const headers = ['Name', 'Datacenter'];
      const rows = [['datastore1', 'DC1']];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDatastore(sheet);

      expect(result[0].cluster).toBeNull();
    });
  });
});
