# VCF Migration

A modern **React + TypeScript + Vite** web application to support VMware Cloud Foundation (VCF) migration workflows — planning, analysis, cost estimation, and reporting for migration to **IBM Cloud Red Hat OpenShift (ROKS)** and/or **IBM Cloud Virtual Private Cloud (VPC) Virtual Server Instances (VSI)**.

This project provides an interactive interface for analyzing VMware environments, assessing migration readiness, estimating costs, and generating comprehensive reports and Bills of Materials (BOMs).

---

# For Users

This section covers how to use the VCF Migration application for migration planning and analysis.

## Key Features

### Data Import & Analysis
- **RVTools Import** — Parse and analyze RVTools Excel exports (vInfo, vCPU, vMemory, vDisk, vNetwork, vHost, vDatastore tabs)
- **Environment Overview** — Dashboard with VM counts, resource utilization, and health metrics
- **Inventory Visualization** — Interactive charts and tables for exploring your VMware environment

### Migration Targets

#### ROKS (Red Hat OpenShift on IBM Cloud)
- **MTV Compatibility Analysis** — Pre-flight checks against Migration Toolkit for Virtualization requirements
- **OS Compatibility Matrix** — Red Hat OS support validation with detailed compatibility status
- **Bare Metal Sizing** — Automatic calculation of required bare metal nodes for OpenShift Virtualization
- **ODF Storage Planning** — OpenData Foundation storage requirements with NVMe recommendations
- **ROKS Sizing Calculator** — Interactive calculator for cluster sizing with three storage calculation methods:
  - **Disk Capacity** — Full disk size from vDisk inventory (use when VMs may grow to full capacity)
  - **In Use (recommended)** — Actual consumed storage including snapshots
  - **Provisioned** — Allocated capacity including thin-provisioned promises (most conservative)
- **Custom Bare Metal Profiles** — Define custom (e.g., future) bare metal profiles in `ibmCloudConfig.json` for ROKS sizing alongside standard IBM Cloud profiles

#### VPC VSI (Virtual Server Instances)
- **VSI Profile Mapping** — Automatic mapping of VMs to appropriate IBM Cloud VSI profiles
- **Profile Family Selection** — Support for Balanced (bx2), Compute (cx2), and Memory (mx2) families
- **OS Support Analysis** — IBM Cloud VPC supported operating system validation

### Cost Estimation
- **Dynamic Pricing** — Real-time pricing from IBM Cloud Global Catalog API
- **Regional Pricing** — Support for all IBM Cloud regions with regional multipliers
- **Discount Options** — On-Demand, 1-Year Reserved, and 3-Year Reserved pricing
- **Cost Breakdown** — Detailed line-item costs for compute, storage, and networking
- **Monthly/Annual Projections** — Cost forecasting for budget planning
- **Custom Profiles** — Override auto-mapped VSI profiles or define custom profiles with specific vCPUs, memory, and pricing

### Export & Reporting

#### Bill of Materials (BOM) Export
- **Excel BOM with Formulas** — Detailed spreadsheet with:
  - VPC/Cluster summary with regional pricing
  - Per-VM/node cost breakdown with formulas (Unit Price × Quantity)
  - Boot and data volume costs referencing storage cost per GB
  - Section totals with SUM formulas
  - Color-coded headers and styling for easy reading
- **VM Details Sheet** — Complete inventory with profile mapping and costs
- **Summary Sheet** — Configuration overview and cost summary

#### Additional Export Formats
- **PDF Reports** — Professional migration assessment reports with charts
- **Excel Workbooks** — Multi-sheet analysis with VM mapping and recommendations
- **Word Documents** — Formatted migration planning documents
- **YAML Templates** — MTV operator configuration files for migration execution

### Migration Planning
- **Wave Planning** — Network-based or complexity-based migration grouping
- **Complexity Scoring** — Automatic assessment of migration difficulty per VM
- **Remediation Guidance** — Actionable recommendations for migration blockers

---

## Quick Start

### 1. Import RVTools Data

1. Export your VMware environment using RVTools
2. Upload the `.xlsx` file to the application
3. The parser extracts data from multiple tabs (vInfo, vCPU, vDisk, etc.)

