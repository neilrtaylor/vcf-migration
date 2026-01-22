# Deploying VCF Migration to IBM Cloud

This guide covers deploying the VCF Migration application to production on IBM Cloud. Since this is a static React application (client-side only), there are several deployment options.

---

## Deployment Options Overview

| Option | Best For | Cost | Complexity |
|--------|----------|------|------------|
| **VPC VSI + Nginx** | Full control, enterprise requirements | $$ | Medium |
| **Code Engine** | Serverless, auto-scaling | $ | Low |
| **Cloud Object Storage + CDN** | Static hosting, global distribution | $ | Low |

---

## Option 1: VPC VSI with Nginx (Recommended for Enterprise)

This approach gives you full control over the server and is suitable for enterprise deployments with specific security requirements.

### Prerequisites

- IBM Cloud account with pay-as-you-go billing
- IBM Cloud CLI installed locally
- SSH key pair for VSI access

### Step 1: Install IBM Cloud CLI

```bash
# macOS
curl -fsSL https://clis.cloud.ibm.com/install/osx | sh

# Linux
curl -fsSL https://clis.cloud.ibm.com/install/linux | sh

# Windows (PowerShell)
iex (New-Object Net.WebClient).DownloadString('https://clis.cloud.ibm.com/install/powershell')
```

Install required plugins:

```bash
ibmcloud plugin install vpc-infrastructure
ibmcloud plugin install cloud-object-storage
```

### Step 2: Login and Set Target Region

```bash
# Login to IBM Cloud
ibmcloud login --sso

# Or with API key
ibmcloud login --apikey <your-api-key>

# Set target region (choose closest to your users)
ibmcloud target -r us-south

# Create a resource group (or use existing)
ibmcloud resource group-create vcf-migration-rg
ibmcloud target -g vcf-migration-rg
```

### Step 3: Create VPC Infrastructure

```bash
# Create VPC
ibmcloud is vpc-create vcf-migration-vpc

# Create subnet (get zone from: ibmcloud is zones us-south)
ibmcloud is subnet-create vcf-migration-subnet vcf-migration-vpc \
  --zone us-south-1 \
  --ipv4-address-count 256

# Create public gateway for internet access
ibmcloud is public-gateway-create vcf-migration-pgw vcf-migration-vpc us-south-1

# Attach gateway to subnet
ibmcloud is subnet-update vcf-migration-subnet --pgw vcf-migration-pgw
```

### Step 4: Create Security Group Rules

```bash
# Get the default security group ID
ibmcloud is vpcs
# Note the default security group ID for vcf-migration-vpc

# Add inbound rules for HTTP, HTTPS, and SSH
ibmcloud is security-group-rule-add <security-group-id> inbound tcp --port-min 22 --port-max 22
ibmcloud is security-group-rule-add <security-group-id> inbound tcp --port-min 80 --port-max 80
ibmcloud is security-group-rule-add <security-group-id> inbound tcp --port-min 443 --port-max 443
```

### Step 5: Create SSH Key

```bash
# Generate SSH key if you don't have one
ssh-keygen -t rsa -b 4096 -f ~/.ssh/ibm_vcf_migration

# Add SSH key to IBM Cloud
ibmcloud is key-create vcf-migration-key @~/.ssh/ibm_vcf_migration.pub
```

### Step 6: Create Virtual Server Instance

```bash
# List available images (choose Ubuntu 22.04)
ibmcloud is images --status available | grep ubuntu

# List available profiles
ibmcloud is instance-profiles

# Create VSI (cx2-2x4 is cost-effective for static hosting)
ibmcloud is instance-create vcf-migration-vsi \
  vcf-migration-vpc \
  us-south-1 \
  cx2-2x4 \
  vcf-migration-subnet \
  --image ibm-ubuntu-22-04-4-minimal-amd64-2 \
  --keys vcf-migration-key
```

### Step 7: Assign Floating IP

```bash
# Create and assign floating IP
ibmcloud is floating-ip-reserve vcf-migration-fip --zone us-south-1

# Get the network interface ID from your instance
ibmcloud is instance vcf-migration-vsi

# Bind floating IP to instance
ibmcloud is floating-ip-update vcf-migration-fip --nic <network-interface-id>

# Note the floating IP address for SSH access
ibmcloud is floating-ip vcf-migration-fip
```

