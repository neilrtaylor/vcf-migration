// Loading skeleton components for various page layouts
import {
  Grid,
  Column,
  SkeletonPlaceholder,
  SkeletonText,
} from '@carbon/react';
import './LoadingSkeleton.scss';

interface LoadingSkeletonProps {
  type?: 'dashboard' | 'chart' | 'table' | 'page';
}

export function LoadingSkeleton({ type = 'page' }: LoadingSkeletonProps) {
  switch (type) {
    case 'dashboard':
      return <DashboardSkeleton />;
    case 'chart':
      return <ChartSkeleton />;
    case 'table':
      return <TableSkeleton />;
    default:
      return <PageSkeleton />;
  }
}

function DashboardSkeleton() {
  return (
    <div className="loading-skeleton">
      <Grid>
        {/* Title */}
        <Column lg={16} md={8} sm={4}>
          <SkeletonText heading width="30%" />
          <SkeletonText width="50%" />
        </Column>

        {/* Metric cards */}
        {[1, 2, 3, 4].map((i) => (
          <Column key={i} lg={4} md={4} sm={2}>
            <div className="loading-skeleton__card">
              <SkeletonText width="60%" />
              <SkeletonPlaceholder className="loading-skeleton__metric" />
              <SkeletonText width="40%" />
            </div>
          </Column>
        ))}

        {/* Charts */}
        <Column lg={8} md={8} sm={4}>
          <div className="loading-skeleton__chart">
            <SkeletonText heading width="40%" />
            <SkeletonPlaceholder className="loading-skeleton__chart-area" />
          </div>
        </Column>
        <Column lg={8} md={8} sm={4}>
          <div className="loading-skeleton__chart">
            <SkeletonText heading width="40%" />
            <SkeletonPlaceholder className="loading-skeleton__chart-area" />
          </div>
        </Column>
      </Grid>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="loading-skeleton__chart">
      <SkeletonText heading width="40%" />
      <SkeletonText width="60%" />
      <SkeletonPlaceholder className="loading-skeleton__chart-area" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="loading-skeleton__table">
      <SkeletonText heading width="30%" />
      <div className="loading-skeleton__table-header">
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonText key={i} width="80%" />
        ))}
      </div>
      {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
        <div key={row} className="loading-skeleton__table-row">
          {[1, 2, 3, 4, 5].map((col) => (
            <SkeletonText key={col} width={`${60 + Math.random() * 30}%`} />
          ))}
        </div>
      ))}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="loading-skeleton">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <SkeletonText heading width="40%" />
          <SkeletonText width="70%" />
        </Column>
        <Column lg={16} md={8} sm={4}>
          <SkeletonPlaceholder className="loading-skeleton__content" />
        </Column>
      </Grid>
    </div>
  );
}
