// Assumptions and Scope Section

import { Paragraph, HeadingLevel } from 'docx';
import { type DocumentContent } from '../types';
import { createHeading, createParagraph, createBulletList } from '../utils/helpers';

export function buildAssumptionsAndScope(): DocumentContent[] {
  return [
    createHeading('1.1 Assessment Assumptions & Scope', HeadingLevel.HEADING_2),
    createParagraph(
      'This assessment is based on the following assumptions and scope limitations. These should be considered when reviewing the recommendations and cost estimates.',
      { spacing: { after: 200 } }
    ),

    createParagraph('Data Source', { bold: true }),
    createParagraph(
      'Analysis is based on a point-in-time RVTools export from the VMware vSphere environment. Results reflect the environment state at the time of data collection.'
    ),

    new Paragraph({ spacing: { before: 120 } }),
    createParagraph('Scope Limitations', { bold: true }),
    ...createBulletList([
      'No application dependency mapping - workload dependencies between VMs have not been analyzed',
      'No performance benchmarking - actual CPU, memory, and storage utilization patterns are not assessed',
      'No licensing optimization - existing software licenses and cloud licensing options are not evaluated',
      'No network traffic analysis - bandwidth requirements between workloads are not measured',
      'No security or compliance review - regulatory requirements are not assessed in this report',
    ]),

    new Paragraph({ spacing: { before: 120 } }),
    createParagraph('Cost Estimate Assumptions', { bold: true }),
    ...createBulletList([
      'List pricing without enterprise discounts or committed use agreements',
      'US East region pricing (actual costs may vary by region)',
      'Standard support tier included',
      'Network egress and data transfer costs not included',
      'Operating system licensing for non-Linux workloads may incur additional costs on VSI',
    ]),

    new Paragraph({ spacing: { before: 120 } }),
    createParagraph('Recommendations', { bold: true }),
    createParagraph(
      'For a comprehensive migration plan, consider conducting application discovery, dependency mapping, and performance analysis to refine the sizing recommendations and identify optimal migration waves.'
    ),

    new Paragraph({ spacing: { before: 200 } }),
  ];
}
