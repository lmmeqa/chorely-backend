// src/lib/uploads.ts
import { supabase } from './supabase';

const DEFAULT_BUCKET = process.env.SUPABASE_BUCKET || 'uploads';

function sanitize(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Upload a File/Blob/ArrayBuffer to Supabase Storage and return a public URL. */
export async function uploadImageToStorage(
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

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}