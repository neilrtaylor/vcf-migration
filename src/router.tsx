// Application router configuration with lazy loading for code splitting
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout';
import { ROUTES } from '@/utils/constants';
import { Loading } from '@carbon/react';

// Eagerly load landing page for immediate render
import { LandingPage } from '@/pages/LandingPage';

// Lazy load all other pages for code splitting
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ComputePage = lazy(() => import('@/pages/ComputePage').then(m => ({ default: m.ComputePage })));
const StoragePage = lazy(() => import('@/pages/StoragePage').then(m => ({ default: m.StoragePage })));
const NetworkPage = lazy(() => import('@/pages/NetworkPage').then(m => ({ default: m.NetworkPage })));
const ClusterPage = lazy(() => import('@/pages/ClusterPage').then(m => ({ default: m.ClusterPage })));
const HostsPage = lazy(() => import('@/pages/HostsPage').then(m => ({ default: m.HostsPage })));
const ResourcePoolPage = lazy(() => import('@/pages/ResourcePoolPage').then(m => ({ default: m.ResourcePoolPage })));
const ROKSMigrationPage = lazy(() => import('@/pages/ROKSMigrationPage').then(m => ({ default: m.ROKSMigrationPage })));
const VSIMigrationPage = lazy(() => import('@/pages/VSIMigrationPage').then(m => ({ default: m.VSIMigrationPage })));
const PreFlightReportPage = lazy(() => import('@/pages/PreFlightReportPage').then(m => ({ default: m.PreFlightReportPage })));
const DiscoveryPage = lazy(() => import('@/pages/DiscoveryPage').then(m => ({ default: m.DiscoveryPage })));
const TablesPage = lazy(() => import('@/pages/TablesPage').then(m => ({ default: m.TablesPage })));
const InfoPage = lazy(() => import('@/pages/InfoPage').then(m => ({ default: m.InfoPage })));
const DocumentationPage = lazy(() => import('@/pages/DocumentationPage').then(m => ({ default: m.DocumentationPage })));
const VSIMigrationMethodsPage = lazy(() => import('@/pages/VSIMigrationMethodsPage').then(m => ({ default: m.VSIMigrationMethodsPage })));
const MTVDocumentationPage = lazy(() => import('@/pages/MTVDocumentationPage').then(m => ({ default: m.MTVDocumentationPage })));

// Suspense wrapper for lazy-loaded pages
function PageLoader({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Loading description="Loading page..." withOverlay={false} />}>
      {children}
    </Suspense>
  );
}

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
        element: <PageLoader><DashboardPage /></PageLoader>,
      },
      {
        path: ROUTES.compute.slice(1),
        element: <PageLoader><ComputePage /></PageLoader>,
      },
      {
        path: ROUTES.storage.slice(1),
        element: <PageLoader><StoragePage /></PageLoader>,
      },
      {
        path: ROUTES.network.slice(1),
        element: <PageLoader><NetworkPage /></PageLoader>,
      },
      {
        path: ROUTES.cluster.slice(1),
        element: <PageLoader><ClusterPage /></PageLoader>,
      },
      {
        path: ROUTES.hosts.slice(1),
        element: <PageLoader><HostsPage /></PageLoader>,
      },
      {
        path: ROUTES.resourcePools.slice(1),
        element: <PageLoader><ResourcePoolPage /></PageLoader>,
      },
      {
        path: ROUTES.roksMigration.slice(1),
        element: <PageLoader><ROKSMigrationPage /></PageLoader>,
      },
      {
        path: ROUTES.vsiMigration.slice(1),
        element: <PageLoader><VSIMigrationPage /></PageLoader>,
      },
      {
        path: ROUTES.preflightReport.slice(1),
        element: <PageLoader><PreFlightReportPage /></PageLoader>,
      },
      {
        path: ROUTES.discovery.slice(1),
        element: <PageLoader><DiscoveryPage /></PageLoader>,
      },
      {
        path: ROUTES.tables.slice(1),
        element: <PageLoader><TablesPage /></PageLoader>,
      },
      {
        path: ROUTES.info.slice(1),
        element: <PageLoader><InfoPage /></PageLoader>,
      },
      {
        path: ROUTES.documentation.slice(1),
        element: <PageLoader><DocumentationPage /></PageLoader>,
      },
      {
        path: ROUTES.vsiMigrationMethods.slice(1),
        element: <PageLoader><VSIMigrationMethodsPage /></PageLoader>,
      },
      {
        path: ROUTES.mtvDocumentation.slice(1),
        element: <PageLoader><MTVDocumentationPage /></PageLoader>,
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
