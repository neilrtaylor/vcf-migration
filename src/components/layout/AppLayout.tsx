// Main application layout
import { useState, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  Content,
  Modal,
  Checkbox,
  Button,
  InlineLoading,
  InlineNotification,
} from '@carbon/react';
import { TopNav } from './TopNav';
import { SideNav } from './SideNav';
import { ChatWidget } from '@/components/ai/ChatWidget';
import { ROUTES } from '@/utils/constants';
import { useData, usePDFExport, useExcelExport, useDocxExport, useAISettings } from '@/hooks';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { fetchAIInsights } from '@/services/ai/aiInsightsApi';
import { buildInsightsInput } from '@/services/ai/insightsInputBuilder';
import { createLogger } from '@/utils/logger';
import type { PDFExportOptions } from '@/hooks/usePDFExport';
import type { RVToolsData } from '@/types/rvtools';
import type { MigrationInsights } from '@/services/ai/types';
import './AppLayout.scss';

const logger = createLogger('AppLayout');

const AI_INSIGHTS_TIMEOUT_MS = 45000;

/**
 * Fetch AI insights with timeout and logging.
 * Returns { insights, warning } — warning is set if insights could not be fetched.
 */
async function fetchInsightsForExport(
  rawData: RVToolsData,
  exportType: string,
): Promise<{ insights: MigrationInsights | null; warning: string | null }> {
  logger.info(`[${exportType}] Fetching AI insights for export`);
  try {
    const insightsInput = buildInsightsInput(rawData);
    logger.debug(`[${exportType}] InsightsInput built`, {
      totalVMs: insightsInput.totalVMs,
      totalVCPUs: insightsInput.totalVCPUs,
      totalMemoryGiB: insightsInput.totalMemoryGiB,
    });

    const result = await Promise.race([
      fetchAIInsights(insightsInput),
      new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), AI_INSIGHTS_TIMEOUT_MS)
      ),
    ]);

    if (result === 'timeout') {
      logger.warn(`[${exportType}] AI insights timed out after ${AI_INSIGHTS_TIMEOUT_MS / 1000}s`);
      return { insights: null, warning: `AI insights timed out after ${AI_INSIGHTS_TIMEOUT_MS / 1000}s — report generated without AI sections.` };
    }

    if (!result) {
      logger.warn(`[${exportType}] AI insights returned null (proxy may have returned empty/invalid data)`);
      return { insights: null, warning: 'AI insights returned empty data — report generated without AI sections.' };
    }

    logger.info(`[${exportType}] AI insights fetched successfully`, {
      hasExecutiveSummary: !!result.executiveSummary,
      hasRiskAssessment: !!result.riskAssessment,
      recommendationsCount: result.recommendations.length,
      costOptimizationsCount: result.costOptimizations.length,
      hasMigrationStrategy: !!result.migrationStrategy,
    });
    return { insights: result, warning: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[${exportType}] AI insights fetch failed`, error instanceof Error ? error : new Error(message));
    return { insights: null, warning: `AI insights failed: ${message} — report generated without AI sections.` };
  }
}

const DEFAULT_OPTIONS: PDFExportOptions = {
  includeDashboard: true,
  includeCompute: true,
  includeStorage: true,
  includeNetwork: true,
  includeClusters: true,
  includeHosts: true,
  includeResourcePools: true,
};

export function AppLayout() {
  const navigate = useNavigate();
  const { rawData } = useData();
  const { isExporting, error, exportPDF } = usePDFExport();
  const { exportExcel } = useExcelExport();
  const { exportDocx } = useDocxExport();
  const { settings: aiSettings } = useAISettings();
  const [isSideNavExpanded] = useState(true);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState<PDFExportOptions>(DEFAULT_OPTIONS);
  const [, setIsDocxExporting] = useState(false);
  const [aiWarning, setAIWarning] = useState<string | null>(null);

  const handleUploadClick = useCallback(() => {
    navigate(ROUTES.home);
  }, [navigate]);

  const handleExportPDFClick = useCallback(() => {
    setIsExportModalOpen(true);
  }, []);

  const handleExportExcelClick = useCallback(async () => {
    if (!rawData) return;
    setAIWarning(null);

    let aiInsights = null;
    if (aiSettings.enabled && isAIProxyConfigured()) {
      const { insights, warning } = await fetchInsightsForExport(rawData, 'Excel');
      aiInsights = insights;
      if (warning) setAIWarning(warning);
    }

    exportExcel(rawData, undefined, aiInsights);
  }, [rawData, exportExcel, aiSettings.enabled]);

  const handleExportDocxClick = useCallback(async () => {
    if (!rawData) return;
    setAIWarning(null);

    setIsDocxExporting(true);
    try {
      let aiInsights = null;
      if (aiSettings.enabled && isAIProxyConfigured()) {
        const { insights, warning } = await fetchInsightsForExport(rawData, 'DOCX');
        aiInsights = insights;
        if (warning) setAIWarning(warning);
      }

      await exportDocx(rawData, { aiInsights });
    } catch {
      // Error is handled by the hook
    } finally {
      setIsDocxExporting(false);
    }
  }, [rawData, exportDocx, aiSettings.enabled]);

  const handleCloseExportModal = useCallback(() => {
    setIsExportModalOpen(false);
  }, []);

  const handleOptionChange = useCallback((key: keyof PDFExportOptions) => {
    setExportOptions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const handleSelectAll = useCallback(() => {
    setExportOptions({
      includeDashboard: true,
      includeCompute: true,
      includeStorage: true,
      includeNetwork: true,
      includeClusters: true,
      includeHosts: true,
      includeResourcePools: true,
    });
  }, []);

  const handleSelectNone = useCallback(() => {
    setExportOptions({
      includeDashboard: false,
      includeCompute: false,
      includeStorage: false,
      includeNetwork: false,
      includeClusters: false,
      includeHosts: false,
      includeResourcePools: false,
    });
  }, []);

  const hasAnySelected = Object.values(exportOptions).some(v => v);

  const handleExport = useCallback(async () => {
    if (!rawData) return;
    setAIWarning(null);

    try {
      let aiInsights = null;
      if (aiSettings.enabled && isAIProxyConfigured()) {
        const { insights, warning } = await fetchInsightsForExport(rawData, 'PDF');
        aiInsights = insights;
        if (warning) setAIWarning(warning);
      }

      await exportPDF(rawData, { ...exportOptions, aiInsights });
      setIsExportModalOpen(false);
    } catch {
      // Error is handled by the hook
    }
  }, [rawData, exportOptions, exportPDF, aiSettings.enabled]);

  return (
    <div className="app-layout">
      <TopNav
        onUploadClick={handleUploadClick}
        onExportPDFClick={handleExportPDFClick}
        onExportExcelClick={handleExportExcelClick}
        onExportDocxClick={handleExportDocxClick}
      />
      <SideNav isExpanded={isSideNavExpanded} />
      <Content className="app-layout__content">
        <Outlet />
      </Content>

      {/* AI insights warning notification */}
      {aiWarning && (
        <InlineNotification
          kind="warning"
          title="AI Insights"
          subtitle={aiWarning}
          lowContrast
          onCloseButtonClick={() => setAIWarning(null)}
          className="app-layout__ai-warning"
        />
      )}

      {/* AI Chat Widget */}
      <ChatWidget />

      {/* PDF Export Modal */}
      <Modal
        open={isExportModalOpen}
        onRequestClose={handleCloseExportModal}
        modalHeading="Export PDF Report"
        modalLabel="Report Options"
        primaryButtonText={isExporting ? 'Generating...' : 'Export'}
        secondaryButtonText="Cancel"
        onRequestSubmit={handleExport}
        primaryButtonDisabled={isExporting || !hasAnySelected}
        size="sm"
        selectorPrimaryFocus="#opt-dashboard"
        aria-describedby="export-modal-description"
      >
        <div className="pdf-export-modal">
          <p id="export-modal-description" className="pdf-export-modal__description">
            Select the sections to include in your PDF report.
          </p>

          <div className="pdf-export-modal__actions">
            <Button kind="ghost" size="sm" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button kind="ghost" size="sm" onClick={handleSelectNone}>
              Select None
            </Button>
          </div>

          <div className="pdf-export-modal__options">
            <Checkbox
              id="opt-dashboard"
              labelText="Dashboard Overview"
              checked={exportOptions.includeDashboard}
              onChange={() => handleOptionChange('includeDashboard')}
            />
            <Checkbox
              id="opt-compute"
              labelText="Compute Analysis"
              checked={exportOptions.includeCompute}
              onChange={() => handleOptionChange('includeCompute')}
            />
            <Checkbox
              id="opt-storage"
              labelText="Storage Analysis"
              checked={exportOptions.includeStorage}
              onChange={() => handleOptionChange('includeStorage')}
            />
            <Checkbox
              id="opt-network"
              labelText="Network Analysis"
              checked={exportOptions.includeNetwork}
              onChange={() => handleOptionChange('includeNetwork')}
            />
            <Checkbox
              id="opt-clusters"
              labelText="Clusters Analysis"
              checked={exportOptions.includeClusters}
              onChange={() => handleOptionChange('includeClusters')}
            />
            <Checkbox
              id="opt-hosts"
              labelText="Hosts Analysis"
              checked={exportOptions.includeHosts}
              onChange={() => handleOptionChange('includeHosts')}
            />
            <Checkbox
              id="opt-resourcepools"
              labelText="Resource Pools"
              checked={exportOptions.includeResourcePools}
              onChange={() => handleOptionChange('includeResourcePools')}
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
