/**
 * IBM Code Engine - Profiles Proxy
 *
 * This service proxies requests to IBM Cloud VPC and ROKS APIs,
 * caching results to reduce API calls and keeping credentials server-side.
 *
 * Environment Variables:
 *   - IBM_CLOUD_API_KEY: Your IBM Cloud API key (required)
 *   - PORT: Server port (default: 8080)
 *
 * Query Parameters:
 *   - refresh: Set to "true" to bypass cache and fetch fresh data
 *   - region: IBM Cloud region (default: us-south)
 *   - zone: Availability zone for ROKS (default: us-south-1)
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache
const VPC_API_VERSION = '2024-01-01';

// API endpoints
const IAM_TOKEN_URL = 'https://iam.cloud.ibm.com/identity/token';
const VPC_API_BASE = 'https://{region}.iaas.cloud.ibm.com/v1';
const ROKS_API_BASE = 'https://containers.cloud.ibm.com';

// In-memory cache
let profilesCache = {
  data: null,
  lastUpdated: 0,
};

// Token cache
let tokenCache = {
  token: null,
  expiresAt: 0,
};

// Enable CORS for all origins
app.use(cors());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Readiness check endpoint
app.get('/ready', (req, res) => {
  res.status(200).json({ status: 'ready' });
});

/**
 * Get IAM access token from API key (with caching)
 */
async function getAccessToken(apiKey) {
  const now = Date.now();

  // Return cached token if still valid (with 5 min buffer)
  if (tokenCache.token && tokenCache.expiresAt > now + 5 * 60 * 1000) {
    return tokenCache.token;
  }

  const response = await fetch(IAM_TOKEN_URL, {
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

  // Cache token (expires_in is in seconds)
  tokenCache = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return data.access_token;
}

/**
 * Fetch VPC instance profiles
 */
async function fetchVPCInstanceProfiles(token, region) {
  const url = `${VPC_API_BASE.replace('{region}', region)}/instance/profiles?version=${VPC_API_VERSION}&generation=2`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    console.error(`VPC Instance Profiles API failed: ${response.status}`);
    return [];
  }

  const data = await response.json();
  return data.profiles || [];
}

/**
 * Fetch VPC bare metal profiles
 */
async function fetchVPCBareMetalProfiles(token, region) {
  const url = `${VPC_API_BASE.replace('{region}', region)}/bare_metal_server/profiles?version=${VPC_API_VERSION}&generation=2`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    console.error(`VPC Bare Metal Profiles API failed: ${response.status}`);
    return [];
  }

  const data = await response.json();
  return data.profiles || [];
}

/**
 * Fetch ROKS machine types (flavors)
 */
