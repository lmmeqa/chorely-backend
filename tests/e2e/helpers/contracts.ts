import { z } from 'zod';

// Core domain enums kept loose enough to avoid overfitting
export const ChoreStatusSchema = z.enum(['unapproved', 'unclaimed', 'claimed', 'complete']);

// Minimal, forward-compatible shapes with passthrough
export const HomeSchema = z.object({
  id: z.string(),
  name: z.string(),
}).passthrough();

export const HomeUsersSchema = z.array(
  z.object({
    email: z.string().email(),
    name: z.string().optional(),
  }).passthrough()
);

export const WeeklyQuotaSchema = z.object({
  weeklyPointQuota: z.number(),
}).passthrough();

export const ChoreMinimalSchema = z.object({
  uuid: z.string(),
}).passthrough();

export const ChoreArrayMinimalSchema = z.array(ChoreMinimalSchema);

export const ApprovalStatusSchema = z.object({
  status: ChoreStatusSchema,
  votes: z.number().nonnegative(),
  required: z.number().nonnegative(),
  voters: z.array(z.string().email()).optional(),
  total_users: z.number().int().nonnegative().optional(),
}).passthrough();

export const PointsForUserSchema = z.object({
  points: z.number(),
}).passthrough();

export const TodoItemSchema = z.object({
  id: z.string(),
  chore_id: z.string(),
  name: z.string(),
}).passthrough();

export const TodoArraySchema = z.array(TodoItemSchema);

// Helper to assert shapes with good error messages
export function assertMatches<T>(schema: z.ZodType<T>, data: unknown, context: string): asserts data is T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues?.[0];
    const at = issue ? `${issue.path.join('.')}: ${issue.message}` : result.error.message;
    throw new Error(`[contract] ${context} does not match schema: ${at}`);
  }
}


