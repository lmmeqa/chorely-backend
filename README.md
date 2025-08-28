# Chorely Backend

A Hono-based REST API for the Chorely chore management application, deployable to Cloudflare Workers.

## Architecture

- **Framework**: Hono.js
- **Runtime**: Cloudflare Workers (production) / Node.js (local)
- **Database**: PostgreSQL with Neon (cloud)
- **ORM**: Drizzle ORM
- **Authentication**: Supabase JWT
- **Storage**: Supabase Storage (images)

---

## Local Development

### Prerequisites

- Node.js 22+
- PostgreSQL database (local or Neon cloud)
- Supabase project with authentication enabled

### 1. Installation

```bash
cd backend
npm install
```

### 2. Environment Setup

Create `.env` file in the backend directory:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/chorely"

# Supabase
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
SUPABASE_JWT_SECRET="your-jwt-secret"
SUPABASE_BUCKET="uploads"

# Optional
STRICT_AUTH="false"  # Set to "true" for production
```

### 3. Database Setup

```bash
# Run migrations
npm run db:migrate

# Seed with demo data
npm run db:seed

# Optional: Open database studio
npm run db:studio
```

### 4. Start Development Server

```bash
# Option 1: Node.js server (fastest)
npm run dev

# Option 2: Cloudflare Workers dev (matches production)
npm run dev:worker

# Option 3: Workers dev with network access (for mobile testing)
npm run dev:worker:network
```

**API Available At**:
- Node.js: `http://localhost:3000`
- Workers: `http://localhost:8787`

### 5. Testing

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Run with UI
npm run test:ui

# Test API health
curl http://localhost:3000/public/ping
# Expected: {"pong":true}
```

---

## Staging Deployment

### 1. Prerequisites

- Cloudflare account with Workers enabled
- Wrangler CLI configured (`npx wrangler login`)
- Neon staging branch database
- Supabase staging project

### 2. Environment Setup

Set Wrangler secrets for staging:

```bash
npx wrangler secret put DATABASE_URL_STAGING --env staging
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env staging
```

**Important**: Use separate Neon branch for staging:
- Staging: `postgres://user:pass@host/db_staging?sslmode=require`
- Production: `postgres://user:pass@host/db_production?sslmode=require`

### 3. Database Migration

```bash
# Run migrations on staging database
npm run db:migrate:staging

# Upload seed images to Supabase Storage
npm run upload-seed-images:staging

# Seed staging database
npm run db:seed:staging
```

### 4. Deploy to Staging

```bash
npm run deploy:staging
```

**Staging URL**: `https://chorely-backend-staging.your-account.workers.dev`

### 5. Test Staging

```bash
# Test health endpoint
curl https://chorely-backend-staging.your-account.workers.dev/public/ping

# View live logs
npx wrangler tail --env staging
```

---

## Production Deployment

### 1. Environment Setup

Set production secrets:

```bash
npx wrangler secret put DATABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

### 2. Database Migration

```bash
# Run migrations on production database
npm run db:migrate:production

# Upload seed images to Supabase Storage
npm run upload-seed-images:production

# Seed production database (optional)
npm run db:seed:production
```

### 3. Deploy to Production

```bash
npm run deploy:production
```

**Production URL**: `https://chorely-backend.your-account.workers.dev`

### 4. Monitor Production

```bash
# View live logs
npx wrangler tail

# Check deployment status
npx wrangler deployments list
```

---

## Database Management

### Multi-Environment Support

The backend supports three database environments:

| Environment | Usage | Database URL |
|-------------|-------|--------------|
| **Local** | Development | `.env` file |
| **Staging** | Testing | Wrangler secret |
| **Production** | Live app | Wrangler secret |

### Common Operations

```bash
# Local development
npm run db:migrate          # Run migrations
npm run db:seed             # Seed with demo data
npm run db:studio           # Open Drizzle Studio

# Staging environment
npm run db:migrate:staging   # Run migrations
npm run db:seed:staging      # Seed staging
npm run db:studio:staging    # Studio for staging

# Production environment  
npm run db:migrate:production # Run migrations
npm run db:seed:production    # Seed production
npm run db:studio:production  # Studio for production
```

### Schema Changes

1. **Modify** `src/db/schema.ts`
2. **Generate migration**: `npm run db:generate`
3. **Run locally**: `npm run db:migrate`
4. **Test locally**: `npm run dev`
5. **Deploy staging**: `npm run db:migrate:staging`
6. **Deploy production**: `npm run db:migrate:production`

---

## Image Management

### Local Development
- Seed images served from `/seed/*` endpoints
- Static files in `static/seed/` directory
- No Supabase Storage required

### Staging/Production
- Seed images stored in Supabase Storage
- User uploads stored in private buckets
- Signed URLs generated for secure access

### Image Workflows

```bash
# Download seed images (one-time setup)
npm run fetch-seed-images

# Upload to staging Supabase Storage
npm run upload-seed-images:staging

# Upload to production Supabase Storage
npm run upload-seed-images:production
```

