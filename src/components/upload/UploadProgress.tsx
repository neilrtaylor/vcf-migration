// Upload progress indicator
import { ProgressBar, InlineLoading } from '@carbon/react';
import { CheckmarkFilled, ErrorFilled } from '@carbon/icons-react';
import type { ParsingProgress } from '@/services/parser/excelParser';
import './UploadProgress.scss';

interface UploadProgressProps {
  progress: ParsingProgress;
  fileName: string;
}

export function UploadProgress({ progress, fileName }: UploadProgressProps) {
  const getProgressPercent = (): number => {
    switch (progress.phase) {
      case 'reading':
        return 10;
      case 'parsing':
        if (progress.totalSheets === 0) return 20;
        return 20 + (progress.sheetsProcessed / progress.totalSheets) * 60;
      case 'validating':
        return 90;
      case 'complete':
        return 100;
      case 'error':
        return 0;
      default:
        return 0;
    }
  };

  const getStatusText = (): string => {
    switch (progress.phase) {
      case 'reading':
        return 'Reading file...';
      case 'parsing':
        return progress.currentSheet
          ? `Parsing ${progress.currentSheet} (${progress.sheetsProcessed}/${progress.totalSheets})`
          : 'Parsing sheets...';
      case 'validating':
        return 'Validating data...';
      case 'complete':
        return progress.message;
      case 'error':
        return progress.message;
      default:
        return 'Processing...';
    }
  };

  const isComplete = progress.phase === 'complete';
  const isError = progress.phase === 'error';
  const isProcessing = !isComplete && !isError;

  return (
    <div className="upload-progress">
      <div className="upload-progress__header">
        <span className="upload-progress__filename">{fileName}</span>
        {isComplete && (
          <CheckmarkFilled size={20} className="upload-progress__icon upload-progress__icon--success" />
        )}
        {isError && (
          <ErrorFilled size={20} className="upload-progress__icon upload-progress__icon--error" />
        )}
      </div>

      <div className="upload-progress__bar">
        <ProgressBar
          value={getProgressPercent()}
          max={100}
          status={isError ? 'error' : isComplete ? 'finished' : 'active'}
          label="Upload progress"
          hideLabel
        />
      </div>

      <div className="upload-progress__status">
        {isProcessing && (
          <InlineLoading
            status="active"
            description={getStatusText()}
          />
        )}
        {isComplete && (
          <span className="upload-progress__message upload-progress__message--success">
            {getStatusText()}
          </span>
        )}
        {isError && (
          <span className="upload-progress__message upload-progress__message--error">
            {getStatusText()}
          </span>
        )}
      </div>
    </div>
  );
}
