// PDF Export component with options modal
import { useState } from 'react';
import {
  Button,
  Modal,
  Checkbox,
  InlineLoading,
  InlineNotification,
} from '@carbon/react';
import { DocumentPdf } from '@carbon/icons-react';
import { useData, usePDFExport } from '@/hooks';
import './PDFExport.scss';

interface ExportOptions {
  includeExecutiveSummary: boolean;
  includeComputeAnalysis: boolean;
  includeStorageAnalysis: boolean;
  includeMTVReadiness: boolean;
  includeVMList: boolean;
}

const DEFAULT_OPTIONS: ExportOptions = {
  includeExecutiveSummary: true,
  includeComputeAnalysis: true,
  includeStorageAnalysis: true,
  includeMTVReadiness: true,
  includeVMList: false,
};

interface PDFExportProps {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function PDFExport({ variant = 'primary', size = 'md' }: PDFExportProps) {
  const { rawData } = useData();
  const { isExporting, error, exportPDF } = usePDFExport();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [options, setOptions] = useState<ExportOptions>(DEFAULT_OPTIONS);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleOptionChange = (key: keyof ExportOptions) => {
    setOptions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleExport = async () => {
    if (!rawData) return;

    try {
      await exportPDF(rawData, options);
      handleCloseModal();
    } catch {
      // Error is handled by the hook
    }
  };

  if (!rawData) {
    return null;
  }

  return (
    <>
      <Button
        kind={variant}
        size={size}
        renderIcon={DocumentPdf}
        onClick={handleOpenModal}
        disabled={isExporting}
      >
        Export PDF
      </Button>

      <Modal
        open={isModalOpen}
        onRequestClose={handleCloseModal}
        modalHeading="Export PDF Report"
        modalLabel="Report Options"
        primaryButtonText={isExporting ? 'Generating...' : 'Export'}
        secondaryButtonText="Cancel"
        onRequestSubmit={handleExport}
        primaryButtonDisabled={isExporting}
        size="sm"
      >
        <div className="pdf-export-modal">
          <p className="pdf-export-modal__description">
            Select the sections to include in your PDF report.
          </p>

          <div className="pdf-export-modal__options">
            <Checkbox
              id="opt-executive"
              labelText="Executive Summary"
              checked={options.includeExecutiveSummary}
              onChange={() => handleOptionChange('includeExecutiveSummary')}
            />
            <Checkbox
              id="opt-compute"
              labelText="Compute Analysis"
              checked={options.includeComputeAnalysis}
              onChange={() => handleOptionChange('includeComputeAnalysis')}
            />
            <Checkbox
              id="opt-storage"
              labelText="Storage Analysis"
              checked={options.includeStorageAnalysis}
              onChange={() => handleOptionChange('includeStorageAnalysis')}
            />
            <Checkbox
              id="opt-mtv"
              labelText="Migration Readiness (MTV)"
              checked={options.includeMTVReadiness}
              onChange={() => handleOptionChange('includeMTVReadiness')}
            />
            <Checkbox
              id="opt-vmlist"
              labelText="VM Inventory List (first 50)"
              checked={options.includeVMList}
              onChange={() => handleOptionChange('includeVMList')}
            />
          </div>

          {isExporting && (
            <InlineLoading
              status="active"
              description="Generating PDF report..."
            />
          )}

          {error && (
            <InlineNotification
              kind="error"
              title="Export failed"
              subtitle={error}
              lowContrast
              hideCloseButton
            />
          )}
        </div>
      </Modal>
    </>
  );
}
