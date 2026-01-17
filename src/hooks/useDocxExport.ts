// Hook for DOCX report export functionality
import { useState, useCallback } from 'react';
import { downloadDocx, type DocxExportOptions } from '@/services/export/docxGenerator';
import type { RVToolsData } from '@/types/rvtools';

export interface UseDocxExportReturn {
  isExporting: boolean;
  error: string | null;
  exportDocx: (data: RVToolsData, options?: DocxExportOptions, filename?: string) => Promise<void>;
}

export function useDocxExport(): UseDocxExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportDocx = useCallback(
    async (data: RVToolsData, options?: DocxExportOptions, filename?: string) => {
      setIsExporting(true);
      setError(null);

      try {
        await downloadDocx(data, options, filename);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate DOCX report';
        setError(message);
        throw err;
      } finally {
        setIsExporting(false);
      }
    },
    []
  );

  return {
    isExporting,
    error,
    exportDocx,
  };
}
