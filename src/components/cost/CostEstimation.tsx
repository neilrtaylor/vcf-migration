// Cost Estimation Component
import { useState, useMemo } from 'react';
import {
  Tile,
  Select,
  SelectItem,
  Button,
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  InlineNotification,
  Toggle,
  NumberInput,
  Accordion,
  AccordionItem,
  Tag,
} from '@carbon/react';
import { Download, Calculator } from '@carbon/icons-react';
import { MetricCard } from '@/components/common';
import { PricingRefresh } from '@/components/pricing';
import { ProfilesRefresh } from '@/components/profiles';
import { useDynamicPricing, useDynamicProfiles } from '@/hooks';
import type { CostEstimate, RegionCode, DiscountType, ROKSSizingInput, VSISizingInput, NetworkingOptions } from '@/services/costEstimation';
import {
  calculateROKSCost,
  calculateVSICost,
  getRegions,
  getDiscountOptions,
  formatCurrency,
  getBareMetalProfiles,
} from '@/services/costEstimation';
import { downloadBOM, downloadVSIBOMExcel, downloadROKSBOMExcel } from '@/services/export';
import type { VMDetail, ROKSNodeDetail } from '@/services/export';
import './CostEstimation.scss';

interface CostEstimationProps {
  type: 'roks' | 'vsi';
  roksSizing?: ROKSSizingInput;
  vsiSizing?: VSISizingInput;
  vmDetails?: VMDetail[];
  roksNodeDetails?: ROKSNodeDetail[];
  title?: string;
  showPricingRefresh?: boolean;
}

