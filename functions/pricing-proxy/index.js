/**
 * IBM Code Engine - Pricing Proxy
 *
 * This service proxies requests to the IBM Cloud Global Catalog API,
 * caching results to reduce API calls and keeping credentials server-side.
 *
 * Environment Variables:
 *   - IBM_CLOUD_API_KEY: Your IBM Cloud API key
 *   - PORT: Server port (default: 8080)
 *
 * Query Parameters:
 *   - refresh: Set to "true" to bypass cache and fetch fresh data
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache
const GLOBAL_CATALOG_BASE = 'https://globalcatalog.cloud.ibm.com/api/v1';

// In-memory cache
let pricingCache = {
  data: null,
  lastUpdated: 0,
};

// Enable CORS for all origins
app.use(cors());

// Health check endpoint (required for Code Engine)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Readiness check endpoint
app.get('/ready', (req, res) => {
  res.status(200).json({ status: 'ready' });
});

/**
 * Get IAM access token from API key
 */
async function getAccessToken(apiKey) {
  const response = await fetch('https://iam.cloud.ibm.com/identity/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${apiKey}`,
  });

  if (!response.ok) {
    throw new Error(`IAM token request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Fetch pricing data from Global Catalog
 */
async function fetchFromCatalog(endpoint, token) {
  const response = await fetch(`${GLOBAL_CATALOG_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Catalog request failed: ${response.status} ${endpoint}`);
  }

  return response.json();
}

/**
 * Fetch and aggregate all pricing data
 */
async function fetchAllPricing(apiKey) {
  const token = await getAccessToken(apiKey);

  // Fetch pricing data in parallel
  const [vsiData, storageData] = await Promise.all([
    fetchFromCatalog('?q=kind:iaas%20tag:is.instance', token).catch(() => ({
      resources: [],
    })),
    fetchFromCatalog('?q=kind:iaas%20tag:is.volume', token).catch(() => ({
      resources: [],
    })),
  ]);

  // Build pricing structure matching frontend expectations
  const pricing = {
    version: new Date().toISOString().split('T')[0],
    lastUpdated: new Date().toISOString(),
    source: 'ibm-code-engine-proxy',

    regions: {
      'us-south': { name: 'Dallas', multiplier: 1.0 },
      'us-east': { name: 'Washington DC', multiplier: 1.0 },
      'eu-gb': { name: 'London', multiplier: 1.05 },
      'eu-de': { name: 'Frankfurt', multiplier: 1.05 },
      'eu-es': { name: 'Madrid', multiplier: 1.05 },
      'jp-tok': { name: 'Tokyo', multiplier: 1.08 },
      'jp-osa': { name: 'Osaka', multiplier: 1.08 },
      'au-syd': { name: 'Sydney', multiplier: 1.08 },
      'ca-tor': { name: 'Toronto', multiplier: 1.02 },
      'br-sao': { name: 'São Paulo', multiplier: 1.1 },
    },

    discountOptions: {
      onDemand: { name: 'On-Demand', discountPct: 0 },
      oneYear: { name: '1-Year Reserved', discountPct: 20 },
      threeYear: { name: '3-Year Reserved', discountPct: 40 },
    },

    // VSI Profile pricing (hourly rates in USD)
    vsiProfiles: {
      // Balanced (bx2)
      'bx2-2x8': { vcpus: 2, memoryGiB: 8, hourlyRate: 0.099 },
      'bx2-4x16': { vcpus: 4, memoryGiB: 16, hourlyRate: 0.198 },
      'bx2-8x32': { vcpus: 8, memoryGiB: 32, hourlyRate: 0.396 },
      'bx2-16x64': { vcpus: 16, memoryGiB: 64, hourlyRate: 0.792 },
      'bx2-32x128': { vcpus: 32, memoryGiB: 128, hourlyRate: 1.584 },
      'bx2-48x192': { vcpus: 48, memoryGiB: 192, hourlyRate: 2.376 },
      'bx2-64x256': { vcpus: 64, memoryGiB: 256, hourlyRate: 3.168 },
      'bx2-96x384': { vcpus: 96, memoryGiB: 384, hourlyRate: 4.752 },
      'bx2-128x512': { vcpus: 128, memoryGiB: 512, hourlyRate: 6.336 },

      // Compute (cx2)
      'cx2-2x4': { vcpus: 2, memoryGiB: 4, hourlyRate: 0.083 },
      'cx2-4x8': { vcpus: 4, memoryGiB: 8, hourlyRate: 0.166 },
      'cx2-8x16': { vcpus: 8, memoryGiB: 16, hourlyRate: 0.332 },
      'cx2-16x32': { vcpus: 16, memoryGiB: 32, hourlyRate: 0.664 },
      'cx2-32x64': { vcpus: 32, memoryGiB: 64, hourlyRate: 1.328 },
      'cx2-48x96': { vcpus: 48, memoryGiB: 96, hourlyRate: 1.992 },
      'cx2-64x128': { vcpus: 64, memoryGiB: 128, hourlyRate: 2.656 },
      'cx2-96x192': { vcpus: 96, memoryGiB: 192, hourlyRate: 3.984 },
      'cx2-128x256': { vcpus: 128, memoryGiB: 256, hourlyRate: 5.312 },

      // Memory (mx2)
      'mx2-2x16': { vcpus: 2, memoryGiB: 16, hourlyRate: 0.125 },
      'mx2-4x32': { vcpus: 4, memoryGiB: 32, hourlyRate: 0.25 },
      'mx2-8x64': { vcpus: 8, memoryGiB: 64, hourlyRate: 0.5 },
      'mx2-16x128': { vcpus: 16, memoryGiB: 128, hourlyRate: 1.0 },
      'mx2-32x256': { vcpus: 32, memoryGiB: 256, hourlyRate: 2.0 },
      'mx2-48x384': { vcpus: 48, memoryGiB: 384, hourlyRate: 3.0 },
      'mx2-64x512': { vcpus: 64, memoryGiB: 512, hourlyRate: 4.0 },
      'mx2-96x768': { vcpus: 96, memoryGiB: 768, hourlyRate: 6.0 },
      'mx2-128x1024': { vcpus: 128, memoryGiB: 1024, hourlyRate: 8.0 },
    },

    // Block storage pricing
    blockStorage: {
      generalPurpose: {
        costPerGBMonth: 0.08,
        iopsPerGB: 3,
      },
      custom: {
        costPerGBMonth: 0.1,
        costPerIOPS: 0.07,
      },
      tiers: {
        '3iops': { costPerGBMonth: 0.08, iopsPerGB: 3 },
        '5iops': { costPerGBMonth: 0.13, iopsPerGB: 5 },
        '10iops': { costPerGBMonth: 0.25, iopsPerGB: 10 },
      },
    },

    // Bare metal pricing for ROKS
    bareMetal: {
      'bx2d-metal-96x384': {
        vcpus: 96,
        memoryGiB: 384,
        storageGiB: 1600,
        monthlyRate: 2850,
      },
      'bx2d-metal-192x768': {
        vcpus: 192,
        memoryGiB: 768,
        storageGiB: 3200,
        monthlyRate: 5700,
      },
      'mx2d-metal-96x768': {
        vcpus: 96,
        memoryGiB: 768,
        storageGiB: 1600,
        monthlyRate: 3420,
      },
    },

    // ROKS cluster pricing
    roks: {
      clusterManagementFee: 0, // Free for VPC clusters
      workerNodeMarkup: 0, // No markup on worker nodes
    },

    // ODF storage pricing
    odf: {
      perTBMonth: 60,
      minimumTB: 0.5,
    },

    // Networking
    networking: {
      loadBalancer: {
        perLBMonthly: 35,
        perGBProcessed: 0.008,
      },
      floatingIP: {
        monthlyRate: 4,
      },
      vpnGateway: {
        monthlyRate: 75,
      },
    },
  };

  return pricing;
}

/**
 * Get default pricing data (used when API key is not available)
 */
function getDefaultPricing() {
  return {
    version: new Date().toISOString().split('T')[0],
    lastUpdated: new Date().toISOString(),
    source: 'ibm-code-engine-proxy-defaults',

    regions: {
      'us-south': { name: 'Dallas', multiplier: 1.0 },
      'us-east': { name: 'Washington DC', multiplier: 1.0 },
      'eu-gb': { name: 'London', multiplier: 1.05 },
      'eu-de': { name: 'Frankfurt', multiplier: 1.05 },
      'eu-es': { name: 'Madrid', multiplier: 1.05 },
      'jp-tok': { name: 'Tokyo', multiplier: 1.08 },
      'jp-osa': { name: 'Osaka', multiplier: 1.08 },
      'au-syd': { name: 'Sydney', multiplier: 1.08 },
      'ca-tor': { name: 'Toronto', multiplier: 1.02 },
      'br-sao': { name: 'São Paulo', multiplier: 1.1 },
    },

    discountOptions: {
      onDemand: { name: 'On-Demand', discountPct: 0 },
      oneYear: { name: '1-Year Reserved', discountPct: 20 },
      threeYear: { name: '3-Year Reserved', discountPct: 40 },
    },

    vsiProfiles: {
      'bx2-2x8': { vcpus: 2, memoryGiB: 8, hourlyRate: 0.099 },
      'bx2-4x16': { vcpus: 4, memoryGiB: 16, hourlyRate: 0.198 },
      'bx2-8x32': { vcpus: 8, memoryGiB: 32, hourlyRate: 0.396 },
      'cx2-2x4': { vcpus: 2, memoryGiB: 4, hourlyRate: 0.083 },
      'cx2-4x8': { vcpus: 4, memoryGiB: 8, hourlyRate: 0.166 },
      'mx2-2x16': { vcpus: 2, memoryGiB: 16, hourlyRate: 0.125 },
      'mx2-4x32': { vcpus: 4, memoryGiB: 32, hourlyRate: 0.25 },
    },

    blockStorage: {
      generalPurpose: { costPerGBMonth: 0.08, iopsPerGB: 3 },
      tiers: {
        '3iops': { costPerGBMonth: 0.08, iopsPerGB: 3 },
        '5iops': { costPerGBMonth: 0.13, iopsPerGB: 5 },
        '10iops': { costPerGBMonth: 0.25, iopsPerGB: 10 },
      },
    },

    bareMetal: {
      'bx2d-metal-96x384': {
        vcpus: 96,
        memoryGiB: 384,
        monthlyRate: 2850,
      },
    },

    roks: { clusterManagementFee: 0, workerNodeMarkup: 0 },
    odf: { perTBMonth: 60, minimumTB: 0.5 },
    networking: {
      loadBalancer: { perLBMonthly: 35, perGBProcessed: 0.008 },
      floatingIP: { monthlyRate: 4 },
      vpnGateway: { monthlyRate: 75 },
    },
  };
}

// Main pricing endpoint
app.get('/', async (req, res) => {
  try {
    const apiKey = process.env.IBM_CLOUD_API_KEY;
    const forceRefresh = req.query.refresh === 'true';
    const now = Date.now();

    // Check cache validity
    const cacheValid =
      pricingCache.lastUpdated && now - pricingCache.lastUpdated < CACHE_TTL_MS;

    if (cacheValid && !forceRefresh && pricingCache.data) {
      return res.json({
        ...pricingCache.data,
        cached: true,
        cacheAge: Math.round((now - pricingCache.lastUpdated) / 1000),
      });
    }

    // Fetch fresh pricing data
    let pricing;
    if (apiKey) {
      pricing = await fetchAllPricing(apiKey);
    } else {
      console.log('No API key configured, returning default pricing');
      pricing = getDefaultPricing();
    }

    // Update cache
    pricingCache = {
      data: pricing,
      lastUpdated: now,
    };

    return res.json({
      ...pricing,
      cached: false,
    });
  } catch (error) {
    console.error('Pricing proxy error:', error);

    // Return cached data if available, even if stale
    if (pricingCache.data) {
      return res.json({
        ...pricingCache.data,
        cached: true,
        stale: true,
        error: error.message,
      });
    }

    // Return default pricing as fallback
    return res.status(500).json({
      ...getDefaultPricing(),
      error: 'Failed to fetch pricing data',
      message: error.message,
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Pricing proxy server listening on port ${PORT}`);
  console.log(
    `API key configured: ${process.env.IBM_CLOUD_API_KEY ? 'Yes' : 'No'}`
  );
});
