// src/lib/uploads.ts
import { supabase } from './supabase';

const DEFAULT_BUCKET = process.env.SUPABASE_BUCKET || 'uploads';
const DEFAULT_TTL = Number(process.env.SUPABASE_SIGNED_URL_TTL ?? 60 * 60); // 1 hour

function sanitize(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Upload to Supabase Storage (private bucket) and return the **object path**.
 * We do NOT return a URL here. Use `createSignedUrlForPath` when serving.
 */
export async function uploadToStorageReturnPath(
  file: File | Blob | ArrayBuffer,
  opts: { bucket?: string; prefix: string; filename?: string; contentType?: string }
): Promise<string> {
  const bucket = opts.bucket || DEFAULT_BUCKET;
  const prefix = opts.prefix.replace(/\/$/, '');

  const fname = sanitize(
    opts.filename || (file instanceof File ? file.name : `upload-${Date.now()}.jpg`)
  );
  const path = `${prefix}/${Date.now()}-${fname}`;

  // Coerce to a Blob so it works in Node (undici File) and Workers
  let payload: Blob;
  if (file instanceof File || file instanceof Blob) payload = file;
  else payload = new Blob([file], { type: opts.contentType || 'application/octet-stream' });

  const { error } = await supabase.storage.from(bucket).upload(path, payload, {
    contentType: (payload as any).type || opts.contentType || 'application/octet-stream',
    upsert: false,
  });
  if (error) throw error;

  return path; // store this in DB
}

/** Create a fresh signed URL later for an existing object path. */
export async function createSignedUrlForPath(
  path: string,
  opts?: { bucket?: string; expiresIn?: number }
): Promise<string> {
  const bucket = opts?.bucket || DEFAULT_BUCKET;
  const expiresIn = Math.max(60, Number(opts?.expiresIn ?? DEFAULT_TTL));
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

/** Helper: determine if a stored string looks like a Storage path. */
export function isStoragePath(value: string | null | undefined): value is string {
  if (!value) return false;
  return !/^https?:\/\//i.test(value); // anything not starting with http(s) we treat as path
}