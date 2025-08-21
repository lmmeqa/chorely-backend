# Chorely Worker Deployment Guide

## 1. Set Repository Secrets (GitHub Actions)

Go to your repo → Settings → Secrets and variables → Actions:

```
CF_ACCOUNT_ID          # From Cloudflare dashboard
CF_API_TOKEN           # API token with "Workers Scripts:Edit" (account scope)
NEON_DATABASE_URL      # postgres://USER:PASSWORD@HOST:PORT/DB?sslmode=require
```

## 2. Set Worker Secrets (Runtime)

```bash
cd backend
npx wrangler secret put DATABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# Optional: if SUPABASE_URL not in wrangler.toml [vars]
# npx wrangler secret put SUPABASE_URL
```

## 3. Deploy

**Option A: CI/CD (Recommended)**
```bash
git push origin main  # Triggers migration → deploy
```

**Option B: Manual**
```bash
cd backend
npx wrangler deploy
```

## 4. Smoke Test

```bash
# Health check
curl https://<your-worker>.<account>.workers.dev/healthz

# Database connectivity
curl https://<your-worker>.<account>.workers.dev/readyz
```

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
