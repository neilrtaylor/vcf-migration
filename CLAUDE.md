# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev          # Start dev server at http://localhost:5173
npm run build        # TypeScript compile + Vite production build
npm run preview      # Preview production build locally
npm run lint         # ESLint
npm test             # Run tests with Vitest
npm run test:ui      # Run tests with UI
npm run test:coverage # Run tests with coverage
npm run update-profiles # Update IBM Cloud profiles from APIs (requires API key)
npm run update-pricing  # Update IBM Cloud pricing from Global Catalog (requires API key)
npm run update-all      # Update both profiles and pricing
```

## Architecture Overview

This is a React 18 + TypeScript + Vite application for VMware Cloud Foundation migration planning. It analyzes RVTools Excel exports and provides migration assessments for IBM Cloud ROKS (OpenShift) and VPC VSI targets.

### Key Architectural Patterns

**Data Flow:**
- RVTools Excel files are parsed client-side using SheetJS (`xlsx`)
- Parsed data flows through `DataContext` (React Context + useReducer) to all components
- Types defined in `src/types/rvtools.ts` model the RVTools sheet structure

**State Management:**
- `src/context/DataContext.tsx` - Global state for parsed RVTools data and analysis results
- `src/context/dataReducer.ts` - Reducer for state mutations
- Hooks in `src/hooks/` encapsulate complex logic (pricing, profiles, exports)

**IBM Cloud Integration:**
- `src/services/pricing/globalCatalogApi.ts` - Fetches live pricing from IBM Cloud Global Catalog
- `src/services/ibmCloudProfilesApi.ts` - Fetches VSI/bare metal profiles via VPC API
- Vite dev server proxies API calls to avoid CORS (see `vite.config.ts`)
- Fallback static data in `src/data/ibmCloudConfig.json` when API unavailable

**Export Pipeline:**
- `src/services/export/` contains generators for different formats:
  - `bomXlsxGenerator.ts` - Excel BOM with formulas (uses ExcelJS)
  - `pdfGenerator.ts` - PDF reports (uses jsPDF)
  - `excelGenerator.ts` - Analysis workbooks
  - `docxGenerator.ts` - Word documents
  - `yamlGenerator.ts` - MTV YAML configs

### Key Directories

- `src/pages/` - Route components. Main pages: `ROKSMigrationPage.tsx`, `VSIMigrationPage.tsx`
- `src/components/` - Organized by feature: `charts/`, `sizing/`, `pricing/`, `tables/`, `export/`
- `src/services/` - Business logic: cost estimation, pricing APIs, export generation
- `src/data/` - Static JSON: IBM Cloud config, MTV requirements, OS compatibility matrices
- `src/types/` - TypeScript interfaces for RVTools data, MTV types, analysis results

### Path Alias

`@/` maps to `src/` (configured in both `vite.config.ts` and `tsconfig.app.json`)

### UI Framework

IBM Carbon Design System (`@carbon/react`) - all UI components follow Carbon patterns.

## Environment Variables

```bash
VITE_IBM_CLOUD_API_KEY=...      # Optional: enables live pricing/profiles (exposes key in browser)
VITE_PRICING_PROXY_URL=...      # Optional: Code Engine pricing proxy URL (recommended)
VITE_PROFILES_PROXY_URL=...     # Optional: Code Engine profiles proxy URL (recommended)
```

Without API key, app uses static pricing from `src/data/ibmCloudConfig.json`.

## Updating IBM Cloud Data

The static fallback data in `src/data/ibmCloudConfig.json` can be updated with fresh data from IBM Cloud APIs.

### Update Scripts

```bash
# Set your IBM Cloud API key
export IBM_CLOUD_API_KEY=your-api-key

# Update profiles only (VSI specs, bare metal specs, ROKS support)
npm run update-profiles

# Update pricing only (hourly/monthly rates from Global Catalog)
npm run update-pricing

# Update both profiles and pricing
npm run update-all
```

### Profile Update Script (`scripts/update-profiles.ts`)

1. Authenticates with IBM Cloud IAM
2. Fetches VPC instance profiles from `GET /v1/instance/profiles`
3. Fetches VPC bare metal profiles from `GET /v1/bare_metal_server/profiles`
4. Fetches ROKS machine types from `GET /v2/getFlavors?provider=vpc-gen2`
5. **Auto-detects ROKS support** by matching bare metal profiles against ROKS machine types
6. Preserves existing pricing data (blockStorage, networking, regions, discounts, etc.)
7. Updates `src/data/ibmCloudConfig.json`

#### ROKS Support Detection

The script automatically determines which bare metal profiles support ROKS worker nodes:

```typescript
// Profiles returned by the Kubernetes Service API are ROKS-supported
const roksTypes = await fetch('/v2/getFlavors?zone=us-south-1&provider=vpc-gen2');

