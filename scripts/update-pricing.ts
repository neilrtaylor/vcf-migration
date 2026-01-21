#!/usr/bin/env npx tsx
/**
 * Script to update ibmCloudConfig.json with fresh pricing data from IBM Cloud Global Catalog API
 *
 * Usage:
 *   npm run update-pricing
 *
 * Requires:
 *   - VITE_IBM_CLOUD_API_KEY environment variable (or IBM_CLOUD_API_KEY)
 *
 * What it does:
 *   1. Fetches VSI profile pricing from Global Catalog API
 *   2. Fetches Bare Metal profile pricing from Global Catalog API
 *   3. Extracts hourly/monthly rates for us-south region
 *   4. Updates pricing in src/data/ibmCloudConfig.json
 *   5. Preserves all other configuration (profiles, storage tiers, networking, etc.)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const GLOBAL_CATALOG_BASE_URL = 'https://globalcatalog.cloud.ibm.com/api/v1';
const IAM_TOKEN_URL = 'https://iam.cloud.ibm.com/identity/token';
const REGION = 'us-south';
const HOURS_PER_MONTH = 730; // IBM Cloud uses 730 hours/month for pricing

const CONFIG_PATH = path.join(__dirname, '..', 'src', 'data', 'ibmCloudConfig.json');

// Types
interface PricingMetric {
  metric_id: string;
  tier_model?: string;
  resource_display_name?: string;
  charge_unit_display_name?: string;
  charge_unit_name?: string;
  charge_unit?: string;
  amounts?: Array<{
    country: string;
    currency: string;
    prices: Array<{
      quantity_tier: number;
      price: number;
    }>;
  }>;
}

interface CatalogResource {
  id: string;
  name: string;
  kind: string;
  active: boolean;
  disabled: boolean;
  geo_tags?: string[];
  metadata?: {
    ui?: {
      strings?: {
        en?: {
          display_name?: string;
        };
      };
    };
    pricing?: {
      type?: string;
      metrics?: PricingMetric[];
    };
  };
}

interface CatalogResponse {
  offset: number;
  limit: number;
  count: number;
  resource_count: number;
  resources: CatalogResource[];
}

interface PricingDeployment {
  deployment_id: string;
  deployment_location: string;
  metrics: PricingMetric[];
}

// Get API key from environment
function getApiKey(): string {
  const apiKey = process.env.VITE_IBM_CLOUD_API_KEY || process.env.IBM_CLOUD_API_KEY;
  if (!apiKey) {
    console.error('Error: No API key found.');
    console.error('Set VITE_IBM_CLOUD_API_KEY or IBM_CLOUD_API_KEY environment variable.');
    console.error('');
    console.error('Example:');
    console.error('  export IBM_CLOUD_API_KEY=your-api-key');
    console.error('  npm run update-pricing');
    process.exit(1);
  }
  return apiKey;
}

// Get IAM token
async function getIamToken(apiKey: string): Promise<string> {
  console.log('  Authenticating with IBM Cloud IAM...');

  const response = await fetch(IAM_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey: apiKey,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`IAM authentication failed: ${response.status} - ${text}`);
  }

  const data = await response.json();
  console.log('  Authentication successful');
  return data.access_token;
}

// Search the Global Catalog
async function searchCatalog(token: string, query: string): Promise<CatalogResponse> {
  const params = new URLSearchParams({
    q: query,
    include: 'metadata.pricing',
    _limit: '200',
  });

  const url = `${GLOBAL_CATALOG_BASE_URL}?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Catalog search failed: ${response.status} - ${text}`);
  }

  return response.json();
}

// Get pricing deployments for a specific resource
async function getPricingDeployments(token: string, resourceId: string): Promise<PricingDeployment[]> {
  const url = `${GLOBAL_CATALOG_BASE_URL}/${encodeURIComponent(resourceId)}/pricing`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    // Some resources don't have pricing endpoints
    if (response.status === 404) {
      return [];
    }
    const text = await response.text();
    throw new Error(`Get pricing failed: ${response.status} - ${text}`);
  }

  const data = await response.json();
  return data.deployment_location ? [data] : (data.deployments || []);
}

// Extract USD hourly price from metrics
function extractHourlyPrice(metrics: PricingMetric[]): number | null {
  for (const metric of metrics) {
    // Look for instance-hours metric
    if (metric.charge_unit === 'INSTANCE_HOURS' ||
        metric.charge_unit_name === 'INSTANCE_HOURS' ||
        metric.metric_id?.includes('instance')) {
      const amounts = metric.amounts || [];
      for (const amount of amounts) {
        if (amount.currency === 'USD') {
          // Get the first tier price (base price)
          const basePrice = amount.prices?.find(p => p.quantity_tier === 1);
          if (basePrice) {
            return basePrice.price;
          }
          // Fall back to first price
          if (amount.prices && amount.prices.length > 0) {
            return amount.prices[0].price;
          }
        }
      }
    }
  }
  return null;
}

// Fetch VSI pricing
async function fetchVSIPricing(token: string): Promise<Map<string, { hourlyRate: number; monthlyRate: number }>> {
  console.log('  Fetching VSI pricing from Global Catalog...');

  const pricing = new Map<string, { hourlyRate: number; monthlyRate: number }>();

  // Search for VPC VSI profiles
  const catalogResponse = await searchCatalog(token, 'is.instance');

  // Filter for active instance profiles
  const profiles = catalogResponse.resources.filter(
    r => r.active && !r.disabled && r.kind === 'instance.profile'
  );

  console.log(`  Found ${profiles.length} VSI profiles in catalog`);

  let processed = 0;
  let withPricing = 0;

  for (const profile of profiles) {
    processed++;

    // Try to get pricing from embedded metadata first
    let hourlyRate: number | null = null;

    if (profile.metadata?.pricing?.metrics) {
      hourlyRate = extractHourlyPrice(profile.metadata.pricing.metrics);
    }

    // If no embedded pricing, try the pricing endpoint
    if (hourlyRate === null) {
      try {
        const deployments = await getPricingDeployments(token, profile.id);
        const usDeployment = deployments.find(d =>
          d.deployment_location === REGION ||
          d.deployment_location === 'us' ||
          d.deployment_location === 'global'
        );
        if (usDeployment?.metrics) {
          hourlyRate = extractHourlyPrice(usDeployment.metrics);
        }
      } catch {
        // Ignore pricing fetch errors for individual profiles
      }
    }

    if (hourlyRate !== null && hourlyRate > 0) {
      const monthlyRate = Math.round(hourlyRate * HOURS_PER_MONTH * 100) / 100;
      pricing.set(profile.name, {
        hourlyRate: Math.round(hourlyRate * 1000) / 1000,
        monthlyRate,
      });
      withPricing++;
    }

    // Progress indicator
    if (processed % 20 === 0) {
      console.log(`    Processed ${processed}/${profiles.length} profiles...`);
    }
  }

  console.log(`  Retrieved pricing for ${withPricing} VSI profiles`);
  return pricing;
}

// Fetch Bare Metal pricing
async function fetchBareMetalPricing(token: string): Promise<Map<string, { hourlyRate: number; monthlyRate: number }>> {
  console.log('  Fetching Bare Metal pricing from Global Catalog...');

  const pricing = new Map<string, { hourlyRate: number; monthlyRate: number }>();

  // Search for bare metal server profiles
  const catalogResponse = await searchCatalog(token, 'is.bare-metal-server');

  // Filter for active bare metal profiles
  const profiles = catalogResponse.resources.filter(
    r => r.active && !r.disabled && r.kind === 'bare_metal_server.profile'
  );

  console.log(`  Found ${profiles.length} Bare Metal profiles in catalog`);

  let processed = 0;
  let withPricing = 0;

  for (const profile of profiles) {
    processed++;

    let hourlyRate: number | null = null;

    // Try embedded metadata first
    if (profile.metadata?.pricing?.metrics) {
      hourlyRate = extractHourlyPrice(profile.metadata.pricing.metrics);
    }

    // Try pricing endpoint
    if (hourlyRate === null) {
      try {
        const deployments = await getPricingDeployments(token, profile.id);
        const usDeployment = deployments.find(d =>
          d.deployment_location === REGION ||
          d.deployment_location === 'us' ||
          d.deployment_location === 'global'
        );
        if (usDeployment?.metrics) {
          hourlyRate = extractHourlyPrice(usDeployment.metrics);
        }
      } catch {
        // Ignore pricing fetch errors for individual profiles
      }
    }

    if (hourlyRate !== null && hourlyRate > 0) {
      const monthlyRate = Math.round(hourlyRate * HOURS_PER_MONTH * 100) / 100;
      pricing.set(profile.name, {
        hourlyRate: Math.round(hourlyRate * 1000) / 1000,
        monthlyRate,
      });
      withPricing++;
    }

    if (processed % 10 === 0) {
      console.log(`    Processed ${processed}/${profiles.length} profiles...`);
    }
  }

  console.log(`  Retrieved pricing for ${withPricing} Bare Metal profiles`);
  return pricing;
}

// Update the config with new pricing
function updateConfigWithPricing(
  existingConfig: any,
  vsiPricing: Map<string, { hourlyRate: number; monthlyRate: number }>,
  bareMetalPricing: Map<string, { hourlyRate: number; monthlyRate: number }>
): any {
  const newConfig = { ...existingConfig };

  // Update VSI pricing section
  const newVsiPricing: Record<string, { hourlyRate: number; monthlyRate: number }> = {};

  // Keep existing pricing for profiles we didn't fetch
  if (existingConfig.vsiPricing) {
    Object.assign(newVsiPricing, existingConfig.vsiPricing);
  }

  // Overlay new pricing
  for (const [name, pricing] of vsiPricing) {
    newVsiPricing[name] = pricing;
  }

  newConfig.vsiPricing = newVsiPricing;

  // Update bare metal pricing section
  const newBareMetalPricing: Record<string, { hourlyRate: number; monthlyRate: number }> = {};

  // Keep existing pricing for profiles we didn't fetch
  if (existingConfig.bareMetalPricing) {
    Object.assign(newBareMetalPricing, existingConfig.bareMetalPricing);
  }

  // Overlay new pricing
  for (const [name, pricing] of bareMetalPricing) {
    newBareMetalPricing[name] = pricing;
  }

  newConfig.bareMetalPricing = newBareMetalPricing;

  // Also update pricing in vsiProfiles array if present
  if (newConfig.vsiProfiles) {
    for (const family of Object.keys(newConfig.vsiProfiles)) {
      for (const profile of newConfig.vsiProfiles[family]) {
        const pricing = vsiPricing.get(profile.name);
        if (pricing) {
          profile.hourlyRate = pricing.hourlyRate;
          profile.monthlyRate = pricing.monthlyRate;
        }
      }
    }
  }

  // Also update pricing in bareMetalProfiles array if present
  if (newConfig.bareMetalProfiles) {
    for (const family of Object.keys(newConfig.bareMetalProfiles)) {
      for (const profile of newConfig.bareMetalProfiles[family]) {
        const pricing = bareMetalPricing.get(profile.name);
        if (pricing) {
          profile.hourlyRate = pricing.hourlyRate;
          profile.monthlyRate = pricing.monthlyRate;
        }
      }
    }
  }

  // Update version
  newConfig.version = new Date().toISOString().split('T')[0];

  return newConfig;
}

// Main function
async function main() {
  console.log('='.repeat(60));
  console.log('IBM Cloud Pricing Update Script');
  console.log('='.repeat(60));
  console.log('');

  // Get API key
  const apiKey = getApiKey();

  // Load existing config
  console.log('Loading existing configuration...');
  let existingConfig: any = {};
  try {
    const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
    existingConfig = JSON.parse(content);
    console.log(`  Loaded ${CONFIG_PATH}`);
  } catch (err) {
    console.error('  Error: Could not load existing config');
    console.error('  Run "npm run update-profiles" first to create the config file');
    process.exit(1);
  }

  try {
    // Get IAM token
    console.log('');
    console.log('Step 1: Authentication');
    const token = await getIamToken(apiKey);

    // Fetch pricing
    console.log('');
    console.log('Step 2: Fetching pricing from Global Catalog');

    const [vsiPricing, bareMetalPricing] = await Promise.all([
      fetchVSIPricing(token),
      fetchBareMetalPricing(token),
    ]);

    // Update config
    console.log('');
    console.log('Step 3: Updating configuration');

    const newConfig = updateConfigWithPricing(existingConfig, vsiPricing, bareMetalPricing);

    // Write new config
    console.log('');
    console.log('Step 4: Writing updated configuration');

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2) + '\n');
    console.log(`  Written to ${CONFIG_PATH}`);

    // Summary
    console.log('');
    console.log('='.repeat(60));
    console.log('Update complete!');
    console.log('='.repeat(60));
    console.log('');
    console.log('Summary:');
    console.log(`  - VSI pricing updated: ${vsiPricing.size} profiles`);
    console.log(`  - Bare Metal pricing updated: ${bareMetalPricing.size} profiles`);
    console.log(`  - Config version: ${newConfig.version}`);
    console.log('');
    console.log('Note: Pricing is fetched for us-south region.');
    console.log('Regional multipliers are applied at runtime for other regions.');

  } catch (error) {
    console.error('');
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
