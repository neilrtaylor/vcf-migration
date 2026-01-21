// Unit tests for cost estimation service
import { describe, it, expect } from 'vitest';
import {
  calculateVSICost,
  calculateROKSCost,
  getRegions,
  getDiscountOptions,
  formatCurrency,
  formatCurrencyPrecise,
} from './costEstimation';
import type { VSISizingInput, ROKSSizingInput } from './costEstimation';

describe('Cost Estimation Service', () => {
  describe('getRegions', () => {
    it('should return a list of available regions', () => {
      const regions = getRegions();
      expect(regions).toBeInstanceOf(Array);
      expect(regions.length).toBeGreaterThan(0);
      expect(regions[0]).toHaveProperty('code');
      expect(regions[0]).toHaveProperty('name');
      expect(regions[0]).toHaveProperty('multiplier');
    });

    it('should include us-south region', () => {
      const regions = getRegions();
      const usSouth = regions.find(r => r.code === 'us-south');
      expect(usSouth).toBeDefined();
      expect(usSouth?.name).toBe('Dallas');
      expect(usSouth?.multiplier).toBe(1.0);
    });

    it('should have correct multipliers for regional pricing', () => {
      const regions = getRegions();
      const euDe = regions.find(r => r.code === 'eu-de');
      expect(euDe).toBeDefined();
      expect(euDe?.multiplier).toBeGreaterThan(1.0); // Europe typically has higher prices
    });
  });

  describe('getDiscountOptions', () => {
    it('should return a list of discount options', () => {
      const discounts = getDiscountOptions();
      expect(discounts).toBeInstanceOf(Array);
      expect(discounts.length).toBeGreaterThan(0);
      expect(discounts[0]).toHaveProperty('id');
      expect(discounts[0]).toHaveProperty('name');
      expect(discounts[0]).toHaveProperty('discountPct');
    });

    it('should have on-demand pricing with 0% discount', () => {
      const discounts = getDiscountOptions();
      const onDemand = discounts.find(d => d.id === 'onDemand');
      expect(onDemand).toBeDefined();
      expect(onDemand?.discountPct).toBe(0);
    });

    it('should have reserved pricing with discounts', () => {
      const discounts = getDiscountOptions();
      const reserved1yr = discounts.find(d => d.id === 'reserved1Year');
      const reserved3yr = discounts.find(d => d.id === 'reserved3Year');
      expect(reserved1yr).toBeDefined();
      expect(reserved3yr).toBeDefined();
      expect(reserved1yr?.discountPct).toBeGreaterThan(0);
      expect(reserved3yr?.discountPct).toBeGreaterThan(reserved1yr!.discountPct);
    });
  });

  describe('formatCurrency', () => {
    it('should format currency without decimals', () => {
      expect(formatCurrency(1234)).toBe('$1,234');
      expect(formatCurrency(1234567)).toBe('$1,234,567');
    });

    it('should round to nearest whole number', () => {
      expect(formatCurrency(1234.56)).toBe('$1,235');
      expect(formatCurrency(1234.49)).toBe('$1,234');
    });

    it('should handle zero', () => {
      expect(formatCurrency(0)).toBe('$0');
    });
  });

  describe('formatCurrencyPrecise', () => {
    it('should format currency with 2 decimal places', () => {
      expect(formatCurrencyPrecise(1234.56)).toBe('$1,234.56');
      expect(formatCurrencyPrecise(1234)).toBe('$1,234.00');
    });
  });

  describe('calculateVSICost', () => {
    const basicVSIInput: VSISizingInput = {
      vmProfiles: [
        { profile: 'bx2-4x16', count: 5 },
        { profile: 'cx2-8x16', count: 3 },
      ],
      storageTiB: 10,
      storageTier: '10iops',
    };

    it('should calculate VSI costs correctly', () => {
      const result = calculateVSICost(basicVSIInput, 'us-south', 'onDemand');

      expect(result).toHaveProperty('architecture', 'VPC Virtual Server Instances');
      expect(result).toHaveProperty('region', 'us-south');
      expect(result).toHaveProperty('lineItems');
      expect(result).toHaveProperty('totalMonthly');
      expect(result).toHaveProperty('totalAnnual');
      expect(result.lineItems.length).toBeGreaterThan(0);
    });

    it('should apply regional multiplier', () => {
      const usSouthResult = calculateVSICost(basicVSIInput, 'us-south', 'onDemand');
      const euDeResult = calculateVSICost(basicVSIInput, 'eu-de', 'onDemand');

      // EU should be more expensive due to regional multiplier
      expect(euDeResult.totalMonthly).toBeGreaterThan(usSouthResult.totalMonthly);
    });

    it('should apply discounts correctly', () => {
      const onDemandResult = calculateVSICost(basicVSIInput, 'us-south', 'onDemand');
      const reservedResult = calculateVSICost(basicVSIInput, 'us-south', 'reserved1Year');

      expect(reservedResult.totalMonthly).toBeLessThan(onDemandResult.totalMonthly);
      expect(reservedResult.discountPct).toBeGreaterThan(0);
    });

    it('should include storage costs', () => {
      const result = calculateVSICost(basicVSIInput, 'us-south', 'onDemand');
      const storageItem = result.lineItems.find(item => item.category === 'Storage - Block');

      expect(storageItem).toBeDefined();
      expect(storageItem?.quantity).toBe(10 * 1024); // 10 TiB in GB
    });

    it('should include networking costs', () => {
      const result = calculateVSICost(basicVSIInput, 'us-south', 'onDemand');
      const networkingItems = result.lineItems.filter(item => item.category === 'Networking');

      expect(networkingItems.length).toBeGreaterThan(0);
    });

    it('should handle empty VM profiles', () => {
      const emptyInput: VSISizingInput = {
        vmProfiles: [],
        storageTiB: 0,
      };

      const result = calculateVSICost(emptyInput, 'us-south', 'onDemand');
      expect(result.totalMonthly).toBeGreaterThanOrEqual(0);
    });

    it('should include VPN gateway when specified', () => {
      const inputWithVPN: VSISizingInput = {
        ...basicVSIInput,
        networking: {
          includeVPN: true,
          vpnGatewayCount: 2,
        },
      };

      const result = calculateVSICost(inputWithVPN, 'us-south', 'onDemand');
      const vpnItem = result.lineItems.find(item => item.description === 'VPN Gateway');

      expect(vpnItem).toBeDefined();
      expect(vpnItem?.quantity).toBe(2);
    });

    it('should include Transit Gateway when specified', () => {
      const inputWithTransitGw: VSISizingInput = {
        ...basicVSIInput,
        networking: {
          includeTransitGateway: true,
          transitGatewayLocalConnections: 3,
          transitGatewayGlobalConnections: 1,
        },
      };

      const result = calculateVSICost(inputWithTransitGw, 'us-south', 'onDemand');
      const localConnItem = result.lineItems.find(item => item.description.includes('Local Connection'));
      const globalConnItem = result.lineItems.find(item => item.description.includes('Global Connection'));

      expect(localConnItem).toBeDefined();
      expect(localConnItem?.quantity).toBe(3);
      expect(globalConnItem).toBeDefined();
      expect(globalConnItem?.quantity).toBe(1);
    });

    it('should include Public Gateway when specified', () => {
      const inputWithPgw: VSISizingInput = {
        ...basicVSIInput,
        networking: {
          includePublicGateway: true,
          publicGatewayCount: 3,
        },
      };

      const result = calculateVSICost(inputWithPgw, 'us-south', 'onDemand');
      const pgwItem = result.lineItems.find(item => item.description === 'Public Gateway');

      expect(pgwItem).toBeDefined();
      expect(pgwItem?.quantity).toBe(3);
    });

    it('should calculate annual cost correctly', () => {
      const result = calculateVSICost(basicVSIInput, 'us-south', 'onDemand');
      expect(result.totalAnnual).toBe(result.totalMonthly * 12);
    });
  });

  describe('calculateROKSCost', () => {
    const basicROKSInput: ROKSSizingInput = {
      computeNodes: 3,
      computeProfile: 'bx2d-metal-96x384', // Hyphenated format
      storageNodes: 3,
      storageProfile: 'bx2-16x64',
      storageTiB: 20,
      storageTier: '10iops',
    };

    it('should calculate ROKS costs correctly', () => {
      const result = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand');

      // Architecture depends on useNvme flag
      expect(result).toHaveProperty('architecture', 'Hybrid (Bare Metal + VSI Storage)');
      expect(result).toHaveProperty('region', 'us-south');
      expect(result).toHaveProperty('lineItems');
      expect(result).toHaveProperty('totalMonthly');
      expect(result.lineItems.length).toBeGreaterThan(0);
    });

    it('should include compute node costs', () => {
      const result = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand');
      const computeItem = result.lineItems.find(item => item.category === 'Compute');

      expect(computeItem).toBeDefined();
      expect(computeItem?.quantity).toBe(3);
    });

    it('should include storage node costs', () => {
      const result = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand');
      // In hybrid mode, storage nodes are VSIs
      const storageItem = result.lineItems.find(item => item.category === 'Storage - VSI');

      expect(storageItem).toBeDefined();
      expect(storageItem?.quantity).toBe(3);
    });

    it('should apply regional multiplier', () => {
      const usSouthResult = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand');
      const euDeResult = calculateROKSCost(basicROKSInput, 'eu-de', 'onDemand');

      expect(euDeResult.totalMonthly).toBeGreaterThan(usSouthResult.totalMonthly);
    });

    it('should apply discounts correctly', () => {
      const onDemandResult = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand');
      const reservedResult = calculateROKSCost(basicROKSInput, 'us-south', 'reserved3Year');

      expect(reservedResult.totalMonthly).toBeLessThan(onDemandResult.totalMonthly);
    });

    it('should include metadata', () => {
      const result = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand');

      expect(result.metadata).toHaveProperty('pricingVersion');
      expect(result.metadata).toHaveProperty('generatedAt');
      expect(result.metadata).toHaveProperty('notes');
      expect(result.metadata.notes.length).toBeGreaterThan(0);
    });
  });
});
