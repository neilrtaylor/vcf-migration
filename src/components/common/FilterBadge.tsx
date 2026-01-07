// Filter badge component for showing active chart drill-down filters
import { Tag } from '@carbon/react';
import { Close } from '@carbon/icons-react';
import './FilterBadge.scss';

interface FilterBadgeProps {
  dimension: string;
  value: string;
  onClear: () => void;
}

export function FilterBadge({ dimension, value, onClear }: FilterBadgeProps) {
  // Format the dimension name for display
  const formatDimension = (dim: string): string => {
    const labels: Record<string, string> = {
      powerState: 'Power State',
      cluster: 'Cluster',
      guestOS: 'Guest OS',
      datacenter: 'Datacenter',
      host: 'Host',
      type: 'Type',
      adapterType: 'Adapter Type',
      toolsStatus: 'Tools Status',
    };
    return labels[dim] || dim;
  };

  return (
    <div className="filter-badge">
      <span className="filter-badge__label">Filtered by:</span>
      <Tag
        type="blue"
        size="md"
        className="filter-badge__tag"
      >
        <span className="filter-badge__content">
          <strong>{formatDimension(dimension)}:</strong> {value}
        </span>
        <button
          type="button"
          className="filter-badge__clear"
          onClick={onClear}
          aria-label="Clear filter"
        >
          <Close size={16} />
        </button>
      </Tag>
    </div>
  );
}
