// Hook for PDF export functionality
import { useState, useCallback } from 'react';
import { generatePDF, downloadPDF } from '@/services/export';
import type { RVToolsData } from '@/types/rvtools';

export interface PDFExportOptions {
  includeExecutiveSummary?: boolean;
  includeComputeAnalysis?: boolean;
  includeStorageAnalysis?: boolean;
  includeMTVReadiness?: boolean;
  includeVMList?: boolean;
}

export interface UsePDFExportReturn {
  isExporting: boolean;
  progress: number;
  error: string | null;
  exportPDF: (data: RVToolsData, options?: PDFExportOptions) => Promise<void>;
}

export function usePDFExport(): UsePDFExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const exportPDF = useCallback(async (data: RVToolsData, options?: PDFExportOptions) => {
    setIsExporting(true);
    setProgress(0);
    setError(null);

    try {
      setProgress(10);

      // Generate PDF
      const blob = await generatePDF(data, options);
      setProgress(80);

      // Create filename
      const date = new Date().toISOString().split('T')[0];
      const baseName = data.metadata.fileName.replace(/\.[^/.]+$/, '');
      const filename = `${baseName}_analysis_${date}.pdf`;

      // Download
      downloadPDF(blob, filename);
      setProgress(100);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate PDF';
      setError(message);
      throw err;
    } finally {
      setIsExporting(false);
    }
  }, []);

  return {
    isExporting,
    progress,
    error,
    exportPDF,
  };
}
