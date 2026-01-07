// D3.js Heatmap component
import { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import { ChartWrapper } from './ChartWrapper';
import './Heatmap.scss';

export interface HeatmapCell {
  row: string;
  col: string;
  value: number;
  label?: string;
}

export type ColorScale = 'utilization' | 'overcommit' | 'severity';

interface HeatmapProps {
  title?: string;
  subtitle?: string;
  data: HeatmapCell[];
  height?: number;
  colorScale?: ColorScale;
  valueFormat?: (value: number) => string;
  onCellClick?: (row: string, col: string, value: number) => void;
}

// Color scales for different metrics
const colorScales: Record<ColorScale, (value: number) => string> = {
  utilization: (value: number) => {
    // Green (0%) -> Yellow (50%) -> Red (100%)
    if (value <= 50) {
      return d3.interpolateRgb('#24a148', '#f1c21b')(value / 50);
    }
    return d3.interpolateRgb('#f1c21b', '#da1e28')(Math.min((value - 50) / 50, 1));
  },
  overcommit: (value: number) => {
    // Green (<1.5x) -> Yellow (1.5-2.5x) -> Red (>2.5x)
    if (value <= 1.5) {
      return '#24a148'; // Green
    }
    if (value <= 2.5) {
      return d3.interpolateRgb('#24a148', '#f1c21b')((value - 1.5) / 1);
    }
    return d3.interpolateRgb('#f1c21b', '#da1e28')(Math.min((value - 2.5) / 1.5, 1));
  },
  severity: (value: number) => {
    // Blue (low) -> Yellow (medium) -> Red (high)
    if (value <= 33) {
      return d3.interpolateRgb('#0f62fe', '#f1c21b')(value / 33);
    }
    return d3.interpolateRgb('#f1c21b', '#da1e28')(Math.min((value - 33) / 67, 1));
  },
};

export function Heatmap({
  title,
  subtitle,
  data,
  height = 300,
  colorScale = 'utilization',
  valueFormat = (v) => v.toFixed(1),
  onCellClick,
}: HeatmapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Extract unique rows and columns
  const { rows, cols } = useMemo(() => {
    const rowSet = new Set<string>();
    const colSet = new Set<string>();
    data.forEach((d) => {
      rowSet.add(d.row);
      colSet.add(d.col);
    });
    return {
      rows: Array.from(rowSet),
      cols: Array.from(colSet),
    };
  }, [data]);

  // Create a map for quick lookup
  const dataMap = useMemo(() => {
    const map = new Map<string, HeatmapCell>();
    data.forEach((d) => {
      map.set(`${d.row}-${d.col}`, d);
    });
    return map;
  }, [data]);

  useEffect(() => {
    if (!svgRef.current || rows.length === 0 || cols.length === 0) return;

    const svg = d3.select(svgRef.current);
    const tooltip = d3.select(tooltipRef.current);

    // Clear previous content
    svg.selectAll('*').remove();

    // Calculate dimensions
    const container = svgRef.current.parentElement;
    const containerWidth = container?.clientWidth || 400;

    // Calculate label widths
    const rowLabelWidth = Math.min(
      150,
      Math.max(...rows.map((r) => r.length)) * 7 + 10
    );
    const margin = { top: 40, right: 20, bottom: 30, left: rowLabelWidth };
    const width = containerWidth - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Cell dimensions
    const cellWidth = Math.max(40, width / cols.length);
    const cellHeight = Math.max(25, Math.min(40, chartHeight / rows.length));

    // Update SVG dimensions
    const svgWidth = margin.left + cellWidth * cols.length + margin.right;
    const svgHeight = margin.top + cellHeight * rows.length + margin.bottom;

    svg
      .attr('width', svgWidth)
      .attr('height', svgHeight);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Color function
    const getColor = colorScales[colorScale];

    // Draw cells
    g.selectAll('.heatmap-cell')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'heatmap-cell')
      .attr('x', (d) => cols.indexOf(d.col) * cellWidth)
      .attr('y', (d) => rows.indexOf(d.row) * cellHeight)
      .attr('width', cellWidth - 2)
      .attr('height', cellHeight - 2)
      .attr('rx', 2)
      .attr('fill', (d) => getColor(d.value))
      .style('cursor', onCellClick ? 'pointer' : 'default')
      .on('mouseover', function (event, d) {
        d3.select(this).attr('stroke', '#161616').attr('stroke-width', 2);

        tooltip
          .style('opacity', 1)
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 10}px`)
          .html(`
            <div class="heatmap-tooltip__title">${d.row}</div>
            <div class="heatmap-tooltip__subtitle">${d.col}</div>
            <div class="heatmap-tooltip__value">${d.label || valueFormat(d.value)}</div>
          `);
      })
      .on('mousemove', function (event) {
        tooltip
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 10}px`);
      })
      .on('mouseout', function () {
        d3.select(this).attr('stroke', 'none');
        tooltip.style('opacity', 0);
      })
      .on('click', function (_, d) {
        if (onCellClick) {
          onCellClick(d.row, d.col, d.value);
        }
      });

    // Draw cell values
    g.selectAll('.heatmap-value')
      .data(data)
      .enter()
      .append('text')
      .attr('class', 'heatmap-value')
      .attr('x', (d) => cols.indexOf(d.col) * cellWidth + (cellWidth - 2) / 2)
      .attr('y', (d) => rows.indexOf(d.row) * cellHeight + (cellHeight - 2) / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', (d) => {
        // Use white text for dark backgrounds
        const color = getColor(d.value);
        const rgb = d3.rgb(color);
        const luminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
        return luminance < 150 ? '#fff' : '#161616';
      })
      .style('font-size', '11px')
      .style('font-weight', '500')
      .style('pointer-events', 'none')
      .text((d) => d.label || valueFormat(d.value));

    // Draw row labels
    g.selectAll('.heatmap-row-label')
      .data(rows)
      .enter()
      .append('text')
      .attr('class', 'heatmap-row-label')
      .attr('x', -8)
      .attr('y', (_, i) => i * cellHeight + cellHeight / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#525252')
      .style('font-size', '12px')
      .text((d) => d.length > 20 ? d.substring(0, 18) + '...' : d);

    // Draw column labels
    g.selectAll('.heatmap-col-label')
      .data(cols)
      .enter()
      .append('text')
      .attr('class', 'heatmap-col-label')
      .attr('x', (_, i) => i * cellWidth + (cellWidth - 2) / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#525252')
      .style('font-size', '12px')
      .text((d) => d);

  }, [data, rows, cols, dataMap, height, colorScale, valueFormat, onCellClick]);

  return (
    <ChartWrapper title={title} subtitle={subtitle} height={height}>
      <div className="heatmap-container">
        <svg ref={svgRef} />
        <div ref={tooltipRef} className="heatmap-tooltip" />
      </div>
    </ChartWrapper>
  );
}
