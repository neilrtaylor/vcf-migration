// Custom hook for accessing data context
import { useContext } from 'react';
import { DataContext } from '@/context/DataContext';

/**
 * Detects NSX-T edge appliances that should be excluded from migration.
 * These are infrastructure VMs (T0/T1 gateways) that won't migrate to IBM Cloud.
 */
function isNSXEdgeAppliance(vmName: string): boolean {
  const name = vmName.toLowerCase();
  // Common NSX-T edge naming patterns
  return (
    name.includes('cust-edge') ||
    name.includes('service-edge') ||
    name.includes('nsx-edge') ||
    name.includes('edge-node') ||
    // Match patterns like "edge-01", "edge01", "t0-edge", "t1-edge"
    /\bedge[-_]?\d/.test(name) ||
    /t[01][-_]?edge/.test(name)
  );
}

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

// Hook to get VM count (excludes NSX edge appliances)
export function useVMCount() {
  const { rawData } = useData();
  return rawData?.vInfo.filter(vm => !isNSXEdgeAppliance(vm.vmName)).length ?? 0;
}

// Hook to get powered on VMs (excludes NSX edge appliances)
export function usePoweredOnVMs() {
  const { rawData } = useData();
  return rawData?.vInfo.filter(vm =>
    vm.powerState === 'poweredOn' && !isNSXEdgeAppliance(vm.vmName)
  ) ?? [];
}

// Hook to get templates
export function useTemplates() {
  const { rawData } = useData();
  return rawData?.vInfo.filter(vm => vm.template) ?? [];
}

// Hook to get non-template VMs (excludes NSX edge appliances)
export function useVMs() {
  const { rawData } = useData();
  return rawData?.vInfo.filter(vm => !vm.template && !isNSXEdgeAppliance(vm.vmName)) ?? [];
}

// Hook to get NSX edge appliances (for reporting purposes)
export function useNSXEdgeAppliances() {
  const { rawData } = useData();
  return rawData?.vInfo.filter(vm => !vm.template && isNSXEdgeAppliance(vm.vmName)) ?? [];
}
