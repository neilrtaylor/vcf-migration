// Top navigation header
import {
  Header,
  HeaderName,
  HeaderGlobalBar,
  HeaderGlobalAction,
} from '@carbon/react';
import { Information, Upload, DocumentExport, DataTableReference } from '@carbon/icons-react';
import { useHasData } from '@/hooks';

interface TopNavProps {
  onUploadClick?: () => void;
  onExportPDFClick?: () => void;
  onExportExcelClick?: () => void;
}

export function TopNav({ onUploadClick, onExportPDFClick, onExportExcelClick }: TopNavProps) {
  const hasData = useHasData();

  return (
    <Header aria-label="RVTools Analyzer">
      <HeaderName href="/" prefix="IBM">
        RVTools Analyzer
      </HeaderName>
      <HeaderGlobalBar>
        {hasData && onExportExcelClick && (
          <HeaderGlobalAction
            aria-label="Export Excel"
            onClick={onExportExcelClick}
            tooltipAlignment="end"
          >
            <DataTableReference size={20} />
          </HeaderGlobalAction>
        )}
        {hasData && onExportPDFClick && (
          <HeaderGlobalAction
            aria-label="Export PDF"
            onClick={onExportPDFClick}
            tooltipAlignment="end"
          >
            <DocumentExport size={20} />
          </HeaderGlobalAction>
        )}
        {onUploadClick && (
          <HeaderGlobalAction
            aria-label="Upload File"
            onClick={onUploadClick}
            tooltipAlignment="end"
          >
            <Upload size={20} />
          </HeaderGlobalAction>
        )}
        <HeaderGlobalAction
          aria-label="About"
          tooltipAlignment="end"
        >
          <Information size={20} />
        </HeaderGlobalAction>
      </HeaderGlobalBar>
    </Header>
  );
}
