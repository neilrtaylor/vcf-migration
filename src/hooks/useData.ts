// Custom hook for accessing data context
import { useContext } from 'react';
import { DataContext } from '@/context/DataContext';

export function useData() {
  const context = useContext(DataContext);

  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }

  return context;
}

// Hook to check if data is loaded
export function useHasData() {
  const { rawData } = useData();
  return rawData !== null;
}

// Hook to get VM count
export function useVMCount() {
  const { rawData } = useData();
  return rawData?.vInfo.length ?? 0;
}

// Hook to get powered on VMs
export function usePoweredOnVMs() {
  const { rawData } = useData();
  return rawData?.vInfo.filter(vm => vm.powerState === 'poweredOn') ?? [];
}

// Hook to get templates
export function useTemplates() {
  const { rawData } = useData();
  return rawData?.vInfo.filter(vm => vm.template) ?? [];
}

// Hook to get non-template VMs
export function useVMs() {
  const { rawData } = useData();
  return rawData?.vInfo.filter(vm => !vm.template) ?? [];
}
