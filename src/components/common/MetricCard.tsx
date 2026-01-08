// Reusable metric card component with colored left border
import { Tile } from '@carbon/react';
import './MetricCard.scss';

export type MetricCardVariant =
  | 'default'
  | 'primary'    // Blue - primary metrics
  | 'success'    // Green - positive/success metrics
  | 'warning'    // Yellow/Orange - warning metrics
  | 'error'      // Red - error/critical metrics
  | 'info'       // Cyan - informational
  | 'purple'     // Purple - storage/special
  | 'teal';      // Teal - memory/secondary

interface MetricCardProps {
  label: string;
  value: string | number;
  detail?: string;
  variant?: MetricCardVariant;
  highlight?: boolean;
  className?: string;
}

export function MetricCard({
  label,
  value,
  detail,
  variant = 'default',
  highlight = false,
  className = '',
}: MetricCardProps) {
  return (
    <Tile
      className={`metric-card metric-card--${variant} ${highlight ? 'metric-card--highlight' : ''} ${className}`}
    >
      <span className="metric-card__label">{label}</span>
      <span className="metric-card__value">{value}</span>
      {detail && <span className="metric-card__detail">{detail}</span>}
    </Tile>
  );
}
