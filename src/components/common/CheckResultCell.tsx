// Check result cell component for pre-flight report table
import { Tooltip } from '@carbon/react';
import { Checkmark, Close, WarningAlt, Subtract } from '@carbon/icons-react';
import type { CheckResult, CheckDefinition } from '@/services/preflightChecks';
import './CheckResultCell.scss';

interface CheckResultCellProps {
  result: CheckResult;
  checkDef: CheckDefinition;
}

export function CheckResultCell({ result, checkDef }: CheckResultCellProps) {
  const getIcon = () => {
    switch (result.status) {
      case 'pass':
        return <Checkmark size={16} />;
      case 'fail':
        return <Close size={16} />;
      case 'warn':
        return <WarningAlt size={16} />;
      case 'na':
        return <Subtract size={16} />;
    }
  };

  const getSeverityLabel = () => {
    switch (checkDef.severity) {
      case 'blocker':
        return 'Blocker';
      case 'warning':
        return 'Warning';
      case 'info':
        return 'Info';
    }
  };

  const tooltipContent = (
    <div className="check-result-tooltip">
      <strong>{checkDef.name}</strong>
      <p className="check-result-tooltip__description">{checkDef.description}</p>
      <div className="check-result-tooltip__details">
        <span className="check-result-tooltip__severity">
          Severity: {getSeverityLabel()}
        </span>
        {result.value !== undefined && (
          <span className="check-result-tooltip__value">
            Value: {result.value}
          </span>
        )}
        {result.threshold !== undefined && (
          <span className="check-result-tooltip__threshold">
            Limit: {result.threshold}
          </span>
        )}
      </div>
      {result.message && (
        <p className="check-result-tooltip__message">{result.message}</p>
      )}
    </div>
  );

  return (
    <Tooltip
      align="bottom"
      label={tooltipContent}
      className="check-result-cell__tooltip"
    >
      <span className={`check-result-cell check-result-cell--${result.status}`}>
        {getIcon()}
      </span>
    </Tooltip>
  );
}
