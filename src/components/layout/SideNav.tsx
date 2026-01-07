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
  Settings,
  Migrate,
  Table,
  Upload,
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
          renderIcon={Settings}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.config, true)}
          isActive={isActive(ROUTES.config)}
          className={!hasData ? 'sidenav-link--disabled' : ''}
        >
          Configuration
        </SideNavLink>

        <SideNavLink
          renderIcon={Migrate}
          href="#"
          onClick={(e) => handleNavClick(e, ROUTES.migration, true)}
          isActive={isActive(ROUTES.migration)}
          className={!hasData ? 'sidenav-link--disabled' : ''}
        >
          Migration
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
      </SideNavItems>
    </CarbonSideNav>
  );
}