### Step 8: Configure the Server

SSH into your server:

```bash
ssh -i ~/.ssh/ibm_vcf_migration root@<floating-ip>
```

Install required software:

```bash
# Update system
apt update && apt upgrade -y

# Install Nginx
apt install -y nginx

# Install Node.js 20.x (for building if needed)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install Certbot for SSL
apt install -y certbot python3-certbot-nginx

# Start and enable Nginx
systemctl start nginx
systemctl enable nginx
```

### Step 9: Configure Nginx

Create Nginx configuration:

```bash
cat > /etc/nginx/sites-available/vcf-migration << 'EOF'
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain or use _ for IP access
    root /var/www/vcf-migration;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1000;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Handle SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/vcf-migration /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload
nginx -t && systemctl reload nginx
```

### Step 10: Build and Deploy Application

On your local machine:

```bash
# Build the production bundle
npm run build

# Deploy to server
rsync -avz --delete \
  -e "ssh -i ~/.ssh/ibm_vcf_migration" \
  dist/ \
  root@<floating-ip>:/var/www/vcf-migration/
```

Or create a deployment script (`deploy.sh`):

```bash
#!/bin/bash
set -e

SERVER_IP="<your-floating-ip>"
SSH_KEY="~/.ssh/ibm_vcf_migration"
REMOTE_PATH="/var/www/vcf-migration"

echo "Building application..."
npm run build

echo "Deploying to $SERVER_IP..."
rsync -avz --delete \
  -e "ssh -i $SSH_KEY" \
  dist/ \
  root@$SERVER_IP:$REMOTE_PATH/

echo "Deployment complete!"
echo "Application available at: http://$SERVER_IP"
```

### Step 11: Configure SSL/TLS (Optional but Recommended)

If you have a domain name:

```bash
# On the server
certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
# Test renewal
certbot renew --dry-run
```

For IP-only access with self-signed certificate:

```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/vcf-migration.key \
  -out /etc/ssl/certs/vcf-migration.crt \
  -subj "/CN=vcf-migration"

# Update Nginx config for HTTPS
cat > /etc/nginx/sites-available/vcf-migration << 'EOF'
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name _;

    ssl_certificate /etc/ssl/certs/vcf-migration.crt;
    ssl_certificate_key /etc/ssl/private/vcf-migration.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

    root /var/www/vcf-migration;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

nginx -t && systemctl reload nginx
```

---

## Option 2: IBM Code Engine (Serverless)

Code Engine is simpler and scales automatically. Ideal for variable traffic.

### Step 1: Create Container Image

