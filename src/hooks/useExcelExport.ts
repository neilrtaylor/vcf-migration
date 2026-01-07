// Hook for Excel export functionality
import { useState, useCallback } from 'react';
import { downloadExcel } from '@/services/export';
import type { RVToolsData } from '@/types/rvtools';

interface UseExcelExportReturn {
  isExporting: boolean;
  error: string | null;
  exportExcel: (data: RVToolsData, filename?: string) => void;
}

export function useExcelExport(): UseExcelExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportExcel = useCallback((data: RVToolsData, filename?: string) => {
    setIsExporting(true);
    setError(null);

    try {
      // Generate timestamp for filename
      const date = new Date().toISOString().split('T')[0];
      const finalFilename = filename || `rvtools-analysis_${date}.xlsx`;

      // Download Excel file
      downloadExcel(data, finalFilename);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate Excel file';
      setError(message);
    } finally {
      setIsExporting(false);
    }
  }, []);

  return {
    isExporting,
    error,
    exportExcel,
  };
}
