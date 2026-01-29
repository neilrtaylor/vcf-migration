# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Clarification and Planning

- If requirements are ambiguous or incomplete, STOP and ask clarifying questions
- When multiple valid solutions exist, present 2-3 options with tradeoffs and ask for preference
- After gathering requirements, propose a plan before coding
- Start with the simplest solution; ask before adding sophistication

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

## Testing Requirements

- Always run existing tests before making changes to establish baseline
- Write or update tests before implementing new features
- Run tests after each significant change; fix failures immediately
- All new functions must have tests; bug fixes must include regression tests
- Test both happy paths and error conditions/edge cases
- After completing a feature, run the full test suite

## UI Testing

- Test UI changes in Chrome, not just by reading code
- Verify responsive behavior, user interactions, console errors
- Start dev server → navigate to page → test feature → check console → verify responsive layout
- Open Chrome: `open -a "Google Chrome" http://localhost:5173`

## Documentation

Document all changes in CLAUDE.md and README.md. If adding new technologies, update TECHNOLOGIES.md. If changes impact the user, update in-app documentation. Add changes to `src/data/changelog.json`. Only update the version if requested.

User Guide: `docs/USER_GUIDE.md` and in-app at `/user-guide` route (`src/pages/UserGuidePage.tsx`).

## Architecture Overview

React 18 + TypeScript + Vite application for VMware Cloud Foundation migration planning. Analyzes RVTools Excel exports and provides migration assessments for IBM Cloud ROKS (OpenShift) and VPC VSI targets.

### Key Architectural Patterns

- **Data Flow**: RVTools Excel parsed client-side (SheetJS `xlsx`) → `DataContext` (React Context + useReducer) → all components. Types in `src/types/rvtools.ts`.
- **State Management**: `src/context/DataContext.tsx` (global state), `src/context/dataReducer.ts` (reducer), hooks in `src/hooks/` (complex logic).
- **VM Management**: `src/hooks/useVMOverrides.ts` (exclusions/overrides with localStorage), `src/utils/vmIdentifier.ts` (VM ID and environment fingerprinting).
- **IBM Cloud Integration**: `src/services/pricing/globalCatalogApi.ts` and `src/services/ibmCloudProfilesApi.ts` fetch via Code Engine proxies. Fallback to `src/data/ibmCloudConfig.json`.
- **Export Pipeline**: `src/services/export/` — `bomXlsxGenerator.ts` (ExcelJS), `pdfGenerator.ts` (jsPDF), `excelGenerator.ts`, `docxGenerator.ts`, `yamlGenerator.ts`.

### Key Directories

- `src/pages/` — Route components (main: `ROKSMigrationPage.tsx`, `VSIMigrationPage.tsx`)
- `src/components/` — By feature: `charts/`, `sizing/`, `pricing/`, `tables/`, `export/`
- `src/services/` — Business logic: cost estimation, pricing APIs, export generation
- `src/data/` — Static JSON: IBM Cloud config, MTV requirements, OS compatibility matrices
- `src/types/` — TypeScript interfaces for RVTools data, MTV types, analysis results

### Path Alias

`@/` maps to `src/` (configured in `vite.config.ts` and `tsconfig.app.json`).

### UI Framework

IBM Carbon Design System (`@carbon/react`) — all UI components follow Carbon patterns.

## Environment Variables

```bash
VITE_PRICING_PROXY_URL=...      # Code Engine pricing proxy URL
VITE_PROFILES_PROXY_URL=...     # Code Engine profiles proxy URL
VITE_AI_PROXY_URL=...           # Code Engine AI proxy URL (watsonx.ai)
VITE_AI_PROXY_API_KEY=...       # Shared secret for AI proxy authentication
```

Without proxy URLs, the app uses static data from `src/data/ibmCloudConfig.json`.

## Updating IBM Cloud Data

```bash
export IBM_CLOUD_API_KEY=your-api-key
npm run update-profiles  # VSI/bare metal specs, ROKS support detection
npm run update-pricing   # Hourly/monthly rates from Global Catalog
npm run update-all       # Both
```

- **Profile script** (`scripts/update-profiles.ts`): Fetches VPC instance/bare metal profiles and ROKS machine types, auto-detects ROKS support by matching bare metal profiles against ROKS flavors API.
- **Pricing script** (`scripts/update-pricing.ts`): Fetches pricing from Global Catalog, extracts hourly rates for us-south, calculates monthly (hourly × 730).
- **ROKS fallback**: When proxy returns no ROKS data, `useDynamicProfiles` hook falls back to static JSON `roksSupported` values.
- **Data source labels**: "Live API" (green) when proxy available or cached proxy data; "Cache" (gray) when using static data.