### 2. Analyze Migration Targets

Navigate to either:
- **ROKS Migration** — For OpenShift Virtualization with MTV
- **VPC VSI Migration** — For traditional VM-to-VSI migration

### 3. Review Readiness

- Check the readiness score and blockers
- Review OS compatibility status
- Examine remediation recommendations

### 4. Estimate Costs

- Select your target region
- Choose pricing type (On-Demand or Reserved)
- Review cost breakdown by category
- Export BOM for detailed cost analysis

### 5. Export Reports

- **Export BOM** — Excel spreadsheet with formulas and styling
- **Export PDF** — Professional assessment report
- **Export Excel** — Complete analysis workbook

---

## User Documentation

For comprehensive step-by-step instructions, see the **[User Guide](docs/USER_GUIDE.md)**.

The guide covers:
- Quick start (5-step overview)
- Importing RVTools data
- Understanding the Dashboard
- Infrastructure analysis (Compute, Storage, Network, Clusters, Hosts)
- Workload discovery and VM management (with maintainer-configurable classification and auto-exclusion)
- Migration assessment (ROKS and VSI)
- Wave planning
- Cost estimation
- Generating reports (PDF, Excel, Word, BOM, YAML)

### In-App Documentation

The application includes built-in documentation accessible from the sidebar:
- **/user-guide** - Interactive User Guide
- **/about** - Application version, changelog, and technology stack
- **/overhead-reference** - OpenShift Virtualization overhead calculation reference

---

## Data Privacy & Security

This application is designed with privacy and security in mind. **Your infrastructure data never leaves your browser.**

### How Your Data Is Handled

| Data Type | Where Processed | Stored? | Sent to Server? |
|-----------|-----------------|---------|-----------------|
| RVTools Excel files | Browser only | No | Never |
| VM inventory data | Browser memory | Session only | Never |
| Analysis results | Browser only | No | Never |
| Pricing/profiles cache | Browser localStorage | Yes (clearable) | Never |

### Client-Side Processing

- **RVTools files are parsed entirely in your browser** using JavaScript (SheetJS library)
- No file uploads occur — your infrastructure inventory stays on your machine
- All VM analysis, sizing calculations, and cost estimations run locally
- Generated reports (Excel, PDF, Word) are created in-browser and downloaded directly

### IBM Cloud API Calls

When using live pricing/profiles (via proxy or direct API):

- **Only public catalog data is fetched** (pricing, VSI profiles, bare metal specs)
- **No VM data is ever sent** to IBM Cloud or any external service
- API calls are read-only queries to public IBM Cloud endpoints
- Proxies only cache pricing/profile data — no user data is stored

### Local Storage

The app uses browser localStorage to cache:
- IBM Cloud pricing data (24-hour cache)
- IBM Cloud profile data (24-hour cache)
- Your custom profile overrides (persistent until cleared)

You can clear this data anytime via browser settings or the app's "Clear Cache" buttons.

### No Analytics or Tracking

This application does not include:
- Analytics services (Google Analytics, etc.)
- User tracking or telemetry
- Cookies for tracking purposes
- Third-party advertising

---

## Data Sources

### RVTools
- Website: https://www.dell.com/en-us/shop/vmware/sl/rvtools
- Supported export format: Excel (.xlsx)

### IBM Cloud Pricing
- Global Catalog API for live pricing
- Static fallback data updated periodically
- Regional multipliers for accurate estimates

---

## Branding

The application uses official IBM Cloud branding:

- **Page Title**: "VCF Migration Planning"
- **Favicon**: Official IBM Cloud favicon (`public/favicon.png`) downloaded from `https://cloud.ibm.com`
- **UI Components**: IBM Carbon Design System

---

# For Developers

This section covers development setup, project architecture, and contribution guidelines.

## Documentation

