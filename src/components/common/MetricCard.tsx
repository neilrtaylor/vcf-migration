// Reusable metric card component with colored left border
import { Tile, Tooltip } from '@carbon/react';
import { Information } from '@carbon/icons-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/utils/constants';
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
  tooltip?: string;
  docSection?: string; // Optional anchor for documentation page
}

export function MetricCard({
  label,
  value,
  detail,
  variant = 'default',
  highlight = false,
  className = '',
  tooltip,
  docSection,
}: MetricCardProps) {
  const hasTooltip = tooltip || docSection;

  return (
    <Tile
      className={`metric-card metric-card--${variant} ${highlight ? 'metric-card--highlight' : ''} ${className}`}
    >
      <div className="metric-card__header">
        <span className="metric-card__label">{label}</span>
        {hasTooltip && (
          <Tooltip
            label={
              <span>
                {tooltip || `Learn more about ${label}`}
                {docSection && (
                  <>
                    <br />
                    <Link to={`${ROUTES.documentation}#${docSection}`} className="metric-card__doc-link">
                      View documentation
                    </Link>
                  </>
                )}
              </span>
            }
            align="top"
          >
            <button type="button" className="metric-card__info-button">
              <Information size={16} />
            </button>
          </Tooltip>
        )}
      </div>
      <span className="metric-card__value">{value}</span>
      {detail && <span className="metric-card__detail">{detail}</span>}
    </Tile>
  );
}
