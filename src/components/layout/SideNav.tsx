// Side navigation component
import { useLocation, useNavigate } from 'react-router-dom';
import {
  SideNav as CarbonSideNav,
  SideNavItems,
  SideNavLink,
  SideNavDivider,
} from '@carbon/react';
import {
  Dashboard,
  ChartBar,
  DataVolume,
  Network_3,
  SoftwareResourceCluster,
  Chip,
  GroupResource,
  LogoKubernetes,
  VirtualMachine,
  TaskComplete,
  Search,
  Table,
  Upload,
  Information,
  Notebook,
  Book,
  DataShare,
  Migrate,
  Help,
  Chat,
  Settings,
} from '@carbon/icons-react';
import { Tag } from '@carbon/react';
import { useHasData } from '@/hooks';
import { useAISettings } from '@/hooks/useAISettings';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { ROUTES } from '@/utils/constants';

interface SideNavProps {
  isExpanded?: boolean;
}

export function SideNav({ isExpanded = true }: SideNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const hasData = useHasData();
  const { settings: aiSettings } = useAISettings();
  const aiConfigured = isAIProxyConfigured();

  const isActive = (path: string) => location.pathname === path;

  const handleNavClick = (e: React.MouseEvent, path: string, requiresData = false) => {
    e.preventDefault();
    if (requiresData && !hasData) return;
    navigate(path);
  };

  return (
    <CarbonSideNav
      aria-label="Side navigation"
      isRail={!isExpanded}
      expanded={isExpanded}
    >
      <SideNavItems>
        <SideNavLink
          renderIcon={Upload}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.home)}
          isActive={isActive(ROUTES.home)}
        >
          Upload
        </SideNavLink>

        <SideNavDivider />

        <SideNavLink
          renderIcon={Dashboard}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.dashboard, true)}
          isActive={isActive(ROUTES.dashboard)}
          className={!hasData ? 'sidenav-link--disabled' : ''}
        >
          Dashboard
        </SideNavLink>

        <SideNavLink
          renderIcon={ChartBar}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.compute, true)}
          isActive={isActive(ROUTES.compute)}
          className={!hasData ? 'sidenav-link--disabled' : ''}
        >
          Compute
        </SideNavLink>

        <SideNavLink
          renderIcon={DataVolume}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.storage, true)}
          isActive={isActive(ROUTES.storage)}
          className={!hasData ? 'sidenav-link--disabled' : ''}
        >
          Storage
        </SideNavLink>

        <SideNavLink
          renderIcon={Network_3}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.network, true)}
          isActive={isActive(ROUTES.network)}
          className={!hasData ? 'sidenav-link--disabled' : ''}
        >
          Network
        </SideNavLink>

        <SideNavLink
          renderIcon={SoftwareResourceCluster}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.cluster, true)}
          isActive={isActive(ROUTES.cluster)}
          className={!hasData ? 'sidenav-link--disabled' : ''}
        >
          Clusters
        </SideNavLink>

        <SideNavLink
          renderIcon={Chip}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.hosts, true)}
          isActive={isActive(ROUTES.hosts)}
          className={!hasData ? 'sidenav-link--disabled' : ''}
        >
          Hosts
        </SideNavLink>

        <SideNavLink
          renderIcon={GroupResource}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.resourcePools, true)}
          isActive={isActive(ROUTES.resourcePools)}
          className={!hasData ? 'sidenav-link--disabled' : ''}
        >
          Resource Pools
        </SideNavLink>

        <SideNavLink
          renderIcon={Table}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.tables, true)}
          isActive={isActive(ROUTES.tables)}
          className={!hasData ? 'sidenav-link--disabled' : ''}
        >
          Data Tables
        </SideNavLink>

        <SideNavDivider />

        <SideNavLink
          renderIcon={Search}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.discovery, true)}
          isActive={isActive(ROUTES.discovery)}
          className={!hasData ? 'sidenav-link--disabled' : ''}
        >
          Discovery
        </SideNavLink>

        <SideNavLink
          renderIcon={LogoKubernetes}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.roksMigration, true)}
          isActive={isActive(ROUTES.roksMigration)}
          className={!hasData ? 'sidenav-link--disabled' : ''}
        >
          ROKS Migration
        </SideNavLink>

        <SideNavLink
          renderIcon={VirtualMachine}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.vsiMigration, true)}
          isActive={isActive(ROUTES.vsiMigration)}
          className={!hasData ? 'sidenav-link--disabled' : ''}
        >
          VSI Migration
        </SideNavLink>

        <SideNavLink
          renderIcon={TaskComplete}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.preflightReport, true)}
          isActive={isActive(ROUTES.preflightReport)}
          className={!hasData ? 'sidenav-link--disabled' : ''}
        >
          Pre-Flight Report
        </SideNavLink>

        <SideNavDivider />

        <SideNavLink
          renderIcon={Settings}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.settings)}
          isActive={isActive(ROUTES.settings)}
        >
          Settings
        </SideNavLink>

        <SideNavLink
          renderIcon={Help}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.about)}
          isActive={isActive(ROUTES.about)}
        >
          About
        </SideNavLink>

        <SideNavLink
          renderIcon={Information}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.info)}
          isActive={isActive(ROUTES.info)}
        >
          Sizing Guide
        </SideNavLink>

        <SideNavLink
          renderIcon={Notebook}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.userGuide)}
          isActive={isActive(ROUTES.userGuide)}
        >
          User Guide
        </SideNavLink>

        <SideNavLink
          renderIcon={Book}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.documentation)}
          isActive={isActive(ROUTES.documentation)}
        >
          Documentation
        </SideNavLink>

        <SideNavLink
          renderIcon={DataShare}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.vsiMigrationMethods)}
          isActive={isActive(ROUTES.vsiMigrationMethods)}
        >
          VSI Migration Methods
        </SideNavLink>

        <SideNavLink
          renderIcon={Migrate}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.mtvDocumentation)}
          isActive={isActive(ROUTES.mtvDocumentation)}
        >
          MTV Guide
        </SideNavLink>

        <SideNavLink
          renderIcon={Chat}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.chat)}
          isActive={isActive(ROUTES.chat)}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            AI Assistant
            {aiConfigured && !aiSettings.enabled && (
              <Tag type="gray" size="sm">Off</Tag>
            )}
          </span>
        </SideNavLink>
      </SideNavItems>
    </CarbonSideNav>
  );
}
