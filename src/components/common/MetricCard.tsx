// Reusable metric card component with colored left border
import { Tile, Tooltip } from '@carbon/react';
import { Information, CheckmarkFilled, WarningFilled, ErrorFilled } from '@carbon/icons-react';
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

// Map variant to screen reader status text
const variantStatusText: Record<MetricCardVariant, string | null> = {
  default: null,
  primary: null,
  success: 'Status: OK',
  warning: 'Status: Warning',
  error: 'Status: Critical',
  info: null,
  purple: null,
  teal: null,
};

// Map variant to status icon
function getStatusIcon(variant: MetricCardVariant) {
  switch (variant) {
    case 'success':
      return <CheckmarkFilled size={16} className="metric-card__status-icon metric-card__status-icon--success" aria-hidden="true" />;
    case 'warning':
      return <WarningFilled size={16} className="metric-card__status-icon metric-card__status-icon--warning" aria-hidden="true" />;
    case 'error':
      return <ErrorFilled size={16} className="metric-card__status-icon metric-card__status-icon--error" aria-hidden="true" />;
    default:
      return null;
  }
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
  const statusText = variantStatusText[variant];
  const statusIcon = getStatusIcon(variant);

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
            <button type="button" className="metric-card__info-button" aria-label={`More information about ${label}`}>
              <Information size={16} aria-hidden="true" />
            </button>
          </Tooltip>
        )}
      </div>
      <div className="metric-card__value-container">
        {statusIcon}
        <span className="metric-card__value">{value}</span>
        {statusText && <span className="visually-hidden">{statusText}</span>}
      </div>
      {detail && <span className="metric-card__detail">{detail}</span>}
    </Tile>
  );
}
