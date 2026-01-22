#!/bin/bash
set -e

# VCF Migration Profiles Proxy - Code Engine Deployment Script
# Deploys the profiles proxy application to IBM Code Engine

echo "=== VCF Profiles Proxy - Code Engine Deployment ==="
echo ""

# Configuration
APP_NAME="vcf-profiles-proxy"
PROJECT_NAME="${CE_PROJECT_NAME:-vcf-migration}"
REGION="${IBM_CLOUD_REGION:-us-south}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."

    if ! command -v ibmcloud &> /dev/null; then
        echo -e "${RED}Error: IBM Cloud CLI not found${NC}"
        echo "Install from: https://cloud.ibm.com/docs/cli"
        exit 1
    fi

    # Check if logged in
    if ! ibmcloud account show &> /dev/null; then
        echo -e "${YELLOW}Not logged in to IBM Cloud${NC}"
        echo "Running: ibmcloud login --sso"
        ibmcloud login --sso
    fi

    # Check Code Engine plugin
    if ! ibmcloud ce --help &> /dev/null; then
        echo "Installing Code Engine plugin..."
        ibmcloud plugin install code-engine
    fi

    echo -e "${GREEN}Prerequisites OK${NC}"
}

# Set target region
set_target() {
    echo ""
    echo "Setting target region..."
    ibmcloud target -r "$REGION"

    # Only set resource group if explicitly provided
    if [ -n "$IBM_CLOUD_RESOURCE_GROUP" ]; then
        ibmcloud target -g "$IBM_CLOUD_RESOURCE_GROUP"
        echo -e "${GREEN}Target set: $REGION / $IBM_CLOUD_RESOURCE_GROUP${NC}"
    else
        echo -e "${GREEN}Target set: $REGION (using current resource group)${NC}"
    fi
}

# Create or select Code Engine project
setup_project() {
    echo ""
    echo "Setting up Code Engine project..."

    # Check if project exists
    if ibmcloud ce project get --name "$PROJECT_NAME" &> /dev/null; then
        echo "Project exists, selecting: $PROJECT_NAME"
        ibmcloud ce project select --name "$PROJECT_NAME"
    else
        echo "Creating project: $PROJECT_NAME"
        ibmcloud ce project create --name "$PROJECT_NAME"
        ibmcloud ce project select --name "$PROJECT_NAME"
    fi

    echo -e "${GREEN}Project ready: $PROJECT_NAME${NC}"
}

# Create secret for API key if provided
create_secret() {
    if [ -n "$IBM_CLOUD_API_KEY" ]; then
        echo ""
        echo "Creating/updating secret for API key..."

        # Delete existing secret if it exists
        ibmcloud ce secret delete --name vcf-api-key --force 2>/dev/null || true

        # Create new secret
        ibmcloud ce secret create --name vcf-api-key \
            --from-literal IBM_CLOUD_API_KEY="$IBM_CLOUD_API_KEY"

        echo -e "${GREEN}Secret created: vcf-api-key${NC}"
    else
        echo -e "${YELLOW}Warning: IBM_CLOUD_API_KEY not set. Profiles proxy requires an API key.${NC}"
        echo -e "${YELLOW}Set IBM_CLOUD_API_KEY environment variable and run again.${NC}"
        exit 1
    fi
}

# Deploy the application
deploy_app() {
    echo ""
    echo "Deploying application..."

    # Build common arguments
    DEPLOY_ARGS=(
        --name "$APP_NAME"
        --build-source .
        --strategy dockerfile
        --port 8080
        --min-scale 0
        --max-scale 3
        --cpu 0.25
        --memory 0.5G
        --concurrency 100
        --env-from-secret vcf-api-key
    )

    # Check if app exists
    if ibmcloud ce app get --name "$APP_NAME" &> /dev/null; then
        echo "Updating existing application..."
        ibmcloud ce app update "${DEPLOY_ARGS[@]}"
    else
        echo "Creating new application..."
        ibmcloud ce app create "${DEPLOY_ARGS[@]}"
    fi

    echo -e "${GREEN}Application deployed: $APP_NAME${NC}"
}

# Get the application URL
get_app_url() {
    echo ""
    echo "Getting application URL..."

    # Wait for app to be ready
    echo "Waiting for application to be ready..."
    sleep 5

    # Get URL
    APP_URL=$(ibmcloud ce app get --name "$APP_NAME" --output url)

    echo ""
    echo "=========================================="
    echo -e "${GREEN}Deployment Complete!${NC}"
    echo "=========================================="
    echo ""
    echo "Application URL:"
    echo -e "${GREEN}${APP_URL}${NC}"
    echo ""
    echo "Test the application:"
    echo "  curl '${APP_URL}'"
    echo ""
    echo "Health check:"
    echo "  curl '${APP_URL}/health'"
    echo ""
    echo "Add to your .env file:"
    echo "  VITE_PROFILES_PROXY_URL=${APP_URL}"
    echo ""
}

# Main deployment flow
main() {
    check_prerequisites
    set_target
    setup_project
    create_secret
    deploy_app
    get_app_url
}

# Run main
main
