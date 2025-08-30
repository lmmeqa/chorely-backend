import { z } from 'zod';
import { isUuidLoose } from '../http/validators';

export function sanitizeReason(input: unknown): string {
  let s = typeof input === 'string' ? input : (input == null ? '' : String(input));
  // Remove control chars, keep unicode
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  return s;
}

export function parseDisputeCreate(body: any): { choreId: string; reason: string } | { error: string, status: number } {
  const choreId = body?.choreId;
  if (!choreId) return { error: 'choreId required', status: 422 };
  if (!isUuidLoose(choreId)) return { error: 'choreId must be UUID', status: 400 };

  // Reject non-string reasons
  const rawReason = body?.reason;
  if (typeof rawReason !== 'string') {
    return { error: 'reason must be a string', status: 400 };
  }

  // Check for suspicious patterns before sanitization
  if (/<script/i.test(rawReason) || /drop\s+table/i.test(rawReason)) {
    return { error: 'invalid content in reason', status: 400 };
  }
  
  const reason = sanitizeReason(rawReason);
  if (!reason || reason.length < 1) return { error: 'reason required', status: 422 };
  if (reason.length > 500)           return { error: 'reason too long', status: 422 };

  return { choreId, reason };
}

export const DisputeCreate = z.object({
  choreId: z.string().uuid(),
  reason: z.union([z.string(), z.number(), z.null(), z.undefined()])
    .transform(val => String(val || ''))
    .pipe(z.string().trim().min(1).max(500))
    .transform(val => {
      // Basic XSS sanitization
      return val.replace(/<script[^>]*>.*?<\/script>/gi, '')
                .replace(/<[^>]+>/g, '') // Strip HTML tags
                .trim();
    }),
  image: z.object({
    data: z.string().min(1),
    filename: z.string().min(1),
    contentType: z.enum(['image/jpeg','image/jpg','image/png','image/webp'])
  }).optional()
});
