// Hook for managing chart drill-down filters
import { useCallback } from 'react';
import { useData } from './useData';
import type { ChartFilter } from '@/context/dataReducer';

export function useChartFilter() {
  const { chartFilter, setChartFilter, clearChartFilter } = useData();

  // Set a filter from a chart click
  const setFilter = useCallback((dimension: string, value: string, source: string) => {
    setChartFilter({ dimension, value, source });
  }, [setChartFilter]);

  // Clear the current filter
  const clearFilter = useCallback(() => {
    clearChartFilter();
  }, [clearChartFilter]);

  // Apply the current filter to an array of items
  const applyFilter = useCallback(<T,>(
    items: T[],
    accessor: (item: T) => string
  ): T[] => {
    if (!chartFilter) return items;
    return items.filter(item => accessor(item) === chartFilter.value);
  }, [chartFilter]);

  // Check if a filter is active for a specific dimension
  const isFilterActive = useCallback((dimension?: string): boolean => {
    if (!chartFilter) return false;
    if (dimension) return chartFilter.dimension === dimension;
    return true;
  }, [chartFilter]);

  // Get the current filter value for a dimension
  const getFilterValue = useCallback((dimension: string): string | null => {
    if (!chartFilter || chartFilter.dimension !== dimension) return null;
    return chartFilter.value;
  }, [chartFilter]);

  return {
    chartFilter,
    setFilter,
    clearFilter,
    applyFilter,
    isFilterActive,
    getFilterValue,
  };
}

export type { ChartFilter };
