#!/bin/bash

set -e

echo "Setting up PropFlow360 development environment..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed."; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "pnpm is required but not installed. Run: npm install -g pnpm"; exit 1; }
command -v wrangler >/dev/null 2>&1 || { echo "Wrangler is required. Installing..."; npm install -g wrangler; }

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Create local D1 databases
echo "Creating local D1 databases..."
cd apps/api

# Note: You need to update wrangler.toml with actual database IDs after creating them
# wrangler d1 create propflow360-core-dev
# wrangler d1 create propflow360-audit-dev

# Run migrations locally
echo "Running migrations..."
wrangler d1 execute DB_CORE --local --file=../../packages/db/migrations/0001_initial_schema.sql

cd ../..

# Create KV namespaces (for production - local uses in-memory)
# wrangler kv:namespace create KV_CONFIG
# wrangler kv:namespace create KV_CACHE
# wrangler kv:namespace create KV_SESSIONS

# Create R2 buckets (for production)
# wrangler r2 bucket create propflow360-media-dev
# wrangler r2 bucket create propflow360-docs-dev
# wrangler r2 bucket create propflow360-exports-dev

# Create queues (for production)
# wrangler queues create propflow360-notifications-dev
# wrangler queues create propflow360-billing-dev
# wrangler queues create propflow360-calsync-dev

echo ""
echo "Development environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env and fill in your secrets"
echo "2. Update wrangler.toml files with your Cloudflare resource IDs"
echo "3. Run 'pnpm dev' to start development servers"
echo ""
