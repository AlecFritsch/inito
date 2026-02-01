#!/bin/bash
# Initialize Let's Encrypt certificates for usehavoc.com
# Run this ONCE on first deployment

set -e

DOMAINS=(usehavoc.com www.usehavoc.com api.usehavoc.com)
EMAIL="admin@usehavoc.com"  # Change this!
STAGING=0  # Set to 1 for testing (avoid rate limits)

DATA_PATH="./certs"
WEBROOT_PATH="./certbot-webroot"

# Check if certificates already exist
if [ -d "$DATA_PATH/live/usehavoc.com" ]; then
  echo "⚠️  Certificates already exist. Delete $DATA_PATH to regenerate."
  exit 0
fi

echo "🔐 Initializing Let's Encrypt certificates..."

# Create directories
mkdir -p "$DATA_PATH"
mkdir -p "$WEBROOT_PATH"

# Create temporary self-signed certificate for nginx to start
echo "📝 Creating temporary self-signed certificate..."
mkdir -p "$DATA_PATH/live/usehavoc.com"
openssl req -x509 -nodes -newkey rsa:4096 -days 1 \
  -keyout "$DATA_PATH/live/usehavoc.com/privkey.pem" \
  -out "$DATA_PATH/live/usehavoc.com/fullchain.pem" \
  -subj "/CN=localhost" 2>/dev/null

# Start nginx with temporary cert
echo "🚀 Starting nginx..."
docker compose -f docker-compose.yml --profile production up -d nginx
sleep 5

# Delete temporary certificate
echo "🗑️  Removing temporary certificate..."
rm -rf "$DATA_PATH/live/usehavoc.com"

# Request real certificate
echo "📜 Requesting Let's Encrypt certificate..."

DOMAIN_ARGS=""
for domain in "${DOMAINS[@]}"; do
  DOMAIN_ARGS="$DOMAIN_ARGS -d $domain"
done

# Staging flag for testing
STAGING_ARG=""
if [ $STAGING != "0" ]; then
  STAGING_ARG="--staging"
  echo "⚠️  Using STAGING environment (certificates won't be trusted)"
fi

docker compose -f docker-compose.yml --profile production run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  $STAGING_ARG \
  --email $EMAIL \
  --agree-tos \
  --no-eff-email \
  --force-renewal \
  $DOMAIN_ARGS

echo "🔄 Reloading nginx..."
docker compose -f docker-compose.yml --profile production exec nginx nginx -s reload

echo ""
echo "✅ SSL certificates initialized successfully!"
echo ""
echo "🌐 Your domains are now secured:"
for domain in "${DOMAINS[@]}"; do
  echo "   https://$domain"
done
echo ""
echo "📅 Certificates will auto-renew via certbot container."
