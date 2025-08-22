// src/lib/auth.ts
import { Context, Next } from "hono";
import { createRemoteJWKSet, jwtVerify, JWTPayload } from "jose";

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwksForProject(projectUrl: string) {
  // https://<project>.supabase.co/auth/v1/.well-known/jwks.json
  const url = new URL("/auth/v1/.well-known/jwks.json", projectUrl);
  let jwks = jwksCache.get(url.toString());
  if (!jwks) {
    jwks = createRemoteJWKSet(url);
    jwksCache.set(url.toString(), jwks);
  }
  return jwks!;
}

function bool(v: unknown): boolean {
  if (typeof v !== "string") return false;
  return v.toLowerCase() === "true" || v === "1";
}

export async function requireUser(c: Context, next: Next) {
  const hdr = c.req.header("authorization") || c.req.header("Authorization");
  if (!hdr?.startsWith("Bearer ")) return c.text("Missing Authorization", 401);
  const token = hdr.slice("Bearer ".length);

  const env: any = c.env ?? {};
  const strict = bool(process.env.STRICT_AUTH ?? env.STRICT_AUTH);
  const supabaseUrl = (process.env.SUPABASE_URL ?? env.SUPABASE_URL) as string | undefined;
  const supabaseJwtSecret = (process.env.SUPABASE_JWT_SECRET ?? env.SUPABASE_JWT_SECRET) as string | undefined;

  try {
    let payload: JWTPayload;

    if (strict && supabaseJwtSecret) {
      // Local HS256 verification for tests/CI
      const key = new TextEncoder().encode(supabaseJwtSecret);
      ({ payload } = await jwtVerify(token, key)); // HS256 default for Supabase JWT
    } else {
      // Remote JWKS (production/dev)
      if (!supabaseUrl) return c.text("Missing SUPABASE_URL", 500);
      const issuer = new URL("/auth/v1", supabaseUrl).toString();
      ({ payload } = await jwtVerify(token, jwksForProject(supabaseUrl), { issuer }));
    }

    const user = {
      id: String(payload.sub ?? ""),
      email: (payload as any).email as string | undefined,
      role: (payload as any).role as string | undefined,
      claims: payload,
    };
    c.set("user", user);
    return next();
  } catch (err: any) {
    if ((process as any).env?.VITEST_SHOW_LOGS === "true") {
      // eslint-disable-next-line no-console
      console.error("[auth] jwtVerify failed:", err?.message ?? err);
    }
    return c.text("Invalid token", 401);
  }
}