| Document | Description |
|----------|-------------|
| [README.md](README.md) | This file - project overview and getting started |
| [User Guide](docs/USER_GUIDE.md) | Comprehensive step-by-step usage instructions |
| [TECHNOLOGIES.md](TECHNOLOGIES.md) | Detailed technology stack documentation |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Production deployment guides for IBM Cloud |
| [CLAUDE.md](CLAUDE.md) | Development guidelines and architecture reference |
| [PRD.md](PRD.md) | Product Requirements Document |

---

## Technology Stack

- **React 18** with TypeScript for type-safe UI development
- **Vite** for fast development and optimized production builds
- **IBM Carbon Design System** for enterprise-grade UI components
- **Chart.js** for data visualization
- **ExcelJS** for Excel generation with styling and formulas
- **SheetJS (xlsx)** for reading Excel files
- **jsPDF** for PDF report generation

See [TECHNOLOGIES.md](TECHNOLOGIES.md) for detailed technology documentation.

---

## Getting Started

### Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x or **yarn**

### Installation

```bash
git clone https://github.com/neilrtaylor/vcf-migration.git
cd vcf-migration
npm install
```

### Development

```bash
npm run dev
```

Opens at `http://localhost:5173`

### Production Build

```bash
npm run build
npm run preview
```

### Testing

```bash
npm test              # Run tests with Vitest
npm run test:ui       # Run tests with UI
npm run test:coverage # Run tests with coverage
```

---

## Project Structure

```
vcf-migration/
├── public/                    # Static assets
│   └── favicon.png            # IBM Cloud favicon (from cloud.ibm.com)
├── src/
│   ├── components/
│   │   ├── charts/           # Visualization components
│   │   ├── common/           # Reusable UI components
│   │   ├── cost/             # Cost estimation components
│   │   ├── export/           # Export functionality
│   │   ├── layout/           # Navigation and layout
│   │   ├── pricing/          # Pricing display components
│   │   ├── sizing/           # Sizing calculators
│   │   └── tables/           # Data table components
│   ├── data/                 # Static data files
│   │   ├── ibmCloudPricing.json    # Fallback pricing data
│   │   ├── ibmCloudProfiles.json   # VSI profile definitions
│   │   ├── mtvRequirements.json    # MTV validation rules
│   │   └── redhatOSCompatibility.json
│   ├── hooks/                # Custom React hooks
│   ├── pages/                # Route pages
│   │   ├── ROKSMigrationPage.tsx   # ROKS analysis
│   │   ├── VSIMigrationPage.tsx    # VPC VSI analysis
│   │   └── ...
│   ├── services/
│   │   ├── costEstimation.ts       # Cost calculation logic
│   │   ├── export/                 # Export generators
│   │   │   ├── bomXlsxGenerator.ts # BOM Excel export
│   │   │   ├── pdfGenerator.ts     # PDF reports
│   │   │   └── ...
│   │   └── pricing/                # IBM Cloud pricing
│   │       ├── globalCatalogApi.ts # API integration
│   │       └── pricingCache.ts     # Caching layer
│   ├── styles/               # SCSS stylesheets
│   ├── types/                # TypeScript type definitions
│   └── utils/                # Utility functions
├── docs/                     # Documentation files
│   └── USER_GUIDE.md         # User documentation
├── scripts/                  # Build and update scripts
│   ├── update-profiles.ts    # Update IBM Cloud profiles
│   └── update-pricing.ts     # Update IBM Cloud pricing
├── DEPLOYMENT.md             # Production deployment guide
├── PRD.md                    # Product Requirements Document
├── TECHNOLOGIES.md           # Technology documentation
├── CLAUDE.md                 # Development guidelines
└── README.md
```

---

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
# IBM Cloud API (optional - enables live pricing)
VITE_IBM_CLOUD_API_KEY=your-api-key

# Pricing proxy URL (optional - for production deployments)
VITE_PRICING_PROXY_URL=https://your-function-url

# Profiles proxy URL (optional - for production deployments)
VITE_PROFILES_PROXY_URL=https://your-function-url

# AI proxy URL (optional - enables AI-powered features)
VITE_AI_PROXY_URL=https://your-ai-proxy-url

