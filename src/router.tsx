// Application router configuration
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout';
import { LandingPage } from '@/pages/LandingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ComputePage } from '@/pages/ComputePage';
import { StoragePage } from '@/pages/StoragePage';
import { NetworkPage } from '@/pages/NetworkPage';
import { ClusterPage } from '@/pages/ClusterPage';
import { HostsPage } from '@/pages/HostsPage';
import { ResourcePoolPage } from '@/pages/ResourcePoolPage';
import { ROKSMigrationPage } from '@/pages/ROKSMigrationPage';
import { VSIMigrationPage } from '@/pages/VSIMigrationPage';
import { PreFlightReportPage } from '@/pages/PreFlightReportPage';
import { DiscoveryPage } from '@/pages/DiscoveryPage';
import { TablesPage } from '@/pages/TablesPage';
import { InfoPage } from '@/pages/InfoPage';
import { DocumentationPage } from '@/pages/DocumentationPage';
import { ROUTES } from '@/utils/constants';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <LandingPage />,
      },
      {
        path: ROUTES.dashboard.slice(1), // Remove leading slash
        element: <DashboardPage />,
      },
      {
        path: ROUTES.compute.slice(1),
        element: <ComputePage />,
      },
      {
        path: ROUTES.storage.slice(1),
        element: <StoragePage />,
      },
      {
        path: ROUTES.network.slice(1),
        element: <NetworkPage />,
      },
      {
        path: ROUTES.cluster.slice(1),
        element: <ClusterPage />,
      },
      {
        path: ROUTES.hosts.slice(1),
        element: <HostsPage />,
      },
      {
        path: ROUTES.resourcePools.slice(1),
        element: <ResourcePoolPage />,
      },
      {
        path: ROUTES.roksMigration.slice(1),
        element: <ROKSMigrationPage />,
      },
      {
        path: ROUTES.vsiMigration.slice(1),
        element: <VSIMigrationPage />,
      },
      {
        path: ROUTES.preflightReport.slice(1),
        element: <PreFlightReportPage />,
      },
      {
        path: ROUTES.discovery.slice(1),
        element: <DiscoveryPage />,
      },
      {
        path: ROUTES.tables.slice(1),
        element: <TablesPage />,
      },
      {
        path: ROUTES.info.slice(1),
        element: <InfoPage />,
      },
      {
        path: ROUTES.documentation.slice(1),
        element: <DocumentationPage />,
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