## Custom Bare Metal Profiles

Define custom profiles in `src/data/ibmCloudConfig.json` under `customBareMetalProfiles`. Required fields: `name`, `physicalCores`, `vcpus`, `memoryGiB`, `hasNvme`. Optional: `tag` (defaults to "Custom"), `roksSupported`, `hourlyRate`, `monthlyRate`, `useCase`, `description`. See the JSON file for full structure. Custom profiles are always static (never from proxy) and appear alongside standard profiles in the Sizing Calculator.

## OS Compatibility Data

Manually maintained in `src/data/ibmCloudOSCompatibility.json` (VPC VSI) and `src/data/redhatOSCompatibility.json` (ROKS). Update when IBM Cloud/Red Hat changes supported OS versions. The `patterns` array contains lowercase strings matched against RVTools "Guest OS" field (case-insensitive substring matching in `src/services/migration/osCompatibility.ts`).

## Virtualization Overhead

Configured in `src/data/virtualizationOverhead.json`. Overhead formula: **fixed + proportional** per VM.

| Type | Fixed (per VM) | Proportional |
|------|----------------|--------------|
| CPU | 0.27 vCPU | 3% of guest vCPUs |
| Memory | 378 MiB | 3% of guest RAM |
| Storage | N/A | 15% (user adjustable, 0-25%) |

The Sizing Calculator shows 4-segment breakdowns: VM requirements, Virt overhead, ODF reserved, System reserved. Reference page at `/overhead-reference`.

## AI Integration (watsonx.ai)

Optional AI features via Code Engine proxy → IBM watsonx.ai (Granite model).

### Key Files

| Directory | Purpose |
|-----------|---------|
| `functions/ai-proxy/` | Code Engine Express.js proxy |
| `src/services/ai/` | Client API, cache, context builder, types |
| `src/hooks/useAI*.ts` | React hooks for all AI features |
| `src/components/ai/` | UI components (panels, chat, status) |
| `src/services/ai/insightsInputBuilder.ts` | Builds InsightsInput for report AI integration |

### AI Features

| Feature | Endpoint | Hook |
|---------|----------|------|
| Classification | `/api/classify` | `useAIClassification` |
| Right-sizing | `/api/rightsizing` | `useAIRightsizing` |
| Insights | `/api/insights` | `useAIInsights` |
| Chat | `/api/chat` | `useAIChat` |
| Wave Suggestions | `/api/wave-suggestions` | `useAIWaveSuggestions` |
| Cost Optimization | `/api/cost-optimization` | `useAICostOptimization` |
| Remediation | `/api/remediation` | `useAIRemediation` |

### AI Behavior

- Disabled by default; users enable via Settings page (`/settings`, stored in `vcf-ai-settings` localStorage key)
- All hooks check `useAISettings().settings.enabled` before requests
- Only aggregated summaries sent (never VM names, IPs, or raw data)
- Reports (DOCX, PDF, Excel, BOM) include AI sections when enabled, with watsonx.ai disclaimer
- Fallback: Without proxy → components render nothing; proxy unavailable → rule-based logic; AI disabled → same as unconfigured
- Proxy auth: `X-API-Key` header; `/health` is unauthenticated
- Caching: Proxy 30min (in-memory), Client 24hr (localStorage)

## Version Management

Version sourced from `package.json`, injected via Vite `define` in `vite.config.ts`. Globals: `__APP_VERSION__`, `__APP_NAME__`, `__APP_DESCRIPTION__`, `__APP_AUTHOR__`, `__APP_LICENSE__`, `__BUILD_TIME__` (declared in `src/vite-env.d.ts`).

