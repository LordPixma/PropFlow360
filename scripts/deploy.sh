#!/bin/bash
set -e

# PropFlow360 Deployment Script
# Deploys all workers and frontend to Cloudflare

echo "🚀 PropFlow360 Deployment Script"
echo "================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Error: wrangler CLI not found${NC}"
    echo "Install it with: npm install -g wrangler"
    exit 1
fi

# Check if logged in
if ! wrangler whoami &> /dev/null; then
    echo -e "${RED}❌ Error: Not logged in to Cloudflare${NC}"
    echo "Run: wrangler login"
    exit 1
fi

echo -e "${BLUE}📦 Building packages...${NC}"
cd packages/db && npm run build && cd ../..
cd packages/types && npm run build && cd ../..

echo -e "${GREEN}✅ Packages built${NC}"
echo ""

# Deploy API Worker
echo -e "${BLUE}🔧 Deploying API Worker...${NC}"
cd apps/api
npm run build
wrangler deploy
echo -e "${GREEN}✅ API Worker deployed${NC}"
cd ../..
echo ""

# Deploy Notification Worker
echo -e "${BLUE}📧 Deploying Notification Worker...${NC}"
cd apps/worker-notify
npm run build
wrangler deploy
echo -e "${GREEN}✅ Notification Worker deployed${NC}"
cd ../..
echo ""

# Deploy Channel Sync Worker
echo -e "${BLUE}🔄 Deploying Channel Sync Worker...${NC}"
cd apps/worker-channel-sync
npm run build
wrangler deploy
echo -e "${GREEN}✅ Channel Sync Worker deployed${NC}"
cd ../..
echo ""

# Deploy Analytics Worker
echo -e "${BLUE}📊 Deploying Analytics Worker...${NC}"
cd apps/worker-analytics
npm run build
wrangler deploy
echo -e "${GREEN}✅ Analytics Worker deployed${NC}"
cd ../..
echo ""

# Deploy Frontend
echo -e "${BLUE}🌐 Deploying Frontend to Cloudflare Pages...${NC}"
cd apps/web
npm run build
echo ""
echo -e "${YELLOW}Choose deployment method:${NC}"
echo "1) Deploy via wrangler (recommended)"
echo "2) Skip frontend (deploy via GitHub Actions or Cloudflare Dashboard)"
read -p "Enter choice [1-2]: " choice

case $choice in
    1)
        wrangler pages deploy ./build/client --project-name=propflow360
        echo -e "${GREEN}✅ Frontend deployed via wrangler${NC}"
        ;;
    2)
        echo -e "${YELLOW}⏭️  Skipping frontend deployment${NC}"
        echo "Deploy manually via: wrangler pages deploy ./build/client --project-name=propflow360"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac
cd ../..
echo ""

echo -e "${GREEN}════════════════════════════════════${NC}"
echo -e "${GREEN}✨ Deployment Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Verify API health: curl https://your-worker-url.workers.dev/health"
echo "2. Open frontend URL in browser"
echo "3. Test all features"
echo "4. Monitor logs: wrangler tail propflow360-api-dev"
echo ""
echo -e "${YELLOW}⚠️  Don't forget to:${NC}"
echo "- Set all secrets (JWT_SIGNING_KEY, etc.)"
echo "- Configure custom domains"
echo "- Update environment variables for production URLs"
echo ""
