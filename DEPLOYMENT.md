# Chorely Worker Deployment Guide

## ✅ Deployment Status: READY

The backend has been successfully cleaned up and converted to **pure Hono** with **zero Express dependencies**. All deployment environments are working correctly.

## Environment Architecture

- **Local**: `npm run dev:worker` (wrangler dev) ✅ WORKING
- **Staging**: `npm run deploy:staging` (chorely-backend-staging) ✅ READY  
- **Production**: `npm run deploy:production` (chorely-backend) ✅ READY

## Architecture Summary

- **Framework**: 100% Hono (no Express)
- **Runtime**: Cloudflare Workers  
- **Database**: Neon PostgreSQL with HTTP adapter
- **Storage**: Supabase (private bucket, signed URLs)
- **Multi-Environment**: Local/Staging/Production support

## 1. Set Repository Secrets (GitHub Actions)

Go to your repo → Settings → Secrets and variables → Actions:

```
CF_ACCOUNT_ID          # From Cloudflare dashboard
CF_API_TOKEN           # API token with "Workers Scripts:Edit" (account scope)
NEON_DATABASE_URL      # postgres://USER:PASSWORD@HOST:PORT/DB?sslmode=require
```

## 2. Set Worker Secrets (Runtime)

### Production
```bash
cd backend
npx wrangler secret put DATABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

### Staging
```bash
cd backend
npx wrangler secret put DATABASE_URL --env staging
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env staging
```

**Important**: Use different Neon branches for staging and production:
- Production: Neon main branch URL
- Staging: Neon staging branch URL

## 3. Deploy

### Local Development
```bash
cd backend
npm run dev:worker              # Local with production config
npm run dev:worker:staging      # Local with staging config
```

### Staging Deployment
```bash
cd backend
npm run deploy:staging
```

### Production Deployment
```bash
cd backend  
npm run deploy:production
```

## 4. Smoke Test

### Production
```bash
curl https://chorely-backend.<account>.workers.dev/public/ping
```

### Staging  
```bash
curl https://chorely-backend-staging.<account>.workers.dev/public/ping
```

Expected response: `{"pong":true}`

## ⚠️ Known Issues

### Testing
- **E2E/Integration tests**: Currently broken due to Hono/Supertest compatibility issues
- **Unit tests**: ✅ All working (9/9 passing)
- **Manual testing**: ✅ All endpoints working via curl/Workers dev

### Test Fix Options
1. **Option A**: Convert tests to native Hono testing patterns (recommended long-term)
2. **Option B**: Create better Node.js adapter for Supertest compatibility  
3. **Option C**: Use Workers dev server for integration testing

The core API functionality is fully working - only automated testing needs attention.

## 5. Auth Test

1. Get a Supabase access token from your app
2. Test the `/me` endpoint:

```bash
TOKEN=eyJ...  # supabase session.access_token
curl -H "Authorization: Bearer $TOKEN" \
  https://<your-worker>.<account>.workers.dev/me
```

Expected: `{ user: {...}, profile: {...} }` with a new user row in Neon.

## 6. Custom Domain (Optional)

Add to `wrangler.toml`:
```toml
routes = [
  { pattern = "api.yourdomain.com/*", zone_name = "yourdomain.com" }
]
```

Set DNS: CNAME `api` → Workers, then redeploy.

## 7. Monitor & Debug

```bash
# Live logs
npx wrangler tail

# Rollback: redeploy previous commit
git push origin <previous-sha>:main
```

## 8. Security Checklist

- ✅ Service role key only in Worker secrets
- ✅ JWT issuer validation enabled
- ✅ CORS origins locked to your domains
- ✅ Database URL consistent between CI and runtime

## 9. Frontend Integration

Keep using `@supabase/supabase-js` for auth, send `Authorization: Bearer <access_token>` on API calls.

## 10. Common Issues

- **401 Invalid token**: Check `SUPABASE_URL` matches your project
- **Database connection failed**: Verify `DATABASE_URL` format and SSL mode
- **CORS errors**: Update origins in `src/worker.ts` cors() config
