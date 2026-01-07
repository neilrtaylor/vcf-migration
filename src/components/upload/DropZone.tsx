// Drag and drop zone for file uploads
import { useCallback, useState, useRef } from 'react';
import { Upload } from '@carbon/icons-react';
import './DropZone.scss';

interface DropZoneProps {
  onFileDrop: (file: File) => void;
  accept?: string[];
  disabled?: boolean;
  maxSizeMB?: number;
}

export function DropZone({
  onFileDrop,
  accept = ['.xlsx', '.xls'],
  disabled = false,
  maxSizeMB = 50,
}: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback(
    (file: File): string | null => {
      // Check file extension
      const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!accept.includes(extension)) {
        return `Invalid file type. Expected ${accept.join(' or ')}, got ${extension}`;
      }

      // Check file size
      const maxBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxBytes) {
        return `File too large. Maximum size is ${maxSizeMB}MB, got ${(file.size / 1024 / 1024).toFixed(1)}MB`;
      }

      return null;
    },
    [accept, maxSizeMB]
  );

  const handleFile = useCallback(
    (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);
      onFileDrop(file);
    },
    [validateFile, onFileDrop]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [disabled, handleFile]
  );

  const handleClick = useCallback(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  }, [disabled]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
      // Reset input so the same file can be selected again
      e.target.value = '';
    },
    [handleFile]
  );

  return (
    <div
      className={`drop-zone ${isDragOver ? 'drop-zone--active' : ''} ${disabled ? 'drop-zone--disabled' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Upload RVTools Excel file"
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept.join(',')}
        onChange={handleInputChange}
        className="drop-zone__input"
        disabled={disabled}
      />

      <div className="drop-zone__content">
        <Upload size={48} className="drop-zone__icon" />
        <h3 className="drop-zone__title">
          {isDragOver ? 'Drop file here' : 'Drag and drop your RVTools file'}
        </h3>
        <p className="drop-zone__subtitle">
          or click to browse
        </p>
        <p className="drop-zone__hint">
          Accepts {accept.join(', ')} files up to {maxSizeMB}MB
        </p>
      </div>

      {error && (
        <div className="drop-zone__error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
