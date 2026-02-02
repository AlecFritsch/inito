#!/bin/bash
# Havoc VM Deployment Script
# Usage: ./deploy.sh

set -e

echo "🚀 Deploying Havoc..."

# Check if .env exists
if [ ! -f .env ]; then
  echo "❌ .env file not found! Copy env.example to .env and fill in your values."
  exit 1
fi

# Load env vars (docker-compose reads .env automatically)

# Build and start all services
echo "📦 Building containers..."
docker compose -f docker/docker-compose.yml build

echo "🗄️ Starting PostgreSQL and Redis..."
docker compose -f docker/docker-compose.yml up -d postgres redis

# Wait for postgres
echo "⏳ Waiting for database..."
sleep 5

echo "🔄 Initializing database..."
docker compose -f docker/docker-compose.yml exec -T postgres psql -U havoc -d havoc -f /docker-entrypoint-initdb.d/init.sql 2>/dev/null || \
docker compose -f docker/docker-compose.yml exec -T postgres psql -U havoc -d havoc < docker/init.sql

echo "🌐 Starting API and Dashboard..."
docker compose -f docker/docker-compose.yml up -d api dashboard

# Check if SSL is initialized for production
if [ -d "docker/certs/live/usehavoc.com" ]; then
  echo "🔐 Starting nginx with SSL..."
  docker compose -f docker/docker-compose.yml --profile production up -d nginx certbot
  
  echo ""
  echo "✅ Havoc deployed successfully with SSL!"
  echo ""
  echo "📍 Services:"
  echo "   Dashboard: https://usehavoc.com"
  echo "   API:       https://api.usehavoc.com"
  echo "   Health:    https://api.usehavoc.com/health"
else
  echo ""
  echo "✅ Havoc deployed successfully!"
  echo ""
  echo "⚠️  SSL not initialized! For production deployment:"
  echo "   1. Point usehavoc.com DNS to this server"
  echo "   2. Run: cd docker && chmod +x init-letsencrypt.sh && ./init-letsencrypt.sh"
  echo ""
  echo "📍 Services (local development):"
  echo "   Dashboard: http://localhost:3000"
  echo "   API:       http://localhost:3001"
  echo "   Health:    http://localhost:3001/health"
fi

echo ""
echo "📊 Logs: docker compose -f docker/docker-compose.yml logs -f"
echo "🛑 Stop: docker compose -f docker/docker-compose.yml down"
