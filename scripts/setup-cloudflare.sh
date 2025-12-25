#!/bin/bash
set -e

# PropFlow360 Cloudflare Setup Script
# Creates all required Cloudflare resources

echo "🔧 PropFlow360 Cloudflare Setup"
echo "================================"
echo ""

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

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

echo -e "${BLUE}Creating D1 Databases...${NC}"
echo ""

# Create D1 databases
echo "Creating core database..."
wrangler d1 create propflow360-core-dev || echo "Database may already exist"

echo "Creating audit database..."
wrangler d1 create propflow360-audit-dev || echo "Database may already exist"

echo -e "${GREEN}✅ D1 Databases created${NC}"
echo ""
echo -e "${YELLOW}⚠️  Copy the database IDs and update wrangler.toml files${NC}"
echo ""

# Create KV namespaces
echo -e "${BLUE}Creating KV Namespaces...${NC}"
echo ""

wrangler kv:namespace create "KV_CONFIG" || echo "Namespace may already exist"
wrangler kv:namespace create "KV_CACHE" || echo "Namespace may already exist"
wrangler kv:namespace create "KV_SESSIONS" || echo "Namespace may already exist"

echo -e "${GREEN}✅ KV Namespaces created${NC}"
echo ""
echo -e "${YELLOW}⚠️  Copy the namespace IDs and update apps/api/wrangler.toml${NC}"
echo ""

# Create R2 buckets
echo -e "${BLUE}Creating R2 Buckets...${NC}"
echo ""

wrangler r2 bucket create propflow360-media-dev || echo "Bucket may already exist"
wrangler r2 bucket create propflow360-docs-dev || echo "Bucket may already exist"
wrangler r2 bucket create propflow360-exports-dev || echo "Bucket may already exist"

echo -e "${GREEN}✅ R2 Buckets created${NC}"
echo ""

# Create Queues
echo -e "${BLUE}Creating Queues...${NC}"
echo ""

wrangler queues create propflow360-notifications-dev || echo "Queue may already exist"
wrangler queues create propflow360-billing-dev || echo "Queue may already exist"
wrangler queues create propflow360-calsync-dev || echo "Queue may already exist"

echo -e "${GREEN}✅ Queues created${NC}"
echo ""

echo -e "${GREEN}════════════════════════════════════${NC}"
echo -e "${GREEN}✨ Setup Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo ""
echo "1. Update wrangler.toml files with the generated IDs"
echo "   - D1 database IDs in all worker wrangler.toml files"
echo "   - KV namespace IDs in apps/api/wrangler.toml"
echo ""
echo "2. Run database migrations:"
echo "   cd apps/api"
echo "   wrangler d1 execute propflow360-core-dev --file=../../packages/db/migrations/0001_init.sql"
echo "   (Repeat for all 10 migration files)"
echo ""
echo "3. Set secrets:"
echo "   cd apps/api"
echo "   wrangler secret put JWT_SIGNING_KEY"
echo "   wrangler secret put SESSION_ENC_KEY"
echo "   wrangler secret put RESEND_API_KEY"
echo "   (And other required secrets)"
echo ""
echo "4. Deploy workers:"
echo "   ./scripts/deploy.sh"
echo ""
