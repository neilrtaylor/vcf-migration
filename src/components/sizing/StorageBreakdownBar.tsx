// Storage breakdown horizontal bar visualization
import { useMemo } from 'react';
import './StorageBreakdownBar.scss';

export interface StorageSegment {
  label: string;
  value: number; // in GiB
  color: string;
  description?: string;
}

interface StorageBreakdownBarProps {
  segments: StorageSegment[];
  title?: string;
  formatValue?: (value: number) => string;
  showLegend?: boolean;
  height?: number;
}

const defaultFormatValue = (value: number): string => {
  if (value >= 1024) {
    return `${(value / 1024).toFixed(2)} TiB`;
  }
  return `${value.toFixed(1)} GiB`;
};

export function StorageBreakdownBar({
  segments,
  title,
  formatValue = defaultFormatValue,
  showLegend = true,
  height = 32,
}: StorageBreakdownBarProps) {
  const total = useMemo(() => {
    return segments.reduce((sum, seg) => sum + seg.value, 0);
  }, [segments]);

  // Filter out zero-value segments for display
  const visibleSegments = useMemo(() => {
    return segments.filter(seg => seg.value > 0);
  }, [segments]);

  if (total === 0) {
    return null;
  }

  return (
    <div className="storage-breakdown-bar">
      {title && <div className="storage-breakdown-bar__title">{title}</div>}

      <div className="storage-breakdown-bar__container">
        <div
          className="storage-breakdown-bar__bar"
          style={{ height: `${height}px` }}
        >
          {visibleSegments.map((segment) => {
            const percentage = (segment.value / total) * 100;
            return (
              <div
                key={segment.label}
                className="storage-breakdown-bar__segment"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: segment.color,
                }}
                title={`${segment.label}: ${formatValue(segment.value)} (${percentage.toFixed(1)}%)`}
              >
                {percentage > 10 && (
                  <span className="storage-breakdown-bar__segment-label">
                    {segment.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="storage-breakdown-bar__total">
          Total: {formatValue(total)}
        </div>
      </div>

      {showLegend && (
        <div className="storage-breakdown-bar__legend">
          {visibleSegments.map((segment) => {
            const percentage = (segment.value / total) * 100;
            return (
              <div key={segment.label} className="storage-breakdown-bar__legend-item">
                <span
                  className="storage-breakdown-bar__legend-color"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="storage-breakdown-bar__legend-label">
                  {segment.label}
                </span>
                <span className="storage-breakdown-bar__legend-value">
                  {formatValue(segment.value)}
                </span>
                <span className="storage-breakdown-bar__legend-percent">
                  ({percentage.toFixed(1)}%)
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Specific colors for storage breakdown segments
export const STORAGE_SEGMENT_COLORS = {
  vmData: '#0f62fe',      // Blue - base VM data
  growth: '#009d9a',      // Teal - growth projection
  overhead: '#8a3ffc',    // Purple - virtualization overhead
  replica: '#da1e28',     // Red - replica factor
  headroom: '#ff832b',    // Orange - operational headroom
} as const;
