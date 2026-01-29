// Custom hook for accessing data context
import { useContext } from 'react';
import { DataContext } from '@/context/DataContext';

// Import and re-export isVMwareInfrastructureVM from its data-driven home
import { isVMwareInfrastructureVM } from '@/utils/autoExclusion';
export { isVMwareInfrastructureVM };

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

// Hook to get VM count (excludes VMware infrastructure VMs)
export function useVMCount() {
  const { rawData } = useData();
  return rawData?.vInfo.filter(vm => !isVMwareInfrastructureVM(vm.vmName, vm.guestOS)).length ?? 0;
}

// Hook to get powered on VMs (excludes VMware infrastructure VMs)
export function usePoweredOnVMs() {
  const { rawData } = useData();
  return rawData?.vInfo.filter(vm =>
    vm.powerState === 'poweredOn' && !isVMwareInfrastructureVM(vm.vmName, vm.guestOS)
  ) ?? [];
}

// Hook to get templates
export function useTemplates() {
  const { rawData } = useData();
  return rawData?.vInfo.filter(vm => vm.template) ?? [];
}

// Hook to get non-template VMs (excludes VMware infrastructure VMs)
export function useVMs() {
  const { rawData } = useData();
  return rawData?.vInfo.filter(vm => !vm.template && !isVMwareInfrastructureVM(vm.vmName, vm.guestOS)) ?? [];
}

// Hook to get VMware infrastructure VMs excluded from migration (for reporting purposes)
export function useVMwareInfrastructureVMs() {
  const { rawData } = useData();
  return rawData?.vInfo.filter(vm => !vm.template && isVMwareInfrastructureVM(vm.vmName, vm.guestOS)) ?? [];
}

// Hook to get ALL VMs including templates and infrastructure VMs (for VM Management tab)
export function useAllVMs() {
  const { rawData } = useData();
  return rawData?.vInfo ?? [];
}

// Legacy alias for backwards compatibility
export const useNSXEdgeAppliances = useVMwareInfrastructureVMs;
