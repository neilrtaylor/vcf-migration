# VCF Profiles Proxy

IBM Code Engine serverless proxy for fetching IBM Cloud VPC and ROKS profile data.

## Purpose

This application acts as a secure proxy between the VCF Migration frontend and the IBM Cloud VPC/ROKS APIs:

- **Security**: Keeps API credentials server-side (not exposed in browser)
- **Caching**: Reduces API calls with 1-hour cache
- **CORS**: Handles cross-origin requests from the frontend
- **Aggregation**: Combines VPC VSI, Bare Metal, and ROKS data in one response

## APIs Proxied

| API | Endpoint | Data |
|-----|----------|------|
| VPC VSI Profiles | `/v1/instance/profiles` | Virtual server instance specs |
| VPC Bare Metal | `/v1/bare_metal_server/profiles` | Bare metal server specs |
| ROKS Flavors | `/v2/getFlavors` | Kubernetes worker node options |

## Quick Start

### Prerequisites

1. IBM Cloud CLI installed
2. Code Engine plugin installed
3. API key with VPC and Kubernetes Service access

```bash
# Install Code Engine plugin
ibmcloud plugin install code-engine

# Login to IBM Cloud
ibmcloud login --sso

# Target a region
ibmcloud target -r us-south
```

### Deploy

```bash
# Set your API key (required for profiles)
export IBM_CLOUD_API_KEY="your-api-key"

# Make deploy script executable
chmod +x deploy.sh

# Deploy
./deploy.sh
```

### Output

After deployment, you'll receive a URL like:

```
https://vcf-profiles-proxy.xxxx.us-south.codeengine.appdomain.cloud
```

Add this to your frontend `.env`:

```
VITE_PROFILES_PROXY_URL=https://vcf-profiles-proxy.xxxx.us-south.codeengine.appdomain.cloud
```

## API Usage

### Get Profiles

```bash
curl https://your-app-url
```

Response:

```json
{
  "version": "2026-01-21",
  "lastUpdated": "2026-01-21T10:30:00.000Z",
  "source": "ibm-code-engine-profiles-proxy",
  "region": "us-south",
  "zone": "us-south-1",
  "vsiProfiles": [...],
  "bareMetalProfiles": [...],
  "counts": {
    "vsi": 45,
    "bareMetal": 12,
    "roksVSI": 30,
    "roksBM": 8
  }
}
```

### Query Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `refresh` | Bypass cache (`true`) | `false` |
| `region` | IBM Cloud region | `us-south` |
| `zone` | Availability zone | `{region}-1` |

Examples:

```bash
# Get profiles for a different region
curl 'https://your-app-url?region=eu-de&zone=eu-de-1'

# Force refresh
curl 'https://your-app-url?refresh=true'
```

### Health Check

```bash
curl https://your-app-url/health
```

## Required IAM Permissions

The API key needs these permissions:

| Service | Role | Purpose |
|---------|------|---------|
| VPC Infrastructure Services | Viewer | Read VSI/Bare Metal profiles |
| Kubernetes Service | Viewer | Read ROKS machine types |

## Local Development

```bash
# Install dependencies
npm install

# Run locally with API key
IBM_CLOUD_API_KEY=your-key npm start

# Test endpoints
curl http://localhost:8080
curl http://localhost:8080/health
```

## Manual Deployment

```bash
# Login and target region
ibmcloud login --sso
ibmcloud target -r us-south

# Select Code Engine project
ibmcloud ce project select --name vcf-migration

# Create/update secret
ibmcloud ce secret create --name vcf-api-key \
  --from-literal IBM_CLOUD_API_KEY="your-api-key"

# Deploy from source
ibmcloud ce app create --name vcf-profiles-proxy \
  --build-source . \
  --strategy dockerfile \
  --port 8080 \
  --min-scale 0 \
  --max-scale 3 \
  --env-from-secret vcf-api-key

# Get URL
ibmcloud ce app get --name vcf-profiles-proxy --output url
```

## Troubleshooting

### No profiles returned

Check that your API key has the required permissions:

```bash
# List your access policies
ibmcloud iam access-policies
```

### Check logs

```bash
ibmcloud ce app logs --name vcf-profiles-proxy
```

### Stale data

Force a refresh:

```bash
curl 'https://your-app-url?refresh=true'
```
