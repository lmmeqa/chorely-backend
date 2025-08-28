import { z } from 'zod';

const Config = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  SUPABASE_JWT_SECRET: z.string().optional(),
  SUPABASE_BUCKET: z.string().default('uploads'),
  SUPABASE_SIGNED_URL_TTL: z.coerce.number().default(3600),
  ALLOWED_ORIGINS: z.string().optional(), // comma-separated
  STRICT_AUTH: z.string().optional(),
});

export type AppConfig = z.infer<typeof Config>;

export function loadConfig(env: Record<string, any>): AppConfig {
  const merged: Record<string, any> = { ...process.env, ...env };
  return Config.parse(merged);
}