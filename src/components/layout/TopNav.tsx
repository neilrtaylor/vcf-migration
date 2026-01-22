// Top navigation header
import {
  Header,
  HeaderName,
  HeaderGlobalBar,
  HeaderGlobalAction,
} from '@carbon/react';
import { Information, Upload, DocumentExport, DataTableReference, Document, Light, Asleep } from '@carbon/icons-react';
import { useNavigate } from 'react-router-dom';
import { useHasData } from '@/hooks';
import { useTheme } from '@/context';
import { ROUTES } from '@/utils/constants';

interface TopNavProps {
  onUploadClick?: () => void;
  onExportPDFClick?: () => void;
  onExportExcelClick?: () => void;
  onExportDocxClick?: () => void;
}

export function TopNav({ onUploadClick, onExportPDFClick, onExportExcelClick, onExportDocxClick }: TopNavProps) {
  const hasData = useHasData();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

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
        {hasData && onExportDocxClick && (
          <HeaderGlobalAction
            aria-label="Export Report (DOCX)"
            onClick={onExportDocxClick}
            tooltipAlignment="end"
          >
            <Document size={20} />
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
          aria-label={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          onClick={toggleTheme}
          tooltipAlignment="end"
        >
          {theme === 'light' ? <Asleep size={20} /> : <Light size={20} />}
        </HeaderGlobalAction>
        <HeaderGlobalAction
          aria-label="About"
          tooltipAlignment="end"
          onClick={() => navigate(ROUTES.documentation)}
        >
          <Information size={20} />
        </HeaderGlobalAction>
      </HeaderGlobalBar>
    </Header>
  );
}