# AI proxy API key (optional - shared secret for AI proxy auth)
VITE_AI_PROXY_API_KEY=your-shared-secret
```

Without an API key, the application uses static pricing data from `ibmCloudConfig.json`.

### AI Features (Optional)

The application includes optional AI-powered features using IBM watsonx.ai:

- **Workload Classification** — LLM-based VM workload detection with confidence scores and purple "AI" source tags
- **Right-Sizing Recommendations** — AI-recommended VSI profiles considering workload context with source indicators
- **Migration Insights** — Executive summaries, risk assessments, and actionable recommendations (shows "AI Unavailable" state with link to Settings when disabled)
- **Chat Assistant** — Conversational interface for migration planning questions (disabled state with tooltip when AI toggled off)
- **Wave Planning Analysis** — AI-powered wave strategy suggestions with per-wave risk narratives and dependency warnings
- **Cost Optimization** — Prioritized cost reduction recommendations with estimated savings for VSI deployments
- **Remediation Guidance** — Step-by-step AI-generated remediation instructions for migration blockers with alternatives
- **AI-Enhanced Reports** — DOCX, PDF, Excel, and BOM exports include AI-generated insights (executive summary, risk assessment, recommendations, cost optimizations) with watsonx.ai disclaimer
- **AI Settings Page** — Dedicated settings page (`/settings`) with AI toggle, proxy connectivity test, consent management, and cache controls
- **AI Status Indicators** — Visual indicators across the app showing AI availability: SideNav "Off" tag, disabled chat widget, and AI source labels on classifications

#### Prerequisites

AI features require the **watsonx.ai Runtime** service (formerly Watson Machine Learning). This is the inference service that provides the `/ml/v1/text/generation` and `/ml/v1/text/chat` API endpoints used by the proxy. These are public endpoints (`us-south.ml.cloud.ibm.com`) — no VPN or private network connectivity is required. Watson Studio is **not** required — the proxy only performs inference against a pre-trained foundation model.

You will need:

1. **watsonx.ai Runtime** service instance provisioned in your IBM Cloud account
2. A **watsonx.ai project** with the Runtime service associated to it (provides the project ID)
3. The **IBM Granite model** (`ibm/granite-3-8b-instruct`) enabled in that project
4. An **IBM Cloud API key** with least-privilege access to the Runtime service (see below)

#### Creating the API Key

Create a dedicated service ID with only the permissions required for watsonx.ai inference:

```bash
# Log in to IBM Cloud
ibmcloud login --sso

# Target your resource group (where your watsonx.ai Runtime instance lives)
ibmcloud target -g <your-resource-group>

# Create a service ID for the AI proxy
ibmcloud iam service-id-create vcf-ai-proxy \
  --description "Least-privilege service ID for VCF Migration AI proxy"

# Grant Writer role on watsonx.ai Runtime (Watson Machine Learning)
# Writer is the minimum role required for text generation and chat inference.
# Scope to your specific Runtime instance to avoid account-wide access.
ibmcloud iam service-policy-create vcf-ai-proxy \
  --roles Writer \
  --service-name pm-20 \
  --service-instance <your-watsonx-runtime-instance-crn>

# Create an API key for the service ID
ibmcloud iam service-api-key-create vcf-ai-proxy-key vcf-ai-proxy \
  --description "API key for VCF Migration AI proxy" \
  --output json
```

The `--service-instance` flag scopes access to a single watsonx.ai Runtime instance. To find your instance ID:

```bash
ibmcloud resource service-instances --service-name pm-20 --output json | \
  jq '.[].id'
```

> **Roles summary:** The service ID needs only the **Writer** service role on the `pm-20` (Watson Machine Learning) service. No platform roles, no Watson Studio access, and no other service permissions are required.

#### Setting Up the AI Proxy

```bash
# 1. Provision watsonx.ai Runtime service in IBM Cloud console
# 2. Create a watsonx.ai project and associate the Runtime service
# 3. Enable ibm/granite-3-8b-instruct model in the project
# 4. Create the API key (see "Creating the API Key" above)

