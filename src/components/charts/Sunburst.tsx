// D3.js Sunburst diagram for hierarchical data
import { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import { ChartWrapper } from './ChartWrapper';
import './Sunburst.scss';

export interface HierarchyNode {
  name: string;
  value?: number;
  children?: HierarchyNode[];
}

interface SunburstProps {
  title?: string;
  subtitle?: string;
  data: HierarchyNode;
  height?: number;
  colors?: string[];
  onArcClick?: (path: string[]) => void;
}

// Default color palette
const defaultColors = [
  '#0f62fe', // Blue
  '#8a3ffc', // Purple
  '#009d9a', // Teal
  '#24a148', // Green
  '#ff832b', // Orange
  '#1192e8', // Cyan
  '#ee5396', // Magenta
  '#fa4d56', // Red
  '#f1c21b', // Yellow
];

export function Sunburst({
  title,
  subtitle,
  data,
  height = 400,
  colors = defaultColors,
  onArcClick,
}: SunburstProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Build hierarchy
  const root = useMemo(() => {
    const hierarchy = d3.hierarchy(data)
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));
    return hierarchy;
  }, [data]);

  useEffect(() => {
    if (!svgRef.current || !root || root.value === 0) return;

    const svg = d3.select(svgRef.current);
    const tooltip = d3.select(tooltipRef.current);

    // Clear previous content
    svg.selectAll('*').remove();

    // Calculate dimensions
    const container = svgRef.current.parentElement;
    const containerWidth = container?.clientWidth || 400;
    const width = Math.min(containerWidth, height);
    const radius = width / 2;

    // Set SVG dimensions
    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `${-radius} ${-radius} ${width} ${height}`);

    // Create partition layout
    const partition = d3.partition<HierarchyNode>()
      .size([2 * Math.PI, radius]);

    const arcData = partition(root);

    // Create arc generator
    const arc = d3.arc<d3.HierarchyRectangularNode<HierarchyNode>>()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius / 2)
      .innerRadius(d => d.y0)
      .outerRadius(d => d.y1 - 1);

    // Color scale based on top-level parent
    const colorScale = (d: d3.HierarchyRectangularNode<HierarchyNode>) => {
      // Find the ancestor at depth 1 (first level children of root)
      let current = d;
      while (current.depth > 1 && current.parent) {
        current = current.parent;
      }
      // Get index of this ancestor among its siblings
      const siblings = current.parent?.children || [current];
      const index = siblings.indexOf(current);
      const baseColor = colors[index % colors.length];

      // Darken based on depth
      return d3.color(baseColor)?.darker(d.depth * 0.3)?.toString() || baseColor;
    };

    // Get path from root to node
    const getPath = (d: d3.HierarchyRectangularNode<HierarchyNode>): string[] => {
      const path: string[] = [];
      let current: d3.HierarchyRectangularNode<HierarchyNode> | null = d;
      while (current) {
        if (current.data.name) {
          path.unshift(current.data.name);
        }
        current = current.parent;
      }
      return path;
    };

    // Draw arcs
    const g = svg.append('g');

    g.selectAll('path')
      .data(arcData.descendants().filter(d => d.depth > 0))
      .enter()
      .append('path')
      .attr('d', arc)
      .attr('fill', d => colorScale(d))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .style('cursor', onArcClick ? 'pointer' : 'default')
      .on('mouseover', function (event, d) {
        d3.select(this)
          .attr('stroke', '#161616')
          .attr('stroke-width', 2);

        const path = getPath(d);
        const percentage = root.value ? ((d.value || 0) / root.value * 100).toFixed(1) : '0';

        tooltip
          .style('opacity', 1)
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 10}px`)
          .html(`
            <div class="sunburst-tooltip__path">${path.join(' > ')}</div>
            <div class="sunburst-tooltip__value">${d.value || 0} (${percentage}%)</div>
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
          .attr('stroke-width', 1);
        tooltip.style('opacity', 0);
      })
      .on('click', function (_, d) {
        if (onArcClick) {
          onArcClick(getPath(d));
        }
      });

    // Add center text
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#525252')
      .style('font-size', '14px')
      .style('font-weight', '600')
      .text(root.value?.toString() || '0');

    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('y', 18)
      .attr('fill', '#a8a8a8')
      .style('font-size', '11px')
      .text('Total');

  }, [root, height, colors, onArcClick]);

  // Show message if no data
  if (root.value === 0) {
    return (
      <ChartWrapper title={title} subtitle={subtitle} height={height}>
        <div className="sunburst-empty">No data available</div>
      </ChartWrapper>
    );
  }

  return (
    <ChartWrapper title={title} subtitle={subtitle} height={height}>
      <div className="sunburst-container">
        <svg ref={svgRef} />
        <div ref={tooltipRef} className="sunburst-tooltip" />
      </div>
    </ChartWrapper>
  );
}
