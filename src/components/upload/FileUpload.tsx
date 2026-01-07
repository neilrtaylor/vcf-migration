// Main file upload component combining DropZone and progress
import { useState, useCallback } from 'react';
import { Button } from '@carbon/react';
import { TrashCan, Restart } from '@carbon/icons-react';
import { DropZone } from './DropZone';
import { UploadProgress } from './UploadProgress';
import { parseRVToolsFile, validateFile, type ParsingProgress } from '@/services/parser/excelParser';
import type { RVToolsData } from '@/types';
import './FileUpload.scss';

interface FileUploadProps {
  onDataParsed: (data: RVToolsData) => void;
  onError?: (errors: string[]) => void;
}

type UploadState = 'idle' | 'processing' | 'complete' | 'error';

export function FileUpload({ onDataParsed, onError }: FileUploadProps) {
  const [state, setState] = useState<UploadState>('idle');
  const [fileName, setFileName] = useState<string>('');
  const [progress, setProgress] = useState<ParsingProgress | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const handleFileDrop = useCallback(
    async (file: File) => {
      // Validate file first
      const validation = validateFile(file);
      if (!validation.valid) {
        setErrors([validation.error || 'Invalid file']);
        setState('error');
        onError?.([validation.error || 'Invalid file']);
        return;
      }

      setFileName(file.name);
      setState('processing');
      setErrors([]);
      setWarnings([]);

      try {
        const result = await parseRVToolsFile(file, (prog) => {
          setProgress(prog);
        });

        if (result.success && result.data) {
          setState('complete');
          setWarnings(result.warnings);
          onDataParsed(result.data);
        } else {
          setState('error');
          setErrors(result.errors);
          onError?.(result.errors);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState('error');
        setErrors([errorMessage]);
        onError?.([errorMessage]);
      }
    },
    [onDataParsed, onError]
  );

  const handleReset = useCallback(() => {
    setState('idle');
    setFileName('');
    setProgress(null);
    setErrors([]);
    setWarnings([]);
  }, []);

  return (
    <div className="file-upload">
      {state === 'idle' && (
        <DropZone onFileDrop={handleFileDrop} />
      )}

      {(state === 'processing' || state === 'complete') && progress && (
        <div className="file-upload__progress-container">
          <UploadProgress progress={progress} fileName={fileName} />

          {state === 'complete' && (
            <div className="file-upload__actions">
              <Button
                kind="ghost"
                size="sm"
                renderIcon={Restart}
                onClick={handleReset}
              >
                Upload different file
              </Button>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="file-upload__warnings">
              <h4>Warnings</h4>
              <ul>
                {warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {state === 'error' && (
        <div className="file-upload__error-container">
          <div className="file-upload__error">
            <h4>Upload Failed</h4>
            <ul>
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
          <Button
            kind="tertiary"
            size="sm"
            renderIcon={TrashCan}
            onClick={handleReset}
          >
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
