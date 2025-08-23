#!/bin/bash

echo "🌱 Staging Database Seeding Script"
echo "=================================="
echo ""
echo "You need to provide your Neon staging branch DATABASE_URL."
echo "This should look like: postgres://user:password@host/database?sslmode=require"
echo ""
echo "You can find this in your Neon dashboard under your staging branch."
echo ""

read -p "Enter your Neon staging DATABASE_URL: " STAGING_DB_URL

if [ -z "$STAGING_DB_URL" ]; then
    echo "❌ No DATABASE_URL provided. Exiting."
    exit 1
fi

echo ""
echo "🔧 Setting up staging environment..."
export DATABASE_URL_STAGING="$STAGING_DB_URL"

echo "📊 Running migrations..."
npm run db:migrate:staging

echo "🌱 Seeding database..."
npm run db:seed:staging

echo ""
echo "✅ Staging database setup complete!"
echo "You can now test your staging API at: https://chorely-backend-staging.adityajain2204.workers.dev"
