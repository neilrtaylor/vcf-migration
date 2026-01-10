// D3.js Force-directed network topology diagram
import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { ChartWrapper } from './ChartWrapper';
import './NetworkTopology.scss';

export interface TopologyNode {
  id: string;
  name: string;
  type: 'switch' | 'portgroup' | 'vm' | 'cluster' | 'datacenter';
  group?: string;
  value?: number;
}

export interface TopologyLink {
  source: string;
  target: string;
  value?: number;
}

interface NetworkTopologyProps {
  title?: string;
  subtitle?: string;
  nodes: TopologyNode[];
  links: TopologyLink[];
  height?: number;
  onNodeClick?: (node: TopologyNode) => void;
}

// Node colors by type
const nodeColors: Record<string, string> = {
  datacenter: '#0f62fe',
  cluster: '#8a3ffc',
  switch: '#009d9a',
  portgroup: '#24a148',
  vm: '#78a9ff',
};

// Node sizes by type
const nodeSizes: Record<string, number> = {
  datacenter: 25,
  cluster: 20,
  switch: 15,
  portgroup: 12,
  vm: 6,
};

export function NetworkTopology({
  title,
  subtitle,
  nodes,
  links,
  height = 500,
  onNodeClick,
}: NetworkTopologyProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    const tooltip = d3.select(tooltipRef.current);

    // Clear previous content
    svg.selectAll('*').remove();

    // Calculate dimensions
    const container = svgRef.current.parentElement;
    const width = container?.clientWidth || 800;

    // Set SVG dimensions
    svg
      .attr('width', width)
      .attr('height', height);

    // Create node and link copies for d3 simulation
    const nodesCopy = nodes.map(d => ({ ...d }));
    const linksCopy = links.map(d => ({ ...d }));

    // Create force simulation
    const simulation = d3.forceSimulation(nodesCopy as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(linksCopy)
        .id((d: d3.SimulationNodeDatum) => (d as TopologyNode).id)
        .distance(80))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => nodeSizes[(d as TopologyNode).type] + 5));

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Create container group
    const g = svg.append('g');

    // Draw links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(linksCopy)
      .enter()
      .append('line')
      .attr('stroke', '#a8a8a8')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1);

    // Draw nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(nodesCopy)
      .enter()
      .append('circle')
      .attr('r', d => nodeSizes[d.type] || 8)
      .attr('fill', d => nodeColors[d.type] || '#525252')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .style('cursor', onNodeClick ? 'pointer' : 'default')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .call(drag(simulation) as any)
      .on('mouseover', function (event, d) {
        d3.select(this)
          .attr('stroke', '#161616')
          .attr('stroke-width', 3);

        tooltip
          .style('opacity', 1)
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 10}px`)
          .html(`
            <div class="topology-tooltip__name">${d.name}</div>
            <div class="topology-tooltip__type">${d.type}</div>
            ${d.value !== undefined ? `<div class="topology-tooltip__value">${d.value} VMs</div>` : ''}
          `);
      })
      .on('mousemove', function (event) {
        tooltip
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 10}px`);
      })
      .on('mouseout', function () {
        d3.select(this)
          .attr('stroke', '#fff')
          .attr('stroke-width', 1.5);
        tooltip.style('opacity', 0);
      })
      .on('click', function (_, d) {
        if (onNodeClick) {
          onNodeClick(d);
        }
      });

    // Add labels for all nodes (including VMs)
    // Filter to show labels for: switches, port groups, and VMs with value > 1 (multiple NICs)
    const nodesWithLabels = nodesCopy.filter(n =>
      n.type !== 'vm' || (n.value !== undefined && n.value > 1)
    );

    const labels = g.append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(nodesWithLabels)
      .enter()
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('dy', d => nodeSizes[d.type] + 12)
      .attr('fill', d => d.type === 'vm' ? '#0f62fe' : '#525252')
      .style('font-size', d => d.type === 'vm' ? '9px' : '10px')
      .style('font-weight', d => d.type === 'vm' ? '500' : 'normal')
      .style('pointer-events', 'none')
      .text(d => d.name.length > 20 ? d.name.substring(0, 17) + '...' : d.name);

    // Update positions on each tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => ((d.source as unknown) as { x: number }).x)
        .attr('y1', d => ((d.source as unknown) as { y: number }).y)
        .attr('x2', d => ((d.target as unknown) as { x: number }).x)
        .attr('y2', d => ((d.target as unknown) as { y: number }).y);

      node
        .attr('cx', d => (d as unknown as { x: number }).x)
        .attr('cy', d => (d as unknown as { y: number }).y);

      labels
        .attr('x', d => (d as unknown as { x: number }).x)
        .attr('y', d => (d as unknown as { y: number }).y);
    });

    // Drag behavior
    function drag(sim: d3.Simulation<d3.SimulationNodeDatum, undefined>) {
      function dragstarted(event: d3.D3DragEvent<SVGCircleElement, unknown, unknown>) {
        if (!event.active) sim.alphaTarget(0.3).restart();
        (event.subject as { fx: number | null; fy: number | null }).fx = (event.subject as { x: number }).x;
        (event.subject as { fx: number | null; fy: number | null }).fy = (event.subject as { y: number }).y;
      }

      function dragged(event: d3.D3DragEvent<SVGCircleElement, unknown, unknown>) {
        (event.subject as { fx: number | null }).fx = event.x;
        (event.subject as { fy: number | null }).fy = event.y;
      }

      function dragended(event: d3.D3DragEvent<SVGCircleElement, unknown, unknown>) {
        if (!event.active) sim.alphaTarget(0);
        (event.subject as { fx: number | null }).fx = null;
        (event.subject as { fy: number | null }).fy = null;
      }

      return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
    }

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [nodes, links, height, onNodeClick]);

  if (nodes.length === 0) {
    return (
      <ChartWrapper title={title} subtitle={subtitle} height={height}>
        <div className="topology-empty">No network data available</div>
      </ChartWrapper>
    );
  }

  return (
    <ChartWrapper title={title} subtitle={subtitle} height={height}>
      <div className="topology-container">
        <svg ref={svgRef} />
        <div ref={tooltipRef} className="topology-tooltip" />
        <div className="topology-legend">
          <div className="topology-legend__item">
            <span className="topology-legend__color" style={{ backgroundColor: nodeColors.switch }} />
            <span className="topology-legend__label">vSwitch</span>
          </div>
          <div className="topology-legend__item">
            <span className="topology-legend__color" style={{ backgroundColor: nodeColors.portgroup }} />
            <span className="topology-legend__label">Port Group</span>
          </div>
          <div className="topology-legend__item">
            <span className="topology-legend__color" style={{ backgroundColor: nodeColors.vm }} />
            <span className="topology-legend__label">VM</span>
          </div>
        </div>
      </div>
    </ChartWrapper>
  );
}
