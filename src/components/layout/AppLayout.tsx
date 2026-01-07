// Main application layout
import { useState, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  Content,
  Modal,
  Checkbox,
  InlineLoading,
  InlineNotification,
} from '@carbon/react';
import { TopNav } from './TopNav';
import { SideNav } from './SideNav';
import { ROUTES } from '@/utils/constants';
import { useData, usePDFExport, useExcelExport } from '@/hooks';
import './AppLayout.scss';

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

export function AppLayout() {
  const navigate = useNavigate();
  const { rawData } = useData();
  const { isExporting, error, exportPDF } = usePDFExport();
  const { exportExcel } = useExcelExport();
  const [isSideNavExpanded] = useState(true);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>(DEFAULT_OPTIONS);

  const handleUploadClick = useCallback(() => {
    navigate(ROUTES.home);
  }, [navigate]);

  const handleExportPDFClick = useCallback(() => {
    setIsExportModalOpen(true);
  }, []);

  const handleExportExcelClick = useCallback(() => {
    if (rawData) {
      exportExcel(rawData);
    }
  }, [rawData, exportExcel]);

  const handleCloseExportModal = useCallback(() => {
    setIsExportModalOpen(false);
  }, []);

  const handleOptionChange = useCallback((key: keyof ExportOptions) => {
    setExportOptions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const handleExport = useCallback(async () => {
    if (!rawData) return;

    try {
      await exportPDF(rawData, exportOptions);
      setIsExportModalOpen(false);
    } catch {
      // Error is handled by the hook
    }
  }, [rawData, exportOptions, exportPDF]);

  return (
    <div className="app-layout">
      <TopNav
        onUploadClick={handleUploadClick}
        onExportPDFClick={handleExportPDFClick}
        onExportExcelClick={handleExportExcelClick}
      />
      <SideNav isExpanded={isSideNavExpanded} />
      <Content className="app-layout__content">
        <Outlet />
      </Content>

      {/* PDF Export Modal */}
      <Modal
        open={isExportModalOpen}
        onRequestClose={handleCloseExportModal}
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
              checked={exportOptions.includeExecutiveSummary}
              onChange={() => handleOptionChange('includeExecutiveSummary')}
            />
            <Checkbox
              id="opt-compute"
              labelText="Compute Analysis"
              checked={exportOptions.includeComputeAnalysis}
              onChange={() => handleOptionChange('includeComputeAnalysis')}
            />
            <Checkbox
              id="opt-storage"
              labelText="Storage Analysis"
              checked={exportOptions.includeStorageAnalysis}
              onChange={() => handleOptionChange('includeStorageAnalysis')}
            />
            <Checkbox
              id="opt-mtv"
              labelText="Migration Readiness (MTV)"
              checked={exportOptions.includeMTVReadiness}
              onChange={() => handleOptionChange('includeMTVReadiness')}
            />
            <Checkbox
              id="opt-vmlist"
              labelText="VM Inventory List (first 50)"
              checked={exportOptions.includeVMList}
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
    </div>
  );
}