# 5. Add the service ID as a collaborator on the watsonx.ai project
#    The IAM policy grants access to the Runtime service, but each watsonx.ai
#    project manages its own member list separately. Without this step, API calls
#    will fail with a 403 "not a member of the project" error.
#
#    In the watsonx.ai console:
#      a. Open your project
#      b. Go to Manage > Access Control
#      c. Click "Add collaborators" > "Add service IDs"
#      d. Search for "vcf-ai-proxy" and add it with the Editor role

# 6. Generate a shared secret for frontend-to-proxy authentication
openssl rand -hex 32
# Save this value — you'll use it for AI_PROXY_API_KEY and VITE_AI_PROXY_API_KEY

# 7. Find your watsonx.ai project ID (GUID, not name)
#    Option A: watsonx.ai console → your project → Manage tab
#    Option B:
ibmcloud resource service-instances --service-name pm-20 --output json | jq '.[].guid'

# 8. Install proxy dependencies
cd functions/ai-proxy
npm install

# 9. Create (or select) a Code Engine project
ibmcloud ce project create --name vcf-migration-ai

ibmcloud ce app create --name vcf-ai-proxy \
  --source . \
  --env IBM_CLOUD_API_KEY=<api-key-from-step-4> \
  --env WATSONX_PROJECT_ID=<project-guid-from-step-7> \
  --env WATSONX_MODEL_ID=ibm/granite-3-8b-instruct \
  --env AI_PROXY_API_KEY=<shared-secret-from-step-6>

# If the app already exists, use update instead:
# ibmcloud ce app update --name vcf-ai-proxy \
#   --env IBM_CLOUD_API_KEY=<api-key-from-step-4> \
#   --env WATSONX_PROJECT_ID=<project-guid-from-step-7> \
#   --env WATSONX_MODEL_ID=ibm/granite-3-8b-instruct \
#   --env AI_PROXY_API_KEY=<shared-secret-from-step-6>

# 10. Get the proxy URL
ibmcloud ce app get --name vcf-ai-proxy --output url

# 11. Add proxy URL and shared secret to frontend .env
VITE_AI_PROXY_URL=<url-from-step-10>
VITE_AI_PROXY_API_KEY=<shared-secret-from-step-6>   # Must match AI_PROXY_API_KEY

# 12. Enable AI features in the app's Settings page (/settings)
```

AI features are always optional. Without the AI proxy configured, the app falls back to existing rule-based logic. Only aggregated environment summaries are sent to watsonx.ai (never individual VM names or IPs).

### Architecture: Pricing Proxy

```
  ┌─────────────────┐         ┌──────────────────────┐         ┌─────────────────┐
  │   Browser       │ ──────> │  Code Engine         │ ──────> │  IBM Cloud      │
  │   (Frontend)    │         │  Proxy               │         │  Global Catalog │
  │                 │ <────── │  (1-hour cache)      │ <────── │  API            │
  └─────────────────┘         └──────────────────────┘         └─────────────────┘
                                       │
                                API Key secure
                                on server
```

To deploy the pricing proxy:

```bash
# 1. Create API key
ibmcloud iam api-key-create vcf-pricing-proxy

# 2. Deploy proxy
cd functions/pricing-proxy
export IBM_CLOUD_API_KEY="your-key"
./deploy.sh

# 3. Add URL to frontend .env
VITE_PRICING_PROXY_URL=https://your-function-url

