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
  Settings,
  Kubernetes,
  VirtualMachine,
  TaskComplete,
  Search,
  Table,
  Upload,
  Information,
} from '@carbon/icons-react';
import { useHasData } from '@/hooks';
import { ROUTES } from '@/utils/constants';

interface SideNavProps {
  isExpanded?: boolean;
}

export function SideNav({ isExpanded = true }: SideNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const hasData = useHasData();

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
          renderIcon={Settings}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.config, true)}
          isActive={isActive(ROUTES.config)}
          className={!hasData ? 'sidenav-link--disabled' : ''}
        >
          Configuration
        </SideNavLink>

        <SideNavLink
          renderIcon={Kubernetes}
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
          renderIcon={Information}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.info)}
          isActive={isActive(ROUTES.info)}
        >
          Sizing Guide
        </SideNavLink>
      </SideNavItems>
    </CarbonSideNav>
  );
}
