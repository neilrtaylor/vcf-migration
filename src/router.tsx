// Application router configuration
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout';
import { LandingPage } from '@/pages/LandingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ComputePage } from '@/pages/ComputePage';
import { StoragePage } from '@/pages/StoragePage';
import { NetworkPage } from '@/pages/NetworkPage';
import { ClusterPage } from '@/pages/ClusterPage';
import { ConfigPage } from '@/pages/ConfigPage';
import { MigrationPage } from '@/pages/MigrationPage';
import { TablesPage } from '@/pages/TablesPage';
import { InfoPage } from '@/pages/InfoPage';
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
        path: ROUTES.config.slice(1),
        element: <ConfigPage />,
      },
      {
        path: ROUTES.migration.slice(1),
        element: <MigrationPage />,
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
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
