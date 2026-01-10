#!/bin/bash
set -euo pipefail

# FeedStream PWA Deployment Script
# This script automates the deployment process on Ubuntu

echo "🚀 Starting FeedStream PWA deployment..."
echo ""

# Step 1: Pull latest code
echo "📥 Pulling latest code from git..."
git pull
echo "✅ Code updated"
echo ""

# Step 2: Build images with latest base images
echo "🔨 Building Docker images..."
docker compose build --pull api web
echo "✅ Images built"
echo ""

# Step 3: Run web builder to refresh frontend (MANDATORY)
echo "🎨 Building frontend and updating volume..."
docker compose run --rm web
echo "✅ Frontend built and copied to web-build volume"
echo ""

# Step 4: Start/update API service
echo "🚀 Starting API service..."
docker compose up -d api
echo "✅ API service started"
echo ""

# Step 5: Start/update Caddy service
echo "🌐 Starting Caddy service..."
docker compose up -d caddy
echo "✅ Caddy service started"
echo ""

# Step 6: Restart Caddy to ensure it serves new frontend
echo "🔄 Restarting Caddy..."
docker compose restart caddy
echo "✅ Caddy restarted"
echo ""

# Step 7: Show status
echo "📊 Deployment Status:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker compose ps
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✨ Deployment complete!"
echo ""
echo "💡 Tips:"
echo "  - View logs: docker compose logs -f"
echo "  - Check API: docker compose logs api"
echo "  - Check Caddy: docker compose logs caddy"
echo "  - Rebuild frontend only: docker compose run --rm web"
