// Migration Strategy Section

import { Paragraph, Table, TableRow, PageBreak, HeadingLevel, BorderStyle, AlignmentType } from 'docx';
import type { RVToolsData, VirtualMachine, VNetworkInfo } from '@/types/rvtools';
import type { MigrationInsights } from '@/services/ai/types';
import { mibToGiB } from '@/utils/formatters';
import { STYLES, type DocumentContent, type NetworkWave } from '../types';
import { createHeading, createParagraph, createBulletList, createTableCell, createAISection } from '../utils/helpers';

export function buildMigrationStrategy(rawData: RVToolsData, aiInsights?: MigrationInsights | null): DocumentContent[] {
  const networks = rawData.vNetwork;
  const vms = rawData.vInfo.filter((vm: VirtualMachine) => vm.powerState === 'poweredOn' && !vm.template);

  // Build network summary by port group
  const portGroupMap = new Map<string, {
    vSwitch: string;
    vmNames: Set<string>;
    ips: string[];
  }>();

  networks.forEach((nic: VNetworkInfo) => {
    const pg = nic.networkName || 'Unknown';
    if (!portGroupMap.has(pg)) {
      portGroupMap.set(pg, {
        vSwitch: nic.switchName || 'Unknown',
        vmNames: new Set(),
        ips: [],
      });
    }
    const data = portGroupMap.get(pg)!;
    data.vmNames.add(nic.vmName);
    if (nic.ipv4Address) {
      data.ips.push(nic.ipv4Address);
    }
  });

  // Convert to waves with resource totals
  const networkWaves: NetworkWave[] = [];
  portGroupMap.forEach((data, portGroup) => {
    const vmNames = Array.from(data.vmNames);
    const waveVMs = vms.filter((vm: VirtualMachine) => vmNames.includes(vm.vmName));

    let subnet = 'N/A';
    if (data.ips.length > 0) {
      const prefixCounts = new Map<string, number>();
      data.ips.forEach(ip => {
        const parts = ip.split('.');
        if (parts.length >= 3) {
          const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
          prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
        }
      });
      let maxCount = 0;
      let mostCommonPrefix = '';
      prefixCounts.forEach((count, prefix) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommonPrefix = prefix;
        }
      });
      if (mostCommonPrefix) {
        subnet = `${mostCommonPrefix}.0/24`;
      }
    }

    networkWaves.push({
      portGroup,
      vSwitch: data.vSwitch,
      vmCount: waveVMs.length,
      vcpus: waveVMs.reduce((sum: number, vm: VirtualMachine) => sum + vm.cpus, 0),
      memoryGiB: Math.round(waveVMs.reduce((sum: number, vm: VirtualMachine) => sum + mibToGiB(vm.memory), 0)),
      storageGiB: Math.round(waveVMs.reduce((sum: number, vm: VirtualMachine) => sum + mibToGiB(vm.provisionedMiB), 0)),
      subnet,
    });
  });

  networkWaves.sort((a, b) => a.vmCount - b.vmCount);
  const topWaves = networkWaves.slice(0, 20);

  const sections: DocumentContent[] = [
    createHeading('5. Migration Strategy', HeadingLevel.HEADING_1),
    createParagraph(
      'This section outlines the recommended migration approach based on network topology analysis. Migrating workloads by subnet or port group minimizes network reconfiguration and reduces risk during cutover.',
      { spacing: { after: 200 } }
    ),

    createHeading('5.1 Subnet-Based Migration Approach', HeadingLevel.HEADING_2),
    createParagraph(
      'The recommended migration strategy groups virtual machines by their network port group (subnet). This approach is preferred for both ROKS and VSI migrations because:',
      { spacing: { after: 120 } }
    ),
    ...createBulletList([
      'Network Continuity: VMs within the same subnet typically communicate with each other. Migrating them together maintains application functionality during cutover.',
      'Simplified Cutover: Entire subnets can be switched over at once, reducing the complexity of managing split-brain scenarios during migration.',
      'Consistent IP Addressing: Preserving IP addresses within a migrated subnet reduces the need for DNS updates and application reconfiguration.',
      'Predictable Waves: Port groups provide natural migration wave boundaries with known VM counts and resource requirements.',
      'Reduced Testing Scope: Each wave can be validated as a unit before proceeding to the next, with clear rollback boundaries.',
    ]),

    createHeading('5.2 ROKS Migration Considerations', HeadingLevel.HEADING_2),
    createParagraph(
      'For ROKS with OpenShift Virtualization, subnet-based migration aligns with the Migration Toolkit for Virtualization (MTV) workflow:',
      { spacing: { after: 120 } }
    ),
    ...createBulletList([
      'MTV supports network mapping to translate VMware port groups to OpenShift network attachment definitions',
      'OVN-Kubernetes secondary networks can mirror the original VLAN structure for seamless connectivity',
      'VMs can retain their original IP addresses when migrated to appropriately configured secondary networks',
      'Migration plans in MTV naturally map to port group waves, enabling orchestrated cutover',
    ]),

    createHeading('5.3 VSI Migration Considerations', HeadingLevel.HEADING_2),
    createParagraph(
      'For VPC Virtual Server migration, subnet-based waves simplify VPC network design:',
      { spacing: { after: 120 } }
    ),
    ...createBulletList([
      'Each VMware port group maps to a VPC subnet with equivalent CIDR range',
      'Security groups can be pre-configured to match existing firewall rules before migration',
      'VPN or Direct Link connectivity can route traffic to migrated subnets during transition',
      'Phased cutover allows gradual DNS updates as each subnet completes migration',
    ]),

    createHeading('5.4 Network Wave Summary', HeadingLevel.HEADING_2),
    createParagraph(
      `The environment contains ${networkWaves.length} unique port groups. The following table shows the proposed migration waves based on network topology:`,
      { spacing: { after: 120 } }
    ),
    new Table({
      width: { size: 100, type: 'pct' as const },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
        left: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
        right: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
      },
      rows: [
        new TableRow({
          children: [
            createTableCell('Wave', { header: true }),
            createTableCell('Port Group', { header: true }),
            createTableCell('Subnet', { header: true }),
            createTableCell('VMs', { header: true, align: AlignmentType.RIGHT }),
            createTableCell('vCPUs', { header: true, align: AlignmentType.RIGHT }),
            createTableCell('Memory', { header: true, align: AlignmentType.RIGHT }),
          ],
        }),
        ...topWaves.map((wave, idx) =>
          new TableRow({
            children: [
              createTableCell(`Wave ${idx + 1}`),
              createTableCell(wave.portGroup.length > 25 ? wave.portGroup.substring(0, 22) + '...' : wave.portGroup),
              createTableCell(wave.subnet),
              createTableCell(`${wave.vmCount}`, { align: AlignmentType.RIGHT }),
              createTableCell(`${wave.vcpus}`, { align: AlignmentType.RIGHT }),
              createTableCell(`${wave.memoryGiB} GiB`, { align: AlignmentType.RIGHT }),
            ],
          })
        ),
      ],
    }),
    networkWaves.length > 20 ? createParagraph(
      `Note: Showing 20 of ${networkWaves.length} port groups. Smaller waves are listed first to identify pilot migration candidates.`,
      { spacing: { before: 120 } }
    ) : new Paragraph({}),
  ];

  // Add AI migration strategy if available
  if (aiInsights?.migrationStrategy) {
    sections.push(
      ...createAISection(
        '5.5 AI Migration Strategy',
        aiInsights.migrationStrategy,
        HeadingLevel.HEADING_2
      )
    );
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }));

  return sections;
}
