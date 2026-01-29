// Network Summary Table component - Port groups with VM counts and subnet editing
import { useMemo, useState, useCallback } from 'react';
import { Tag, TextInput, InlineNotification } from '@carbon/react';
import { Edit } from '@carbon/icons-react';
import { useSubnetOverrides, isValidCIDRList } from '@/hooks';
import { EnhancedDataTable } from '@/components/tables';
import type { ColumnDef } from '@tanstack/react-table';
import type { VNetworkInfo } from '@/types/rvtools';
import './NetworkSummaryTable.scss';

interface NetworkSummaryRow {
  [key: string]: unknown;
  portGroup: string;
  vSwitch: string;
  vmCount: number;
  nicCount: number;
  guessedSubnet: string;
  subnet: string;        // Final subnet (override or guessed)
  hasOverride: boolean;  // Whether user has set a manual subnet
  sampleIPs: string;
}

interface NetworkSummaryTableProps {
  networks: VNetworkInfo[];
  className?: string;
}

export function NetworkSummaryTable({ networks, className }: NetworkSummaryTableProps) {
  const subnetOverrides = useSubnetOverrides();
  const [editingPortGroup, setEditingPortGroup] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Handlers for inline subnet editing
  const handleStartEdit = useCallback((portGroup: string, currentSubnet: string) => {
    setEditingPortGroup(portGroup);
    setEditValue(currentSubnet === 'N/A' ? '' : currentSubnet);
  }, []);

  const handleSaveEdit = useCallback((portGroup: string) => {
    if (editValue.trim() === '' || editValue === 'N/A') {
      subnetOverrides.removeOverride(portGroup);
    } else if (isValidCIDRList(editValue.trim())) {
      subnetOverrides.setSubnet(portGroup, editValue.trim());
    }
    setEditingPortGroup(null);
    setEditValue('');
  }, [editValue, subnetOverrides]);

  const handleCancelEdit = useCallback(() => {
    setEditingPortGroup(null);
    setEditValue('');
  }, []);

  const networkSummaryData = useMemo(() => {
    // Group NICs by port group
    const portGroupMap = new Map<string, {
      vSwitch: string;
      vmNames: Set<string>;
      nicCount: number;
      ips: string[];
    }>();

    networks.forEach(nic => {
      const pg = nic.networkName || 'Unknown';
      if (!portGroupMap.has(pg)) {
        portGroupMap.set(pg, {
          vSwitch: nic.switchName || 'Unknown',
          vmNames: new Set(),
          nicCount: 0,
          ips: [],
        });
      }
      const data = portGroupMap.get(pg)!;
      data.vmNames.add(nic.vmName);
      data.nicCount++;
      if (nic.ipv4Address) {
        data.ips.push(nic.ipv4Address);
      }
    });

    // Convert to array and guess subnets
    const result: NetworkSummaryRow[] = [];
    portGroupMap.forEach((data, portGroup) => {
      // Subnet guessing: find ALL unique prefixes (first 3 octets)
      let guessedSubnet = 'N/A';
      if (data.ips.length > 0) {
        const uniquePrefixes = new Set<string>();
        data.ips.forEach(ip => {
          const parts = ip.split('.');
          if (parts.length >= 3) {
            const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
            uniquePrefixes.add(prefix);
          }
        });
        // Convert all unique prefixes to CIDR notation
        const subnets = Array.from(uniquePrefixes)
          .sort()
          .map(prefix => `${prefix}.0/24`);
        if (subnets.length > 0) {
          guessedSubnet = subnets.join(', ');
        }
      }

      // Check for user override
      const hasOverride = subnetOverrides.hasOverride(portGroup);
      const subnet = hasOverride
        ? subnetOverrides.getSubnet(portGroup)!
        : guessedSubnet;

      result.push({
        portGroup,
        vSwitch: data.vSwitch,
        vmCount: data.vmNames.size,
        nicCount: data.nicCount,
        guessedSubnet,
        subnet,
        hasOverride,
        sampleIPs: data.ips.slice(0, 3).join(', ') || 'N/A',
      });
    });

    return result.sort((a, b) => b.vmCount - a.vmCount);
  }, [networks, subnetOverrides]);

  const networkSummaryColumns: ColumnDef<NetworkSummaryRow>[] = useMemo(() => [
    { accessorKey: 'portGroup', header: 'Port Group' },
    { accessorKey: 'vSwitch', header: 'vSwitch' },
    { accessorKey: 'vmCount', header: 'VMs' },
    { accessorKey: 'nicCount', header: 'NICs' },
    {
      accessorKey: 'subnet',
      header: 'Subnet',
      cell: ({ row }) => {
        const portGroup = row.original.portGroup;
        const subnet = row.original.subnet;
        const hasOverride = row.original.hasOverride;
        const isEditing = editingPortGroup === portGroup;

        // Parse subnets for display
        const subnets = subnet === 'N/A' ? [] : subnet.split(',').map(s => s.trim());
        const hasMultiple = subnets.length > 1;

        if (isEditing) {
          return (
            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
              <TextInput
                id={`subnet-edit-${portGroup}`}
                labelText=""
                hideLabel
                size="sm"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit(portGroup);
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                placeholder="e.g., 10.0.1.0/24, 10.0.2.0/24"
                invalid={editValue.trim() !== '' && editValue !== 'N/A' && !isValidCIDRList(editValue.trim())}
                invalidText="Invalid CIDR format (use comma to separate multiple)"
                style={{ width: '220px' }}
                autoFocus
              />
              <button
                onClick={() => handleSaveEdit(portGroup)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#24a148', fontSize: '1rem' }}
                title="Save"
              >
                ✓
              </button>
              <button
                onClick={handleCancelEdit}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#da1e28', fontSize: '1rem' }}
                title="Cancel"
              >
                ✗
              </button>
            </div>
          );
        }

        return (
          <div
            className="network-summary-table__editable-cell"
            onClick={() => handleStartEdit(portGroup, subnet)}
            title="Click to edit subnet"
          >
            <div className="network-summary-table__editable-cell-content">
              {subnet === 'N/A' ? (
                <span style={{ color: '#6f6f6f' }}>N/A</span>
              ) : (
                subnets.map((s, idx) => (
                  <Tag key={idx} type={hasMultiple ? 'purple' : 'gray'} size="sm">
                    {s}
                  </Tag>
                ))
              )}
              {!hasOverride && subnet !== 'N/A' && (
                <Tag type="outline" size="sm">Guessed</Tag>
              )}
            </div>
            <Edit size={14} className="network-summary-table__edit-icon" />
          </div>
        );
      },
    },
    { accessorKey: 'sampleIPs', header: 'Sample IPs' },
  ], [editingPortGroup, editValue, handleStartEdit, handleSaveEdit, handleCancelEdit]);

  return (
    <div className={className}>
      <InlineNotification
        kind="info"
        lowContrast
        hideCloseButton
        title="Editable subnets:"
        subtitle="Click any subnet cell to manually enter or correct the CIDR notation. Use commas to specify multiple subnets. Your changes are saved automatically."
        className="network-summary-table__edit-instruction"
      />
      <EnhancedDataTable
        data={networkSummaryData}
        columns={networkSummaryColumns}
        defaultPageSize={10}
      />
    </div>
  );
}