To update: change `package.json` version → add entry to `src/data/changelog.json` → rebuild. Changelog follows [Keep a Changelog](https://keepachangelog.com/) (sections: `added`, `changed`, `fixed`, `removed`, `deprecated`, `security`).

## Utilities

- **Retry**: `src/utils/retry.ts` — `withRetry()` with exponential backoff. Network/5xx errors retry; auth errors (401/403) fail immediately; AbortErrors not retried.
- **Logging**: `src/utils/logger.ts` — `createLogger(moduleName)`. Levels: error (failures), warn (recoverable), info (operations), debug (dev only). Also: `parseApiError()`, `getUserFriendlyMessage()`.
- **Validation**: `src/services/costEstimation.ts` — `validateROKSSizingInput()`, `validateVSISizingInput()`, `validateRegion()`, `validateDiscountType()`.

## VM Management

Three-tier exclusion model (priority order):
1. **User force-included** (`forceIncluded: true`) → INCLUDED regardless
2. **User manually excluded** (`excluded: true`) → EXCLUDED
3. **Auto-exclusion rule matches** → AUTO-EXCLUDED
4. **Default** → INCLUDED

### Auto-Exclusion

All rules configured in `src/data/workloadPatterns.json` under `autoExclusionRules` (no hardcoded logic). Two rule types:
- **Field rules**: Match VM properties (e.g., `template === true`, `powerState !== 'poweredOn'`)
- **Name patterns**: Match VM names with `contains`/`startsWith`/`endsWith`/`exact`/`regex`. Optional `excludePatterns` for exceptions.

### Key Files

| File | Purpose |
|------|---------|
| `src/utils/autoExclusion.ts` | Auto-exclusion logic |
| `src/hooks/useAutoExclusion.ts` | React hook for auto-exclusion |
| `src/hooks/useVMOverrides.ts` | VM overrides with localStorage (`vcf-vm-overrides`) |
| `src/components/discovery/DiscoveryVMTable.tsx` | Unified VM table |
| `src/utils/vmIdentifier.ts` | VM ID: `${name}::${uuid}` or `${name}::${dc}::${cluster}` |

### VM Overrides

Stored in localStorage (`vcf-vm-overrides`), version 2. Environment fingerprinting (`server::instanceUuid::clusters`) enables override reuse across exports from the same vCenter.

### Migration Page Integration

```typescript
const vms = allVmsRaw.filter(vm => {
  const vmId = getVMIdentifier(vm);
  const autoResult = getAutoExclusionById(vmId);
  return !vmOverrides.isEffectivelyExcluded(vmId, autoResult.isAutoExcluded);
});
```

## Discovery

Discovery page (`src/pages/DiscoveryPage.tsx`) has Workload and Networks tabs.

### Classification Precedence

1. **User override** (cyan `User` tag) — highest priority
2. **Maintainer authoritative** (teal `Maintainer` tag, from `authoritativeClassifications` in `workloadPatterns.json`) — AI cannot override
3. **AI classification** — overrides pattern matching when available
4. **Rule-based detection** — fallback pattern matching from `categories` in `workloadPatterns.json`

Classification and auto-exclusion are independent. Each VM has exactly one workload type (4-pass merge with dedup).

### Key Files

| File | Purpose |
|------|---------|
| `src/pages/DiscoveryPage.tsx` | Tabbed layout (Workload + Networks) |
| `src/components/discovery/DiscoveryVMTable.tsx` | Unified VM table |
| `src/components/network/NetworkSummaryTable.tsx` | Network table with editable subnets |
| `src/data/workloadPatterns.json` | Workload types, authoritative classifications, auto-exclusion rules |

## Subnet Management

Inline editing of subnet values for network port groups. Multi-CIDR support (comma-separated). Auto-guessing from VM IPs with "Guessed" tag. Stored in localStorage (`vcf-subnet-overrides`). Validation: `isValidCIDR()`, `isValidCIDRList()`, `parseCIDRList()` in `src/hooks/useSubnetOverrides.ts`.

## UI Layout Patterns

- **Equal-height tiles**: CSS Grid with `align-items: stretch` and `.cds--tile { height: 100% }`
- **Top-aligned tiles**: Flexbox with `align-items: flex-start`
- **Carbon Grid vertical spacing**: Use inline `style={{ marginBottom: '1rem' }}` on Column components (Carbon Grid doesn't auto-space rows)
- Carbon spacing: `spacing-05` = 1rem (16px), `spacing-07` = 2rem (32px)

## Reusable Components

- **FilterableVMTable** (`src/components/tables/FilterableVMTable.tsx`): VM table with ClickableTile filter bar, sorting, pagination. Props: `vms`, `filterKey`, `filterValue`, `filterOptions`, `onFilterChange`.
- **WaveVMTable** (`src/components/migration/WaveVMTable.tsx`): VMs by migration wave with wave selection tiles. Props: `waves`, `selectedWave`, `onWaveSelect`.