export function CostEstimation({ type, roksSizing, vsiSizing, vmDetails, roksNodeDetails, title, showPricingRefresh = true }: CostEstimationProps) {
  const [region, setRegion] = useState<RegionCode>('us-south');
  const [discountType, setDiscountType] = useState<DiscountType>('onDemand');
  const showDetails = true; // Always show details

  // Networking options state (VSI only)
  const [networkingOptions, setNetworkingOptions] = useState<NetworkingOptions>({
    includeVPN: false,
    vpnGatewayCount: 1,
    includeTransitGateway: false,
    transitGatewayLocalConnections: 1,
    transitGatewayGlobalConnections: 0,
    includePublicGateway: false,
    publicGatewayCount: 1,
    loadBalancerCount: 1,
  });

  // Dynamic pricing hook
  const {
    pricing,
    isRefreshing,
    lastUpdated,
    source,
    refreshPricing,
    isApiAvailable,
    error: pricingError,
  } = useDynamicPricing();

  // Dynamic profiles hook
  const {
    isRefreshing: isRefreshingProfiles,
    lastUpdated: profilesLastUpdated,
    source: profilesSource,
    refreshProfiles,
    isApiAvailable: isProfilesApiAvailable,
    error: profilesError,
    profileCounts,
  } = useDynamicProfiles();

  const regions = getRegions(pricing);
  const discountOptions = getDiscountOptions(pricing);

  const estimate = useMemo<CostEstimate | null>(() => {
    if (type === 'roks' && roksSizing) {
      return calculateROKSCost(roksSizing, region, discountType, pricing);
    } else if (type === 'vsi' && vsiSizing) {
      // Add networking options to the sizing input
      const sizingWithNetworking: VSISizingInput = {
        ...vsiSizing,
        networking: networkingOptions,
      };
      return calculateVSICost(sizingWithNetworking, region, discountType, pricing);
    }
    return null;
  }, [type, roksSizing, vsiSizing, region, discountType, pricing, networkingOptions]);

  // Calculate costs for all bare metal profiles (ROKS only)
  const allProfileCosts = useMemo(() => {
    if (type !== 'roks' || !roksSizing) return null;

    const profiles = getBareMetalProfiles(pricing);
    // Filter to only NVMe profiles for ODF compatibility
    const nvmeProfiles = profiles.filter(p => p.hasNvme);

    const costs = nvmeProfiles.map(profile => {
      const profileSizing: ROKSSizingInput = {
        ...roksSizing,
        computeProfile: profile.id,
      };
      const cost = calculateROKSCost(profileSizing, region, discountType, pricing);
      return {
        profile,
        estimate: cost,
        isSelected: profile.id === roksSizing.computeProfile,
      };
    });

    // Sort by monthly cost to find most efficient
    const sortedCosts = [...costs].sort((a, b) => a.estimate.totalMonthly - b.estimate.totalMonthly);
    const lowestCostProfileId = sortedCosts[0]?.profile.id;

    return costs.map(c => ({
      ...c,
      isBestValue: c.profile.id === lowestCostProfileId,
    }));
  }, [type, roksSizing, region, discountType, pricing]);

  if (!estimate) {
    return (
      <Tile className="cost-estimation cost-estimation--empty">
        <div className="cost-estimation__empty-state">
          <Calculator size={48} />
          <p>Configure sizing parameters to see cost estimates</p>
        </div>
      </Tile>
    );
  }

  const tableHeaders = [
    { key: 'category', header: 'Category' },
    { key: 'description', header: 'Description' },
    { key: 'quantity', header: 'Qty' },
    { key: 'unitCost', header: 'Unit Cost' },
    { key: 'monthlyCost', header: 'Monthly' },
    { key: 'annualCost', header: 'Annual' },
  ];

  const tableRows = estimate.lineItems.map((item, idx) => ({
    id: `item-${idx}`,
    category: item.category,
    description: item.description,
    quantity: `${item.quantity.toLocaleString()} ${item.unit}`,
    unitCost: formatCurrency(item.unitCost),
    monthlyCost: formatCurrency(item.monthlyCost),
    annualCost: formatCurrency(item.annualCost),
    notes: item.notes,
  }));

  const handleExport = async (format: 'text' | 'json' | 'csv' | 'xlsx') => {
    if (format === 'xlsx') {
      // Use xlsx export for detailed BOM
      if (type === 'vsi' && vmDetails && vmDetails.length > 0) {
        await downloadVSIBOMExcel(vmDetails, estimate, 'Default VPC', region, discountType);
      } else if (type === 'roks' && roksNodeDetails && roksNodeDetails.length > 0) {
        await downloadROKSBOMExcel(estimate, roksNodeDetails, 'ROKS Cluster', region, discountType);
      } else {
        // Fallback to text BOM if no detailed data
        downloadBOM(estimate, 'text');
      }
    } else {
      downloadBOM(estimate, format);
    }
  };

  return (
    <div className="cost-estimation">
      <Tile className="cost-estimation__header">
        <div className="cost-estimation__title-row">
          <h3>{title || 'Cost Estimation'}</h3>
          <div className="cost-estimation__actions">
            {showPricingRefresh && (
              <>
                <PricingRefresh
                  lastUpdated={lastUpdated}
                  source={source}
                  isRefreshing={isRefreshing}
                  onRefresh={refreshPricing}
                  isApiAvailable={isApiAvailable}
                  error={pricingError}
                  compact
                />
                <ProfilesRefresh
                  lastUpdated={profilesLastUpdated}
                  source={profilesSource}
                  isRefreshing={isRefreshingProfiles}
                  onRefresh={refreshProfiles}
                  isApiAvailable={isProfilesApiAvailable}
                  error={profilesError}
                  profileCounts={profileCounts}
                  compact
                />
              </>
            )}
            <Button
              kind="ghost"
              size="sm"
              renderIcon={Download}
              onClick={() => handleExport('xlsx')}
            >
              Export BOM
            </Button>
          </div>
        </div>

        <div className="cost-estimation__controls">
          <Select
            id="region-select"
            labelText="Region"
            value={region}
            onChange={(e) => setRegion(e.target.value as RegionCode)}
          >
            {regions.map((r) => (
              <SelectItem
                key={r.code}
                value={r.code}
                text={`${r.name}${r.multiplier !== 1 ? ` (+${((r.multiplier - 1) * 100).toFixed(0)}%)` : ''}`}
              />
            ))}
          </Select>

          <Select
            id="discount-select"
            labelText="Pricing"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as DiscountType)}
          >
            {discountOptions.map((d) => (
              <SelectItem
                key={d.id}
                value={d.id}
                text={`${d.name}${d.discountPct > 0 ? ` (-${d.discountPct}%)` : ''}`}
              />
            ))}
          </Select>
        </div>

        {/* Networking Options (VSI only) */}
        {type === 'vsi' && (
          <Accordion className="cost-estimation__networking-accordion">
            <AccordionItem title="VPC Networking Options" open={false}>
              <div className="cost-estimation__networking-options">
                <div className="cost-estimation__networking-row">
                  <Toggle
                    id="vpn-toggle"
                    labelText="VPN Gateway"
                    labelA="Off"
                    labelB="On"
                    toggled={networkingOptions.includeVPN}
                    onToggle={(checked) => setNetworkingOptions(prev => ({ ...prev, includeVPN: checked }))}
                  />
                  {networkingOptions.includeVPN && (
                    <NumberInput
                      id="vpn-count"
                      label="Gateway count"
                      min={1}
                      max={10}
                      value={networkingOptions.vpnGatewayCount}
                      onChange={(_, { value }) => setNetworkingOptions(prev => ({ ...prev, vpnGatewayCount: value as number }))}
                      size="sm"
                      hideSteppers
                    />
                  )}
                  <span className="cost-estimation__networking-hint">Site-to-site VPN ($125/mo per gateway)</span>
                </div>

                <div className="cost-estimation__networking-row">
                  <Toggle
                    id="transit-gw-toggle"
                    labelText="Transit Gateway"
                    labelA="Off"
                    labelB="On"
                    toggled={networkingOptions.includeTransitGateway}
                    onToggle={(checked) => setNetworkingOptions(prev => ({ ...prev, includeTransitGateway: checked }))}
                  />
                  {networkingOptions.includeTransitGateway && (
                    <>
                      <NumberInput
                        id="transit-local"
                        label="Local connections"
                        min={0}
                        max={20}
                        value={networkingOptions.transitGatewayLocalConnections}
                        onChange={(_, { value }) => setNetworkingOptions(prev => ({ ...prev, transitGatewayLocalConnections: value as number }))}
                        size="sm"
                        hideSteppers
                      />
                      <NumberInput
                        id="transit-global"
                        label="Global connections"
                        min={0}
                        max={20}
                        value={networkingOptions.transitGatewayGlobalConnections}
                        onChange={(_, { value }) => setNetworkingOptions(prev => ({ ...prev, transitGatewayGlobalConnections: value as number }))}
                        size="sm"
                        hideSteppers
                      />
                    </>
                  )}
                  <span className="cost-estimation__networking-hint">VPC/Classic connectivity ($45/mo local, $170/mo global)</span>
                </div>

                <div className="cost-estimation__networking-row">
                  <Toggle
                    id="public-gw-toggle"
                    labelText="Public Gateway"
                    labelA="Off"
                    labelB="On"
                    toggled={networkingOptions.includePublicGateway}
                    onToggle={(checked) => setNetworkingOptions(prev => ({ ...prev, includePublicGateway: checked }))}
                  />
                  {networkingOptions.includePublicGateway && (
                    <NumberInput
                      id="public-gw-count"
                      label="Gateway count"
                      min={1}
                      max={10}
                      value={networkingOptions.publicGatewayCount}
                      onChange={(_, { value }) => setNetworkingOptions(prev => ({ ...prev, publicGatewayCount: value as number }))}
                      size="sm"
                      hideSteppers
                    />
                  )}
                  <span className="cost-estimation__networking-hint">Outbound internet access ($65/mo per gateway)</span>
                </div>

                <div className="cost-estimation__networking-row">
                  <NumberInput
                    id="lb-count"
                    label="Load Balancers"
                    min={0}
                    max={20}
                    value={networkingOptions.loadBalancerCount}
                    onChange={(_, { value }) => setNetworkingOptions(prev => ({ ...prev, loadBalancerCount: value as number }))}
                    size="sm"
                    hideSteppers
                  />
                  <span className="cost-estimation__networking-hint">Application Load Balancer ($35/mo each)</span>
                </div>
              </div>
            </AccordionItem>
          </Accordion>
        )}
      </Tile>

      {/* Cost Summary */}
      <div className="cost-estimation__summary">
        <MetricCard
          label="Monthly Cost"
          value={formatCurrency(estimate.totalMonthly)}
          detail={estimate.discountPct > 0 ? `${estimate.discountPct}% discount applied` : undefined}
          variant="primary"
        />
        <MetricCard
          label="Annual Cost"
          value={formatCurrency(estimate.totalAnnual)}
          variant="info"
        />
        {estimate.discountPct > 0 && (
          <MetricCard
            label="Annual Savings"
            value={formatCurrency(estimate.discountAmountAnnual)}
            variant="success"
          />
        )}
      </div>

      {/* Bare Metal Profile Comparison (ROKS only) */}
      {type === 'roks' && allProfileCosts && allProfileCosts.length > 0 && (
        <Tile className="cost-estimation__profile-comparison">
          <h4 className="cost-estimation__profile-comparison-title">
            Bare Metal Profile Cost Comparison
          </h4>
          <p className="cost-estimation__profile-comparison-subtitle">
            Costs for {roksSizing?.computeNodes || 0} nodes with {roksSizing?.useNvme ? 'NVMe storage' : 'block storage'}
          </p>
          <div className="cost-estimation__profile-grid">
            {allProfileCosts.map(({ profile, estimate: profileEstimate, isSelected, isBestValue }) => (
              <div
                key={profile.id}
                className={`cost-estimation__profile-card ${isSelected ? 'cost-estimation__profile-card--selected' : ''} ${isBestValue ? 'cost-estimation__profile-card--best-value' : ''}`}
              >
                <div className="cost-estimation__profile-card-header">
                  <span className="cost-estimation__profile-name">{profile.id}</span>
                  <div className="cost-estimation__profile-tags">
                    {isBestValue && <Tag type="green" size="sm">Best Value</Tag>}
                    {isSelected && <Tag type="blue" size="sm">Selected</Tag>}
                    {profile.roksSupported ? (
                      <Tag type="teal" size="sm">ROKS</Tag>
                    ) : (
                      <Tag type="gray" size="sm">VPC Only</Tag>
                    )}
                  </div>
                </div>
                <div className="cost-estimation__profile-specs">
                  <span>{profile.physicalCores} cores</span>
                  <span>{profile.memoryGiB} GiB RAM</span>
                  {profile.hasNvme && profile.totalNvmeGB && (
                    <span>{Math.round(profile.totalNvmeGB / 1024)} TiB NVMe</span>
                  )}
                </div>
                <div className="cost-estimation__profile-family">
                  <Tag type="gray" size="sm">{profile.family}</Tag>
                </div>
                <div className="cost-estimation__profile-costs">
                  <div className="cost-estimation__profile-cost-row">
                    <span className="cost-estimation__profile-cost-label">Monthly</span>
                    <span className="cost-estimation__profile-cost-value">{formatCurrency(profileEstimate.totalMonthly)}</span>
                  </div>
                  <div className="cost-estimation__profile-cost-row">
                    <span className="cost-estimation__profile-cost-label">Annual</span>
                    <span className="cost-estimation__profile-cost-value cost-estimation__profile-cost-value--annual">{formatCurrency(profileEstimate.totalAnnual)}</span>
                  </div>
                </div>
                {isBestValue && !isSelected && (
                  <div className="cost-estimation__profile-savings">
                    Save {formatCurrency((estimate.totalAnnual - profileEstimate.totalAnnual))}/year
                  </div>
                )}
              </div>
            ))}
          </div>
        </Tile>
      )}

      {/* Line Items Table */}
      {showDetails && (
        <Tile className="cost-estimation__details">
          <DataTable rows={tableRows} headers={tableHeaders} size="md">
            {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
              <Table {...getTableProps()} aria-label="Cost estimation line items">
                <TableHead>
                  <TableRow>
                    {headers.map((header) => (
                      <TableHeader {...getHeaderProps({ header })} key={header.key}>
                        {header.header}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow {...getRowProps({ row })} key={row.id}>
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id}>{cell.value}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {/* Subtotal row */}
                  <TableRow className="cost-estimation__subtotal-row">
                    <TableCell colSpan={4}><strong>Subtotal</strong></TableCell>
                    <TableCell><strong>{formatCurrency(estimate.subtotalMonthly)}</strong></TableCell>
                    <TableCell><strong>{formatCurrency(estimate.subtotalAnnual)}</strong></TableCell>
                  </TableRow>
                  {/* Discount row */}
                  {estimate.discountPct > 0 && (
                    <TableRow className="cost-estimation__discount-row">
                      <TableCell colSpan={4}>
                        <em>Discount ({estimate.discountPct}%)</em>
                      </TableCell>
                      <TableCell><em>-{formatCurrency(estimate.discountAmountMonthly)}</em></TableCell>
                      <TableCell><em>-{formatCurrency(estimate.discountAmountAnnual)}</em></TableCell>
                    </TableRow>
                  )}
                  {/* Total row */}
                  <TableRow className="cost-estimation__total-row">
                    <TableCell colSpan={4}><strong>Total</strong></TableCell>
                    <TableCell><strong>{formatCurrency(estimate.totalMonthly)}</strong></TableCell>
                    <TableCell><strong>{formatCurrency(estimate.totalAnnual)}</strong></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </DataTable>
        </Tile>
      )}

      {/* Notes */}
      <InlineNotification
        kind="info"
        title="Pricing Notes"
        subtitle={estimate.metadata.notes.join(' • ')}
        lowContrast
        hideCloseButton
        className="cost-estimation__notes"
      />

      <div className="cost-estimation__metadata">
        <span>Architecture: {estimate.architecture}</span>
        <span>Region: {estimate.regionName}</span>
        <span>Pricing Version: {estimate.metadata.pricingVersion}</span>
      </div>
    </div>
  );
}
