# VCF Pricing Proxy

IBM Code Engine serverless proxy for fetching IBM Cloud pricing data.

## Purpose

This application acts as a secure proxy between the VCF Migration frontend and the IBM Cloud Global Catalog API:

- **Security**: Keeps API credentials server-side (not exposed in browser)
- **Caching**: Reduces API calls with 1-hour cache
- **Reliability**: Returns cached/default data if API is unavailable
- **CORS**: Handles cross-origin requests from the frontend
- **Serverless**: Scales to zero when not in use, minimizing costs

## Quick Start

### Prerequisites

1. IBM Cloud CLI installed
2. Code Engine plugin installed
3. Logged into IBM Cloud

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
# Set your API key (optional - enables live pricing)
export IBM_CLOUD_API_KEY="your-api-key"

# Make deploy script executable
chmod +x deploy.sh

# Deploy
./deploy.sh
```

### Output

After deployment, you'll receive a URL like:

```
https://vcf-pricing-proxy.xxxx.us-south.codeengine.appdomain.cloud
```

Add this to your frontend `.env`:

```
VITE_PRICING_PROXY_URL=https://vcf-pricing-proxy.xxxx.us-south.codeengine.appdomain.cloud
```

## API Usage

### Get Pricing Data

```bash
curl https://your-app-url
```

Response:

```json
{
  "version": "2026-01-21",
  "lastUpdated": "2026-01-21T10:30:00.000Z",
  "source": "ibm-code-engine-proxy",
  "cached": false,
  "regions": { ... },
  "vsiProfiles": { ... },
  "blockStorage": { ... },
  "bareMetal": { ... },
  "networking": { ... }
}
```

### Force Refresh

```bash
curl 'https://your-app-url?refresh=true'
```

### Health Check

```bash
curl https://your-app-url/health
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `IBM_CLOUD_API_KEY` | IBM Cloud API key for authenticated requests | No |
| `PORT` | Server port (default: 8080) | No |

Without an API key, the application returns default pricing data.

### Cache Settings

- **TTL**: 1 hour (configurable in `index.js`)
- Cache persists while application instances are running
- Force refresh available via `?refresh=true` query parameter

## Local Development

```bash
# Install dependencies
npm install

# Run locally (without API key)
npm start

# Run locally with API key
IBM_CLOUD_API_KEY=your-key npm start

# Test endpoints
curl http://localhost:8080
curl http://localhost:8080/health
```

## Manual Deployment

If you prefer manual deployment over the script:

```bash
# Login and target region
ibmcloud login --sso
ibmcloud target -r us-south

# Create Code Engine project
ibmcloud ce project create --name vcf-migration
ibmcloud ce project select --name vcf-migration

# Create secret for API key (optional)
ibmcloud ce secret create --name vcf-api-key \
  --from-literal IBM_CLOUD_API_KEY="your-api-key"

# Deploy from source
ibmcloud ce app create --name vcf-pricing-proxy \
  --build-source . \
  --strategy dockerfile \
  --port 8080 \
  --min-scale 0 \
  --max-scale 3 \
  --env-from-secret vcf-api-key

# Get URL
ibmcloud ce app get --name vcf-pricing-proxy --output url
```

## Cost

Code Engine pricing is based on actual usage:

- **vCPU**: $0.00003420/vCPU-second
- **Memory**: $0.00000356/GiB-second
- **Scale to zero**: No charges when idle

For a typical frontend app with occasional pricing refreshes (configured with 0.25 vCPU, 0.5GB memory, scale-to-zero):

- **Idle cost**: $0/month
- **Active usage**: ~$1-5/month depending on traffic

This is typically cheaper than Cloud Functions for low-traffic applications.

## Troubleshooting

### Application returns 500 error

Check logs:

```bash
ibmcloud ce app logs --name vcf-pricing-proxy
```

### Application not starting

Check application status:

```bash
ibmcloud ce app get --name vcf-pricing-proxy
```

### CORS errors in browser

Verify the application is running and accessible:

```bash
curl -v https://your-app-url
```

### Stale pricing data

Force a refresh:

```bash
curl 'https://your-app-url?refresh=true'
```

### Update the application

```bash
# Redeploy with latest code
ibmcloud ce app update --name vcf-pricing-proxy --build-source .
```

## Migration from Cloud Functions

If you previously used Cloud Functions, here's what changed:

| Cloud Functions | Code Engine |
|-----------------|-------------|
| `ibmcloud fn` commands | `ibmcloud ce` commands |
| Single function file | Express HTTP server |
| `exports.main` handler | HTTP routes (`app.get()`) |
| `--kind nodejs:18` | Dockerfile-based build |
| Namespace-based | Project-based |

The API response format remains the same, so no frontend changes are needed.