---

## Integration with Frontend

### Local Development

1. **Start backend**:
   ```bash
   npm run dev
   ```

2. **Configure frontend** (in frontend directory):
   ```bash
   export EXPO_PUBLIC_API_BASE=http://localhost:3000
   ```

### Staging Testing

1. **Configure frontend**:
   ```bash
   export EXPO_PUBLIC_API_BASE=https://chorely-backend-staging.your-account.workers.dev
   ```

### Mobile Device Testing

1. **Start network-accessible server**:
   ```bash
   npm run dev:worker:network
   ```

2. **Use your computer's IP**:
   ```bash
   export EXPO_PUBLIC_API_BASE=http://192.168.1.100:8787
   ```

---

## Troubleshooting

### Common Issues

#### Database Connection Failed
- **Check**: `DATABASE_URL` includes `?sslmode=require` for Neon
- **Verify**: Database is accessible from your network
- **Confirm**: Wrangler secrets are set correctly

#### Authentication Errors
- **Check**: `SUPABASE_URL` matches your project
- **Verify**: `SUPABASE_SERVICE_ROLE_KEY` has correct permissions
- **Test**: JWT token is not expired

#### CORS Errors
- **Update**: CORS origins in `src/worker.ts`
- **Verify**: Frontend URL is allowed

#### Images Not Loading
- **Local**: Check if static files exist in `static/seed/`
- **Production**: Verify images uploaded to Supabase Storage
- **Check**: Bucket permissions and signed URL generation

### Debug Commands

```bash
# View live Worker logs
npx wrangler tail --env staging

# Test specific endpoint
curl -H "Authorization: Bearer <token>" https://your-api.com/endpoint

# Check database connection
npm run db:studio

# Run specific tests
npm run test -- chores.e2e.test.ts

# Verify environment variables
npx wrangler secret list --env staging
```

### Performance Monitoring

```bash
# Check deployment analytics
npx wrangler deployments list

# Monitor resource usage
npx wrangler tail --format=pretty

# Database performance
npm run db:studio  # View query performance
```

---

## Environment Variables Reference

### Required

| Variable | Environment | Description |
|----------|-------------|-------------|
| `DATABASE_URL` | Local | PostgreSQL connection string |
| `DATABASE_URL_STAGING` | Staging | Neon staging branch URL |
| `DATABASE_URL` | Production | Neon production URL (via Wrangler) |
| `SUPABASE_URL` | All | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | All | Service role key for admin operations |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPABASE_JWT_SECRET` | None | For local JWT verification |
| `SUPABASE_BUCKET` | `uploads` | Storage bucket name |
| `STRICT_AUTH` | `false` | Enable strict auth in production |

---

## API Documentation

For complete API documentation including endpoints, request/response formats, and examples, see [API.md](API.md).

## Project Structure

```
backend/
├── src/
│   ├── routes/          # API route handlers
│   │   ├── chores.ts    # Chore management
│   │   ├── disputes.ts  # Dispute system
│   │   ├── users.ts     # User management
│   │   └── ...
│   ├── lib/             # Core utilities
│   │   ├── auth.ts      # Supabase auth
│   │   ├── uploads.ts   # Image handling
│   │   └── db.ts        # Database connection
│   ├── middleware/      # Custom middleware
│   ├── db/              # Database schema
│   └── worker.ts        # Main application
├── tests/               # Test suites
├── scripts/             # Utility scripts
├── drizzle/             # Database migrations
├── static/seed/         # Seed images (local dev)
└── wrangler.toml        # Cloudflare Workers config
```

---

## Scripts Reference

### Database
- `db:migrate` - Run migrations locally
- `db:migrate:staging` - Run migrations on staging
- `db:migrate:production` - Run migrations on production
- `db:seed` - Seed local database
- `db:seed:staging` - Seed staging database
- `db:studio` - Open Drizzle Studio

### Development
- `dev` - Start Node.js development server
- `dev:worker` - Start Cloudflare Workers dev server
- `dev:worker:network` - Workers dev with network access

### Testing
- `test` - Run all tests
- `test:coverage` - Run tests with coverage
- `test:ui` - Run tests with UI

### Deployment
- `deploy:staging` - Deploy to staging
- `deploy:production` - Deploy to production

### Image Management
- `fetch-seed-images` - Download seed images
- `upload-seed-images:staging` - Upload to staging storage
- `upload-seed-images:production` - Upload to production storage

### Build
- `build` - Build for production
- `start` - Start production build locally

---

## Runtime env

- `NODE_ENV` ∈ `development|staging|production`. Internal routes (`/internal/*`) are **disabled** in `production`.
- `ALLOWED_ORIGINS` — comma-separated list of allowed origins for CORS, e.g.

```
https://chorely.app,https://chorely.pages.dev,exp://127.0.0.1:19000
```

- Minimal logging in production; richer logs in non-prod. No response/request bodies are logged in prod.
- A lightweight in-memory rate limiter protects public endpoints (upgrade to DO/KV for higher scale).