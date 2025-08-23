# Chorely Backend API

A Hono-based API server for the Chorely chore management application, deployable to both local development and Cloudflare Workers.

## Architecture

- **Framework**: Hono.js (lightweight web framework)
- **Runtime**: Node.js (local) / Cloudflare Workers (deployed)
- **Database**: PostgreSQL with Neon (cloud) or local PostgreSQL
- **ORM**: Drizzle ORM
- **Authentication**: Supabase JWT
- **Storage**: Supabase (file uploads)

## Quick Start

### Prerequisites

- Node.js 22+
- PostgreSQL database (local or Neon cloud)
- Supabase project
- Environment variables configured

### 1. Installation

```bash
cd backend
npm install
```

### 2. Environment Setup

Create a `.env` file in the `backend` directory:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/chorely"

# Supabase
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_JWT_SECRET="your-jwt-secret"
SUPABASE_BUCKET="uploads"

# Optional
STRICT_AUTH="false"  # Set to "true" for production
```

### 3. Database Setup

```bash
# Generate and run migrations
npm run db:generate
npm run db:migrate

# Seed with demo data
npm run db:seed
```

### 4. Local Development

```bash
# Option A: Node.js server (for development/testing)
npm run dev

# Option B: Cloudflare Workers dev server (matches production)
npm run dev:worker

# Option C: Workers dev with network access (for mobile testing)
npm run dev:worker:network
```

The API will be available at:
- Node.js: `http://localhost:3000`
- Workers dev: `http://localhost:8787`

### 5. Testing

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Run with UI
npm run test:ui
```

## Deployment

### Staging Environment

1. **Set up Wrangler secrets:**
```bash
npx wrangler secret put DATABASE_URL --env staging
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env staging
```

2. **Deploy:**
```bash
npm run build
npm run deploy:staging
```

3. **Test deployment:**
```bash
curl https://chorely-backend-staging.your-account.workers.dev/public/ping
# Expected: {"pong":true}
```

### Production Environment

1. **Set up Wrangler secrets:**
```bash
npx wrangler secret put DATABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

2. **Deploy:**
```bash
npm run build
npm run deploy:production
```

3. **Test deployment:**
```bash
curl https://chorely-backend.your-account.workers.dev/public/ping
# Expected: {"pong":true}
```

## Database Management

### Environments

The backend supports multiple database environments:

- **Local**: Uses `DATABASE_URL` from `.env`
- **Staging**: Uses Neon staging branch (set via Wrangler secrets)
- **Production**: Uses Neon main branch (set via Wrangler secrets)

### Common Commands

```bash
# Local database operations
npm run db:migrate          # Run migrations
npm run db:seed             # Seed with demo data
npm run db:studio           # Open Drizzle Studio

# Staging database operations
npm run db:migrate:staging   # Run migrations on staging
npm run db:seed:staging      # Seed staging with demo data
npm run db:studio:staging    # Open studio for staging

# Production database operations
npm run db:migrate:production
npm run db:seed:production
npm run db:studio:production
```

## API Documentation

### Authentication

All protected endpoints require a Supabase JWT token:

```bash
curl -H "Authorization: Bearer <supabase-access-token>" \
  https://your-api.com/api/endpoint
```

### Key Endpoints

- `GET /public/ping` - Health check (no auth required)
- `POST /auth/authenticate` - Authenticate user with Supabase JWT
- `GET /auth/me` - Get current user info
- `GET /me` - Get user profile
- `GET /homes` - List homes
- `GET /chores/user?homeId=<uuid>` - Get user's chores
- `POST /chores` - Create a new chore

For complete API documentation, see [ApiDoc.md](ApiDoc.md).

## Development Workflow

### Local Development with Frontend

1. **Start backend locally:**
```bash
npm run dev  # Node.js server at :3000
```

2. **Configure frontend to use local backend:**
```bash
# In frontend directory
export EXPO_PUBLIC_API_BASE=http://localhost:3000
```

### Testing Against Staging

1. **Use staging backend URL in frontend:**
```bash
# In frontend directory  
export EXPO_PUBLIC_API_BASE=https://chorely-backend-staging.your-account.workers.dev
```

### Database Reset (Development)

```bash
# Reset local database and reseed
npm run db:push  # Push schema changes
npm run db:seed  # Reseed with demo data
```

## Troubleshooting

### Common Issues

1. **Database connection failed**
   - Verify `DATABASE_URL` format includes `?sslmode=require` for Neon
   - Check if database is accessible from your network
   - Ensure secrets are set correctly in Workers environment

2. **Authentication errors**
   - Verify `SUPABASE_URL` matches your project
   - Check `SUPABASE_SERVICE_ROLE_KEY` has correct permissions
   - Ensure JWT token is not expired

3. **CORS errors**
   - Update CORS origins in `src/worker.ts`
   - Check if frontend URL is allowed

### Debugging

```bash
# View live logs from deployed Workers
npx wrangler tail --env staging

# Run specific tests
npm run test -- auth.e2e.test.ts

# Check database connection
npm run db:studio
```

### Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `SUPABASE_ANON_KEY` | No* | For local development |
| `SUPABASE_JWT_SECRET` | No* | For local JWT verification |
| `STRICT_AUTH` | No | Set to "true" for production |

*Required for local development, not needed for deployed Workers

## Project Structure

```
backend/
├── src/
│   ├── routes/          # API route handlers
│   ├── lib/             # Core utilities (auth, db, etc.)
│   ├── middleware/      # Custom middleware
│   ├── db/              # Database schema
│   └── worker.ts        # Main application entry
├── tests/               # Test suites
├── scripts/             # Utility scripts
├── drizzle/             # Database migrations
└── static/              # Static assets (seed images)
```

## Contributing

1. Run tests before submitting: `npm run test`
2. Follow the existing code style
3. Update tests for new features
4. Ensure all environments work (local, staging, production)

For more detailed deployment information, see [DEPLOYMENT.md](DEPLOYMENT.md).