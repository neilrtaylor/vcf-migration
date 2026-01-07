// Common chart wrapper component
import type { ReactNode } from 'react';
import './ChartWrapper.scss';

interface ChartWrapperProps {
  title?: string;
  subtitle?: string;
  height?: number;
  children: ReactNode;
}

export function ChartWrapper({
  title,
  subtitle,
  height = 300,
  children,
}: ChartWrapperProps) {
  return (
    <div className="chart-wrapper">
      {(title || subtitle) && (
        <div className="chart-wrapper__header">
          {title && <h4 className="chart-wrapper__title">{title}</h4>}
          {subtitle && <p className="chart-wrapper__subtitle">{subtitle}</p>}
        </div>
      )}
      <div className="chart-wrapper__content" style={{ height }}>
        {children}
      </div>
    </div>
  );
}