async function fetchROKSMachineTypes(token, zone) {
  const url = `${ROKS_API_BASE}/v2/getFlavors?zone=${zone}&provider=vpc-gen2`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    console.error(`ROKS Flavors API failed: ${response.status}`);
    return [];
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Transform VPC instance profile to simplified format
 */
function transformVSIProfile(profile) {
  return {
    name: profile.name,
    family: profile.family || extractFamily(profile.name),
    vcpus: profile.vcpu_count?.value || profile.vcpu_count || 0,
    memoryGiB: profile.memory?.value || profile.memory || 0,
    bandwidthMbps: profile.bandwidth?.value || 0,
    bandwidthGbps: (profile.bandwidth?.value || 0) / 1000,
    architecture: profile.vcpu_architecture?.value || 'amd64',
    status: profile.status || 'current',
  };
}

/**
 * Transform VPC bare metal profile to simplified format
 */
function transformBareMetalProfile(profile, roksSupported) {
  const disks = profile.disks || [];
  const nvmeDisks = disks.filter(
    (d) => d.interface_type?.value === 'nvme' || d.interface_type === 'nvme'
  );

  return {
    name: profile.name,
    family: profile.family || extractFamily(profile.name),
    vcpus: profile.cpu_core_count?.value || profile.cpu_core_count || 0,
    physicalCores:
      profile.cpu_socket_count?.value * profile.cpu_core_count?.value ||
      profile.cpu_core_count?.value ||
      0,
    memoryGiB: profile.memory?.value || profile.memory || 0,
    bandwidthMbps: profile.bandwidth?.value || 0,
    bandwidthGbps: (profile.bandwidth?.value || 0) / 1000,
    hasNvme: nvmeDisks.length > 0,
    nvmeDisks: nvmeDisks.length,
    nvmeSizeGiB: nvmeDisks[0]?.size?.value || 0,
    totalNvmeGiB: nvmeDisks.reduce((sum, d) => sum + (d.size?.value || 0), 0),
    roksSupported: roksSupported,
    status: profile.status || 'current',
  };
}

/**
 * Extract family from profile name (e.g., "bx2-2x8" -> "bx2")
 */
function extractFamily(name) {
  const match = name.match(/^([a-z]+\d+[a-z]*)/);
  return match ? match[1] : 'unknown';
}

/**
 * Fetch all profile data
 */
async function fetchAllProfiles(apiKey, region, zone) {
  const token = await getAccessToken(apiKey);

  // Fetch all profile types in parallel
  const [vsiProfiles, bareMetalProfiles, roksFlavors] = await Promise.all([
    fetchVPCInstanceProfiles(token, region).catch((err) => {
      console.error('VSI profiles fetch error:', err.message);
      return [];
    }),
    fetchVPCBareMetalProfiles(token, region).catch((err) => {
      console.error('Bare metal profiles fetch error:', err.message);
      return [];
    }),
    fetchROKSMachineTypes(token, zone).catch((err) => {
      console.error('ROKS flavors fetch error:', err.message);
      return [];
    }),
  ]);

  // Build set of ROKS-supported bare metal profiles
  const roksProfileNames = new Set(
    roksFlavors
      .filter((f) => f.serverType === 'bare_metal' || f.isolation === 'dedicated')
      .map((f) => f.name)
  );

  // Transform profiles
  const vsi = vsiProfiles.map(transformVSIProfile);
  const bareMetal = bareMetalProfiles.map((p) =>
    transformBareMetalProfile(p, roksProfileNames.has(p.name))
  );

  // Group ROKS flavors by type
  const roksVSI = roksFlavors.filter(
    (f) => f.serverType === 'virtual' || f.isolation === 'shared'
  );
  const roksBM = roksFlavors.filter(
    (f) => f.serverType === 'bare_metal' || f.isolation === 'dedicated'
  );

  return {
    version: new Date().toISOString().split('T')[0],
    lastUpdated: new Date().toISOString(),
    source: 'ibm-code-engine-profiles-proxy',
    region,
    zone,

    vsiProfiles: vsi,
    bareMetalProfiles: bareMetal,

    // Raw ROKS data for reference
    roksFlavors: {
      vsi: roksVSI.length,
      bareMetal: roksBM.length,
    },

    counts: {
      vsi: vsi.length,
      bareMetal: bareMetal.length,
      roksVSI: roksVSI.length,
      roksBM: roksBM.length,
    },
  };
}

/**
 * Get default/empty profile response
 */
function getEmptyProfiles(region, zone, error) {
  return {
    version: new Date().toISOString().split('T')[0],
    lastUpdated: new Date().toISOString(),
    source: 'ibm-code-engine-profiles-proxy-empty',
    region,
    zone,
    vsiProfiles: [],
    bareMetalProfiles: [],
    roksFlavors: { vsi: 0, bareMetal: 0 },
    counts: { vsi: 0, bareMetal: 0, roksVSI: 0, roksBM: 0 },
    error: error || 'No API key configured',
  };
}

// Main profiles endpoint
app.get('/', async (req, res) => {
  try {
    const apiKey = process.env.IBM_CLOUD_API_KEY;
    const forceRefresh = req.query.refresh === 'true';
    const region = req.query.region || 'us-south';
    const zone = req.query.zone || `${region}-1`;
    const now = Date.now();

    if (!apiKey) {
      console.log('No API key configured, returning empty profiles');
      return res.json(getEmptyProfiles(region, zone));
    }

    // Check cache validity (cache key includes region/zone)
    const cacheKey = `${region}:${zone}`;
    const cacheValid =
      profilesCache.data &&
      profilesCache.key === cacheKey &&
      profilesCache.lastUpdated &&
      now - profilesCache.lastUpdated < CACHE_TTL_MS;

    if (cacheValid && !forceRefresh) {
      return res.json({
        ...profilesCache.data,
        cached: true,
        cacheAge: Math.round((now - profilesCache.lastUpdated) / 1000),
      });
    }

    // Fetch fresh profile data
    console.log(`Fetching profiles for ${region}/${zone}...`);
    const profiles = await fetchAllProfiles(apiKey, region, zone);

    // Update cache
    profilesCache = {
      data: profiles,
      key: cacheKey,
      lastUpdated: now,
    };

    return res.json({
      ...profiles,
      cached: false,
    });
  } catch (error) {
    console.error('Profiles proxy error:', error);

    // Return cached data if available, even if stale
    if (profilesCache.data) {
      return res.json({
        ...profilesCache.data,
        cached: true,
        stale: true,
        error: error.message,
      });
    }

    const region = req.query.region || 'us-south';
    const zone = req.query.zone || `${region}-1`;

    return res.status(500).json({
      ...getEmptyProfiles(region, zone, error.message),
      error: 'Failed to fetch profile data',
      message: error.message,
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Profiles proxy server listening on port ${PORT}`);
  console.log(
    `API key configured: ${process.env.IBM_CLOUD_API_KEY ? 'Yes' : 'No'}`
  );
});