Create `Dockerfile` in project root:

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
```

Create `nginx.conf`:

```nginx
server {
    listen 8080;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Step 2: Deploy to Code Engine

```bash
# Set target region (choose closest to your users)
ibmcloud target -r us-south

# Create a resource group (or use existing)
ibmcloud resource group-create vcf-migration-rg
ibmcloud target -g vcf-migration-rg

# Install Code Engine plugin
ibmcloud plugin install code-engine

# Create project
ibmcloud ce project create --name vcf-migration

# Build and deploy from source
ibmcloud ce application create --name vcf-migration \
  --build-source . \
  --strategy dockerfile \
  --port 8080 \
  --min-scale 1 \
  --max-scale 10

# Get the application URL
ibmcloud ce application get --name vcf-migration --output url
```

To redeploy:

```bash
ibmcloud ce app update --name vcf-migration  --build-source . 
```

### Step 3: Custom Domain (Optional)

```bash
# Add custom domain mapping
ibmcloud ce domainmapping create --name vcf.yourdomain.com \
  --target-app vcf-migration \
  --tls-secret your-tls-secret
```

---

## Option 3: Cloud Object Storage + CDN

For the simplest and most cost-effective static hosting.

### Step 1: Create COS Instance and Bucket

```bash
# Create COS instance
ibmcloud resource service-instance-create vcf-migration-cos \
  cloud-object-storage standard global

# Get COS instance CRN
ibmcloud resource service-instance vcf-migration-cos

# Create bucket (choose unique name)
ibmcloud cos bucket-create \
  --bucket vcf-migration-static-<unique-suffix> \
  --class smart \
  --region us-south
```

### Step 2: Enable Static Website Hosting

```bash
# Configure static website
ibmcloud cos bucket-website-configuration-put \
  --bucket vcf-migration-static-<unique-suffix> \
  --website-configuration '{
    "IndexDocument": {"Suffix": "index.html"},
    "ErrorDocument": {"Key": "index.html"}
  }'
```

### Step 3: Set Public Access Policy

```bash
# Make bucket publicly readable
ibmcloud cos bucket-policy-put \
  --bucket vcf-migration-static-<unique-suffix> \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::vcf-migration-static-<unique-suffix>/*"
    }]
  }'
```

### Step 4: Build and Upload

```bash
# Build
npm run build

# Upload to COS
ibmcloud cos objects-upload \
  --bucket vcf-migration-static-<unique-suffix> \
  --path dist \
  --recursive
```

### Step 5: Access Application

The application will be available at:
```
https://s3.us-south.cloud-object-storage.appdomain.cloud/vcf-migration-static-<unique-suffix>/index.html
```

For a custom domain, use IBM Cloud Internet Services (CIS) as a CDN.

---

## Environment Configuration

### Setting Up API Access (Optional)

If you want to enable live IBM Cloud pricing:

1. Create an API key:
```bash
ibmcloud iam api-key-create vcf-migration-pricing \
  --description "API key for VCF Migration pricing lookup"
```

2. For VPC VSI deployment, set environment variable:
```bash
# On server, add to /etc/environment or nginx config
echo "VITE_IBM_CLOUD_API_KEY=your-api-key" >> /etc/environment
```

Note: Since this is a client-side application, the API key would be exposed in the browser. For production, use the Code Engine pricing proxy (see below).

---

## Code Engine Pricing Proxy (Recommended)

The pricing proxy keeps your IBM Cloud API credentials secure server-side while providing live pricing data to the frontend.

### Why Use the Proxy?

| Approach | Security | CORS | Caching |
|----------|----------|------|---------|
| Direct API key in browser | Exposed | Issues | None |
| **Code Engine Proxy** | **Secure** | **Handled** | **1-hour cache** |
| Static fallback data | N/A | N/A | N/A |

### Step 1: Create an API Key

```bash
ibmcloud iam api-key-create vcf-pricing-proxy \
  --description "API key for VCF Migration pricing proxy"
```

Save the API key securely - you'll need it for deployment.

### Step 2: Deploy the Pricing Proxy

```bash
cd functions/pricing-proxy

# Make deployment script executable
chmod +x deploy.sh

# Set your API key
export IBM_CLOUD_API_KEY="your-api-key-from-step-1"

# Deploy
./deploy.sh
```

The script will output a URL like:
```
https://vcf-pricing-proxy.xxxx.us-south.codeengine.appdomain.cloud
```

### Step 3: Configure the Frontend

Add the proxy URL to your `.env` file:

```bash
VITE_PRICING_PROXY_URL=https://vcf-pricing-proxy.xxxx.us-south.codeengine.appdomain.cloud
```

### Step 4: Rebuild and Deploy

```bash
npm run build
# Then deploy dist/ to your hosting (VSI, Code Engine, etc.)
```

### Manual Deployment (Alternative)

If you prefer to deploy manually without the script:

```bash
# Install Code Engine plugin
ibmcloud plugin install code-engine

# Login and target region
ibmcloud login --sso
ibmcloud target -r us-south

# Create project
ibmcloud ce project create --name vcf-migration
ibmcloud ce project select --name vcf-migration

# Create secret for API key (optional)
ibmcloud ce secret create --name vcf-api-key \
  --from-literal IBM_CLOUD_API_KEY="your-api-key"

# Deploy the application
cd functions/pricing-proxy
ibmcloud ce app create --name vcf-pricing-proxy \
  --build-source . \
  --strategy dockerfile \
  --port 8080 \
  --min-scale 0 \
  --max-scale 3 \
  --env-from-secret vcf-api-key

# Get the URL
ibmcloud ce app get --name vcf-pricing-proxy --output url
```

### Testing the Proxy

```bash
# Test the deployed application
curl https://your-app-url

# Should return JSON with pricing data:
# {
#   "version": "2026-01-21",
#   "source": "ibm-code-engine-proxy",
#   "cached": false,
#   "vsiProfiles": { ... },
#   ...
# }

# Health check
curl https://your-app-url/health
```

To redeploy:

```bash
ibmcloud ce app update --name vcf-pricing-proxy --build-source .         
```


### Proxy Cost

Code Engine pricing is based on actual usage with scale-to-zero:
- **vCPU**: $0.00003420/vCPU-second
- **Memory**: $0.00000356/GiB-second
- **Idle cost**: $0/month (scales to zero)

For a typical frontend app with occasional pricing refreshes, **this costs $1-5/month or less**.

### Updating the Proxy

To update the application code:

```bash
# Redeploy with latest code
cd functions/pricing-proxy
ibmcloud ce app update --name vcf-pricing-proxy --build-source .

# Force refresh cached data
curl 'https://your-app-url?refresh=true'
```

---

## Code Engine Profiles Proxy (Optional)

The profiles proxy keeps your IBM Cloud API credentials secure while providing live VPC and ROKS profile data to the frontend.

### Why Use the Profiles Proxy?

| Data Source | Without Proxy | With Proxy |
|-------------|---------------|------------|
| VSI Profiles | Static JSON | Live from VPC API |
| Bare Metal Profiles | Static JSON | Live from VPC API |
| ROKS Machine Types | Static JSON | Live from Kubernetes API |
| API Key | Exposed in browser | Secure on server |

### Deploy the Profiles Proxy

The profiles proxy uses the same API key as the pricing proxy.

```bash
cd functions/profiles-proxy

# Make deployment script executable
chmod +x deploy.sh

# Set your API key (same as pricing proxy)
export IBM_CLOUD_API_KEY="your-api-key"

# Deploy
./deploy.sh
```

The script will output a URL like:
```
https://vcf-profiles-proxy.xxxx.us-south.codeengine.appdomain.cloud
```

### Configure the Frontend

Add the proxy URL to your `.env` file:

```bash
VITE_PROFILES_PROXY_URL=https://vcf-profiles-proxy.xxxx.us-south.codeengine.appdomain.cloud
```

### API Usage

```bash
# Get profiles (default region: us-south)
curl https://your-profiles-proxy-url

# Get profiles for a different region
curl 'https://your-profiles-proxy-url?region=eu-de&zone=eu-de-1'

# Force refresh
curl 'https://your-profiles-proxy-url?refresh=true'
```

### Required IAM Permissions

The API key needs these permissions for the profiles proxy:

| Service | Role | Purpose |
|---------|------|---------|
| VPC Infrastructure Services | Viewer | Read VSI/Bare Metal profiles |
| Kubernetes Service | Viewer | Read ROKS machine types |

---

## Domain Name Setup

IBM Cloud Internet Services (CIS) provides DNS management, CDN, SSL, and DDoS protection — but does not sell domain names. You need to register a domain through a registrar first.

### Domain Registration Options

| Registrar | .com Price/yr | Notes |
|-----------|---------------|-------|
| [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) | ~$10 | At-cost pricing, no markup |
| [Namecheap](https://www.namecheap.com) | ~$10-13 | Good value, free WhoisGuard |
| [Porkbun](https://porkbun.com) | ~$10 | Cheap, simple interface |
| [Google Domains](https://domains.google) | ~$12 | Clean interface (now Squarespace) |

### Option A: Without a Custom Domain

If you don't want to purchase a domain, you can still deploy with these options:

**Code Engine (Recommended)** — Provides a free IBM-managed subdomain with valid SSL:
```
https://vcf-migration.xxxx.us-south.codeengine.appdomain.cloud
```

**VPC Floating IP** — Access via IP with self-signed certificate:
```
https://169.48.x.x
```

**Cloud Object Storage** — Long URL but functional:
```
https://s3.us-south.cloud-object-storage.appdomain.cloud/your-bucket/index.html
```

### Option B: With a Custom Domain via IBM CIS

#### Step 1: Register Your Domain

Purchase a domain from any registrar (e.g., `vcf-migration-tool.com` for ~$10/year).

#### Step 2: Create IBM Cloud Internet Services Instance

```bash
# Install CIS plugin
ibmcloud plugin install cis

# Create CIS instance (standard-next plan)
ibmcloud resource service-instance-create vcf-cis internet-svcs standard-next global

# Wait for provisioning, then get the CRN
ibmcloud resource service-instance vcf-cis
```

#### Step 3: Add Your Domain to CIS

```bash
# Set CIS instance
ibmcloud cis instance-set vcf-cis

# Add domain
ibmcloud cis domain-add vcf-migration-tool.com
```

CIS will provide nameservers like:
```
ns006.name.cloud.ibm.com
ns017.name.cloud.ibm.com
```

#### Step 4: Update Nameservers at Your Registrar

Log into your domain registrar and replace the default nameservers with the ones provided by CIS. This delegates DNS control to IBM Cloud.

Propagation typically takes 15-60 minutes (up to 48 hours in some cases).

#### Step 5: Verify Domain Status

```bash
# Check domain status
ibmcloud cis domains

# Should show status: "active"
```

#### Step 6: Create DNS Records

**For Code Engine:**
```bash
# Get your Code Engine app URL first
ibmcloud ce application get --name vcf-migration --output url

# Create CNAME record
ibmcloud cis dns-record-create vcf-migration-tool.com \
  --type CNAME \
  --name www \
  --content vcf-migration.xxxx.us-south.codeengine.appdomain.cloud

# Create root domain record (CNAME flattening)
ibmcloud cis dns-record-create vcf-migration-tool.com \
  --type CNAME \
  --name @ \
  --content vcf-migration.xxxx.us-south.codeengine.appdomain.cloud
```

**For VPC VSI:**
```bash
# Create A record pointing to floating IP
ibmcloud cis dns-record-create vcf-migration-tool.com \
  --type A \
  --name www \
  --content 169.48.x.x

ibmcloud cis dns-record-create vcf-migration-tool.com \
  --type A \
  --name @ \
  --content 169.48.x.x
```

#### Step 7: Configure SSL/TLS

CIS provides free SSL certificates:

```bash
# Enable Universal SSL (automatic)
ibmcloud cis tls-settings-update --min-tls-version 1.2

# Verify certificate status
ibmcloud cis certificates
```

SSL modes:
- **Flexible**: SSL between browser and CIS only (not recommended)
- **Full**: SSL end-to-end, self-signed cert on origin OK
- **Full (Strict)**: SSL end-to-end, valid cert required on origin

For VPC VSI with Nginx:
```bash
# Set Full mode (works with self-signed certs on origin)
ibmcloud cis tls-settings-update --ssl full
```

For Code Engine (has valid SSL already):
```bash
# Set Full (Strict) mode
ibmcloud cis tls-settings-update --ssl strict
```

#### Step 8: Configure Code Engine Domain Mapping (if using Code Engine)

```bash
# Create domain mapping in Code Engine
ibmcloud ce domainmapping create \
  --name vcf-migration-tool.com \
  --target vcf-migration

ibmcloud ce domainmapping create \
  --name www.vcf-migration-tool.com \
  --target vcf-migration
```

### CIS Additional Features

Once your domain is active in CIS, you can enable:

```bash
# Enable caching for static assets
ibmcloud cis cache-settings-update --caching-level aggressive

# Enable minification
ibmcloud cis minify-update --js on --css on --html on

# Enable DDoS protection (automatic with CIS)

# View analytics
ibmcloud cis analytics --since -7d
```

### Domain Setup Cost Summary

| Component | Cost |
|-----------|------|
| Domain registration | ~$10-15/year |
| IBM CIS (Standard Next) | ~$225/month |
| IBM CIS (Enterprise) | Contact IBM |

**Note**: IBM CIS Standard Next plan starts at ~$225/month which may be overkill for a simple app. Alternatives:

1. **Use Code Engine's free subdomain** — No cost, valid SSL
2. **Use Cloudflare Free Plan** — Free DNS, CDN, SSL for your domain
3. **VPC VSI with Let's Encrypt** — Free SSL with Certbot (requires domain)

### Alternative: Cloudflare Free Plan (Recommended for Cost Savings)

If CIS is too expensive, use Cloudflare's free plan:

1. Register domain at any registrar
2. Add domain to Cloudflare (free plan)
3. Update nameservers to Cloudflare
4. Create DNS records pointing to your VPC or Code Engine
5. Enable Cloudflare proxy for free SSL/CDN

This gives you similar benefits (DNS, CDN, SSL, basic DDoS protection) at no cost.

---

## CI/CD with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to IBM Cloud

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy to VPC VSI
        env:
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
          SERVER_IP: ${{ secrets.SERVER_IP }}
        run: |
          mkdir -p ~/.ssh
          echo "$SSH_PRIVATE_KEY" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key

          rsync -avz --delete \
            -e "ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no" \
            dist/ \
            root@$SERVER_IP:/var/www/vcf-migration/
```

Add these secrets to your GitHub repository:
- `SSH_PRIVATE_KEY`: Your SSH private key
- `SERVER_IP`: Your VSI floating IP

---

## Monitoring and Logging

### For VPC VSI

Install IBM Cloud Monitoring agent:

```bash
# On the server
curl -sL https://ibm.biz/install-sysdig-agent | bash -s -- \
  --access_key <your-sysdig-access-key> \
  --collector ingest.us-south.monitoring.cloud.ibm.com \
  --collector_port 6443 \
  --secure true \
  --tags "app:vcf-migration,env:production"
```

### Log Aggregation

Configure Nginx logs for IBM Log Analysis:

```bash
# Install logging agent
curl -sSL https://assets.us-south.logging.cloud.ibm.com/clients/logdna-agent-install.sh | \
  bash -s -- -k <ingestion-key> -d /var/log -t nginx
```

---

## Cost Estimation

### VPC VSI (cx2-2x4 profile)
- VSI: ~$50/month
- Floating IP: ~$4/month
- Block Storage (100GB): ~$10/month
- **Total: ~$65/month**

### Code Engine
- Free tier: 100,000 vCPU-seconds/month
- Beyond free tier: ~$0.00003420/vCPU-second
- **Typical cost: $5-20/month**

### Cloud Object Storage
- Storage: $0.022/GB/month
- Requests: $0.0037 per 10,000 requests
- Bandwidth: $0.09/GB (first 50GB free)
- **Typical cost: $2-10/month**

---

## Troubleshooting

### Application not loading
```bash
# Check Nginx status
systemctl status nginx

# Check Nginx error logs
tail -f /var/log/nginx/error.log

# Verify files exist
ls -la /var/www/vcf-migration/
```

### SSL certificate issues
```bash
# Renew certificate
certbot renew

# Check certificate expiry
openssl x509 -in /etc/letsencrypt/live/your-domain.com/cert.pem -noout -dates
```

### Deployment fails
```bash
# Check rsync connectivity
ssh -i ~/.ssh/ibm_vcf_migration root@<floating-ip> "echo 'Connection OK'"

# Verify disk space
df -h /var/www/
```

---

## Data Privacy

This application is designed to keep your infrastructure data private and secure.

### User Data Handling

| Component | Data Processed | Data Stored | Data Transmitted |
|-----------|----------------|-------------|------------------|
| **Frontend (Browser)** | RVTools files, VM analysis | localStorage cache only | Never to external servers |
| **Pricing Proxy** | None | Pricing cache (1hr) | IBM Cloud Catalog API only |
| **Profiles Proxy** | None | Profiles cache (1hr) | IBM Cloud VPC/ROKS APIs only |

### Key Privacy Principles

1. **Client-Side Processing**: All RVTools file parsing and VM analysis occurs entirely in the user's browser. No infrastructure data is ever uploaded to any server.

2. **No Data Collection**: The application does not collect, store, or transmit any user data or infrastructure information. There is no analytics, telemetry, or tracking.

3. **Proxy Isolation**: The Code Engine proxies only fetch public IBM Cloud pricing and profile data. They never receive or process any user infrastructure data.

4. **Local Storage**: Browser localStorage is used only for caching pricing/profile data and user preferences. Users can clear this data at any time.

5. **Self-Contained**: When deployed, the application is fully self-contained within your IBM Cloud account with no external dependencies.

### Communicating to Users

Consider adding a privacy notice to your deployment:
- Add a "Privacy" link in the app footer
- Include privacy information in user documentation
- Reference the client-side architecture in security reviews

---

## Security Checklist

- [ ] SSH key-only authentication (disable password auth)
- [ ] Firewall rules limited to ports 22, 80, 443
- [ ] SSL/TLS enabled with strong ciphers
- [ ] Security headers configured in Nginx
- [ ] Regular OS updates scheduled
- [ ] Monitoring and alerting configured
- [ ] Backup strategy for configuration files