// Each bare metal profile is checked against this list
for (const profile of bareMetalProfiles) {
  profile.roksSupported = roksTypes.has(profile.name);
}
```

This data is used in the UI to show "ROKS" or "VPC Only" tags on bare metal profile cards.

### Pricing Update Script (`scripts/update-pricing.ts`)

1. Authenticates with IBM Cloud IAM
2. Fetches VSI pricing from Global Catalog API
3. Fetches Bare Metal pricing from Global Catalog API
4. Extracts hourly rates for us-south region
5. Calculates monthly rates (hourly × 730 hours)
6. Updates pricing in `src/data/ibmCloudConfig.json`
7. Preserves all other configuration (storage, networking, regions, etc.)

### Dynamic vs Static Data

- **Runtime (dynamic)**: The app fetches live profiles via `useDynamicProfiles()` hook when an API key is configured
- **Fallback (static)**: When API is unavailable, the app uses `src/data/ibmCloudConfig.json`
- **Update scripts**: Keep the static fallback data current for offline use or when APIs are unavailable

### Debugging Profile Data

Open browser DevTools Console to see detailed profile logs:
- `[IBM Cloud API] Bare Metal Profiles Summary` - Raw API data
- `[IBM Cloud API] ROKS Bare Metal Flavors` - ROKS machine types
- `[Dynamic Profiles] FINAL Bare Metal Profiles in App` - Merged profiles used by the app

## Utilities

### Retry Logic (`src/utils/retry.ts`)

Provides exponential backoff retry for API calls:

```typescript
import { withRetry, isRetryableError } from '@/utils/retry';

// Basic usage
const data = await withRetry(() => fetchFromApi('/endpoint'), {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffFactor: 2,
});

// With custom retry conditions and callbacks
const result = await withRetry(fetchData, {
  retryableErrors: (error) => !error.message.includes('401'), // Don't retry auth errors
  onRetry: (error, attempt, delayMs) => {
    console.log(`Retry ${attempt} after ${delayMs}ms: ${error.message}`);
  },
});
```

### Logging (`src/utils/logger.ts`)

Standardized logging with module context:

```typescript
import { createLogger, parseApiError, getUserFriendlyMessage } from '@/utils/logger';

const logger = createLogger('MyModule');

logger.debug('Debug message', { context: 'value' });  // Only in dev
logger.info('Info message');
logger.warn('Warning message', { details: '...' });
logger.error('Error occurred', error, { operation: 'fetch' });

// Parse API errors for better messages
if (!response.ok) {
  const apiError = await parseApiError(response, 'Fetch profiles');
  throw new Error(apiError.message);
}

// Get user-friendly error messages
catch (error) {
  const message = getUserFriendlyMessage(error); // Handles CORS, auth, timeout, etc.
}
```

### Input Validation (`src/services/costEstimation.ts`)

Validation functions for cost estimation inputs:

```typescript
import {
  validateROKSSizingInput,
  validateVSISizingInput,
  validateRegion,
  validateDiscountType
} from '@/services/costEstimation';

const result = validateROKSSizingInput(input);
if (!result.valid) {
  console.error('Validation errors:', result.errors);
  // errors: [{ field: 'computeNodes', message: 'Must be non-negative integer' }]
}
```

## Error Handling Patterns

### API Calls

All IBM Cloud API calls use retry logic with exponential backoff:
- Network errors, timeouts, and 5xx errors trigger retries
- Auth errors (401/403) fail immediately without retry
- CORS errors are detected and reported with helpful suggestions

### Silent Failure Prevention

API functions return error details alongside data:

```typescript
// fetchAllCatalogPricing returns:
{
  vsi: [...],
  bareMetal: [...],
  blockStorage: [...],
  errors: { vsi?: string, bareMetal?: string, blockStorage?: string },
  hasErrors: boolean
}

// testApiConnection returns:
{ success: boolean, error?: string }
```

### Logging Standards

- Use `createLogger(moduleName)` for consistent log formatting
- `logger.error()` for failures that affect functionality
- `logger.warn()` for recoverable issues or fallbacks
- `logger.info()` for significant operations (API calls, cache updates)
- `logger.debug()` for detailed tracing (only shows in development)