# 4. Rebuild and deploy
npm run build
```

---

## Maintainer Configuration

Maintainers configure workload classification and migration scope in `src/data/workloadPatterns.json`. This file controls three independent systems:

### Authoritative Classifications (`authoritativeClassifications`)

Pin specific VMs to a workload type by name pattern. **AI cannot override these** — only users can via the UI.

```json
"authoritativeClassifications": {
  "rules": [
    {
      "id": "network-edge-appliances",
      "match": "contains",
      "patterns": ["cust-edge", "service-edge"],
      "category": "network",
      "description": "Network edge appliances"
    }
  ]
}
```

Match types: `contains`, `startsWith`, `endsWith`, `exact`, `regex`. The `category` value must be a key from the `categories` section (which defines the available workload types).

### Workload Types (`categories`)

Defines the available workload types (e.g., Databases, Middleware) with fallback pattern matching. Patterns are used **only when AI is not available** and no authoritative rule matched.

### Auto-Exclusion Rules (`autoExclusionRules`)

Control migration **scope** — which VMs are automatically excluded (templates, powered-off, VMware infrastructure). Independent from classification. Users can override via the UI.

### Classification Precedence

| Priority | Source | Set by | AI can override? |
|----------|--------|--------|-----------------|
| 1 | User override | User (UI) | N/A |
| 2 | Authoritative | Maintainer (`authoritativeClassifications`) | **No** |
| 3 | AI | watsonx.ai (when available) | N/A |
| 4 | Pattern match | Maintainer (`categories` patterns) | Yes |

Auto-exclusion is independent — a VM can be classified as "Network Equipment" AND auto-excluded from migration at the same time.

## Data Maintenance

The application includes scripts to update IBM Cloud profiles and pricing data from the official APIs.

### Prerequisites

```bash
# Set your IBM Cloud API key
export IBM_CLOUD_API_KEY=your-api-key

# Or use the Vite environment variable
export VITE_IBM_CLOUD_API_KEY=your-api-key
```

### Update Commands

```bash
# Update profiles (VSI specs, bare metal specs, ROKS support flags)
npm run update-profiles

# Update pricing (hourly/monthly rates from Global Catalog)
npm run update-pricing

# Update both profiles and pricing
npm run update-all
```

### What Gets Updated

#### Profile Update (`scripts/update-profiles.ts`)
- **VSI Profiles** — vCPUs, memory, bandwidth from VPC API
- **Bare Metal Profiles** — cores, memory, NVMe storage from VPC API
- **ROKS Support Flags** — Auto-detected from Kubernetes Service API (`GET /v2/getFlavors`)

The script queries the IBM Kubernetes Service API to determine which bare metal profiles are supported as ROKS worker nodes, then sets `roksSupported: true` on matching profiles.

#### Pricing Update (`scripts/update-pricing.ts`)
- **VSI Pricing** — Hourly rates from Global Catalog
- **Bare Metal Pricing** — Hourly rates from Global Catalog
- Monthly rates are calculated as `hourlyRate × 730 hours`

### Static Fallback Data

All data is stored in `src/data/ibmCloudConfig.json` which serves as:
- **Fallback** when APIs are unavailable (CORS, no API key, etc.)
- **Offline support** for environments without internet access
- **Default values** that get merged with live API data

Run the update scripts periodically to keep the fallback data current.

---

## Production Deployment

For deploying to IBM Cloud, see [DEPLOYMENT.md](DEPLOYMENT.md) which covers:
- **VPC VSI with Nginx** — Full control, enterprise deployments
- **Code Engine** — Serverless, auto-scaling
- **Cloud Object Storage + CDN** — Static hosting, cost-effective

### Self-Hosted Deployment

For maximum security, you can deploy this application entirely within your own infrastructure:
- Host the static frontend on your own servers
- Deploy the pricing/profiles proxies in your own IBM Cloud account
- No external dependencies required after deployment

---

## Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/foo`)
3. Commit your changes
4. Push to your branch (`git push origin feature/foo`)
5. Open a Pull Request

See [CLAUDE.md](CLAUDE.md) for development guidelines and coding standards.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## Acknowledgements

Built with:
- [React](https://react.dev/)
- [IBM Carbon Design System](https://carbondesignsystem.com/)
- [ExcelJS](https://github.com/exceljs/exceljs)
- [Chart.js](https://www.chartjs.org/)


curl -X POST "https://api.dataplatform.cloud.ibm.com/v2/projects/4cb7c99d-c50b-456d-9160-f9fbd0a44b1d/settings" \
-H "Authorization: Bearer $(ibmcloud iam oauth-tokens --output json | jq -r '.iam_token')" \
-H "Content-Type: application/json" \                                      
-d '{"compute": [{"crn": "crn:v1:bluemix:public:pm-20:us-south:a/3cfdf229dfeb4afb8bf3f1067a9003e3:2412f745-0c10-4836-8188-c5e0fdbc6a2c::", "name": "watsonx.ai-vcf-migration", "type": "machine_learning"}]}'  