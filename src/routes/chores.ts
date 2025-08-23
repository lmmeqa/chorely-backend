// src/routes/chores.ts
import { Hono } from "hono";
import { z } from "zod";
import { dbFromEnv } from "../lib/db";
import { requireUser } from "../lib/auth";
import { requireHomeMemberByParam, requireHomeMemberByChoreUuid } from "../lib/authorization";
import { chores, todoItems, userHomes } from "../db/schema";
import { and, count, desc, eq } from "drizzle-orm";
import { uploadToStorageReturnPath, createSignedUrlForPath, isStoragePath } from "../lib/uploads";

export const choresRoutes = new Hono();

// ──────────────────────────────────────────────────────────────────────────────
// Schemas
// ──────────────────────────────────────────────────────────────────────────────
const CreateChore = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  time: z.union([z.string().datetime().catch("1970-01-01T00:00:00Z"), z.coerce.date()]),
  icon: z.string().default("circle"),
  home_id: z.string().uuid(),
  points: z.number().int().min(0).default(1),
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /chores  → 201 + seed deterministic todos
// ──────────────────────────────────────────────────────────────────────────────
choresRoutes.post("/chores", requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const body = await c.req.json().catch(() => ({}));
  const data = CreateChore.parse(body);

  const [row] = await db
    .insert(chores)
    .values({
      name: data.name,
      description: typeof data.time === "string" ? data.description : data.description, // keep it simple
      time: new Date((data.time as any) ?? Date.now()),
      icon: data.icon,
      status: "unapproved",
      userEmail: null,
      homeId: data.home_id,
      points: data.points,
    })
    .returning();

  // Seed todos deterministically: Start, Work, Finish (order 0..2)
  const seeds = ["Start", "Work", "Finish"];
  for (let i = 0; i < seeds.length; i++) {
    // Unique on (choreId, order) in schema; ignore if already exists
    try {
      await db.insert(todoItems).values({ choreId: row.uuid, name: seeds[i], order: i });
    } catch {}
  }

  return c.json(row, 201);
});

// Helper to sign a chore's photo on the fly
async function withSignedPhoto(row: any) {
  if (row?.photoUrl && isStoragePath(row.photoUrl)) {
    console.log(`[withSignedPhoto] Processing photoUrl: ${row.photoUrl}`);
    try {
      const url = await createSignedUrlForPath(row.photoUrl);
      console.log(`[withSignedPhoto] Generated signed URL: ${url}`);
      return { ...row, photoUrl: url };
    } catch (e) {
      console.error(`[withSignedPhoto] Failed to sign URL for ${row.photoUrl}:`, e);
      return row; // fall back to raw path if signing fails
    }
  }
  return row;
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /chores/unapproved/:homeId → 200
// ──────────────────────────────────────────────────────────────────────────────
choresRoutes.get("/chores/unapproved/:homeId", requireUser, requireHomeMemberByParam("homeId"), async (c) => {
  const db = dbFromEnv(c.env as any);
  const { homeId } = c.req.param();

  const rows = await db
    .select()
    .from(chores)
    .where(and(eq(chores.homeId, homeId), eq(chores.status, "unapproved")))
    .orderBy(desc(chores.createdAt));
  const signed = await Promise.all(rows.map(withSignedPhoto));
  return c.json(signed);
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /chores/available/:homeId → 200
// ──────────────────────────────────────────────────────────────────────────────
choresRoutes.get("/chores/available/:homeId", requireUser, requireHomeMemberByParam("homeId"), async (c) => {
  const db = dbFromEnv(c.env as any);
  const { homeId } = c.req.param();

  const rows = await db
    .select()
    .from(chores)
    .where(and(eq(chores.homeId, homeId), eq(chores.status, "unclaimed")))
    .orderBy(desc(chores.createdAt));
  const signed = await Promise.all(rows.map(withSignedPhoto));
  return c.json(signed);
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /chores/user?homeId=... → 200 (returns user's claimed chores in that home)
// ──────────────────────────────────────────────────────────────────────────────
choresRoutes.get("/chores/user", requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const u = (c as any).get("user") as { email?: string };
  const homeId = c.req.query("homeId");
  if (!u?.email) return c.json({ error: "auth email required" }, 400);
  if (!homeId) return c.json({ error: "homeId required" }, 400);

  const rows = await db
    .select()
    .from(chores)
    .where(and(eq(chores.homeId, homeId), eq(chores.userEmail, u.email)))
    .orderBy(desc(chores.updatedAt));
  const signed = await Promise.all(rows.map(withSignedPhoto));
  return c.json(signed);
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /chores/:uuid → 200 or 404
// ──────────────────────────────────────────────────────────────────────────────
choresRoutes.get("/chores/:uuid", requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const { uuid } = c.req.param();
  const [row] = await db.select().from(chores).where(eq(chores.uuid, uuid)).limit(1);
  if (!row) return c.json({ error: "not found" }, 404);
  const signed = await withSignedPhoto(row);
  return c.json(signed);
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /chores/count/:homeId → 200 { total, unapproved, unclaimed, claimed, complete }
// ──────────────────────────────────────────────────────────────────────────────
choresRoutes.get("/chores/count/:homeId", requireUser, requireHomeMemberByParam("homeId"), async (c) => {
  const db = dbFromEnv(c.env as any);
  const { homeId } = c.req.param();

  const statuses: (typeof chores.status._.enumValues[number])[] = [
    "unapproved",
    "unclaimed",
    "claimed",
    "complete",
  ];

  const counts: Record<string, number> = { total: 0 } as any;
  for (const s of statuses) {
    const res = await db
      .select({ n: count() })
      .from(chores)
      .where(and(eq(chores.homeId, homeId), eq(chores.status, s)));
    counts[s] = Number(res[0]?.n || 0);
    counts.total += counts[s];
  }

  return c.json(counts);
});

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /chores/:uuid/approve → 204 or 403/404/409
// ──────────────────────────────────────────────────────────────────────────────
choresRoutes.patch("/chores/:uuid/approve", requireUser, requireHomeMemberByChoreUuid("uuid"), async (c) => {
  const db = dbFromEnv(c.env as any);
  const { uuid } = c.req.param();

  const [row] = await db.select().from(chores).where(eq(chores.uuid, uuid)).limit(1);
  if (!row) return c.json({ error: "not found" }, 404);
  if (row.status !== "unapproved") return c.json({ error: "not unapproved" }, 409);

  await db.update(chores).set({ status: "unclaimed", updatedAt: new Date() }).where(eq(chores.uuid, uuid));
  return c.body(null, 204);
});

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /chores/:uuid/claim → 204 or 403/404/409
// ──────────────────────────────────────────────────────────────────────────────
choresRoutes.patch("/chores/:uuid/claim", requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const { uuid } = c.req.param();
  const u = (c as any).get("user") as { email?: string };

  if (!u?.email) return c.json({ error: "Unauthorized" }, 401);

  const [row] = await db.select().from(chores).where(eq(chores.uuid, uuid)).limit(1);
  if (!row) return c.json({ error: "not found" }, 404);
  if (row.status !== "unclaimed") return c.json({ error: "not unclaimed" }, 409);

  await db
    .update(chores)
    .set({ status: "claimed", userEmail: u.email, claimedAt: new Date(), updatedAt: new Date() })
    .where(eq(chores.uuid, uuid));

  return c.body(null, 204);
});

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /chores/:uuid/complete → 204 (403/404/409 on errors)
// Accepts multipart with field `image` and uploads to Supabase Storage. Also works without an image.
// ──────────────────────────────────────────────────────────────────────────────
choresRoutes.patch("/chores/:uuid/complete", requireUser, async (c) => {
  const db = dbFromEnv(c.env as any);
  const { uuid } = c.req.param();
  const u = (c as any).get("user") as { email?: string };
  if (!u?.email) return c.json({ error: "Unauthorized" }, 401);

  const [row] = await db.select().from(chores).where(eq(chores.uuid, uuid)).limit(1);
  if (!row) return c.json({ error: "not found" }, 404);
  if (row.status !== "claimed") return c.json({ error: "not claimed" }, 409);
  if (row.userEmail && row.userEmail !== u.email) return c.json({ error: "forbidden" }, 403);

  // Optional image upload - handle JSON with base64 or multipart data
  const ct = (c.req.header("content-type") || "").toLowerCase();
  let uploadedPath: string | null = null;
  console.log(`[chore complete] Content-Type: ${ct}`);
  
  // Try to parse JSON body first for base64 image data
  let jsonBody: any = null;
  try {
    const bodyText = await c.req.text();
    if (bodyText && ct.includes("application/json")) {
      jsonBody = JSON.parse(bodyText);
      console.log(`[chore complete] Parsed JSON body with keys: ${Object.keys(jsonBody).join(', ')}`);
    }
  } catch (e) {
    console.log(`[chore complete] No valid JSON body found`);
  }
  
  if (jsonBody?.image?.data) {
    // Handle base64 encoded image data
    console.log(`[chore complete] Processing base64 image data`);
    
    try {
      const base64Data = jsonBody.image.data;
      const filename = jsonBody.image.filename || "chore-completion.jpg";
      const imageContentType = jsonBody.image.contentType || "image/jpeg";
      
      console.log(`[chore complete] Base64 data length: ${base64Data.length} chars`);
      
      // Decode base64 to buffer
      const imageBuffer = Buffer.from(base64Data, 'base64');
      console.log(`[chore complete] Decoded binary data - size: ${imageBuffer.length} bytes`);
      
      // Log first few bytes to verify image data integrity
      const firstBytes = imageBuffer.slice(0, 20);
      console.log(`[chore complete] First 20 bytes (hex): ${firstBytes.toString('hex')}`);
      console.log(`[chore complete] Starts with JPEG marker: ${firstBytes[0] === 0xFF && firstBytes[1] === 0xD8}`);
      
      if (imageBuffer.length > 0) {
        console.log(`[chore complete] Processing base64 image upload: ${filename}, size: ${imageBuffer.length}`);
        uploadedPath = await uploadToStorageReturnPath(imageBuffer.buffer.slice(imageBuffer.byteOffset, imageBuffer.byteOffset + imageBuffer.byteLength), {
          prefix: `proofs/chores/${uuid}`,
          filename: filename,
          contentType: imageContentType,
          env: c.env,
        });
        console.log(`[chore complete] Base64 image uploaded successfully to: ${uploadedPath}`);
      } else {
        console.log("[chore complete] Base64 image data is empty");
      }
    } catch (e: any) {
      console.error("[chore complete] base64 image upload failed:", e?.message || e);
      console.error("[chore complete] full error:", e);
    }
  } else {
    console.log(`[chore complete] No image processing - Content-Type: ${ct}`);
  }

  const update: any = { status: "complete", completedAt: new Date(), updatedAt: new Date() };
  if (uploadedPath) update.photoUrl = uploadedPath; // store path

  await db.update(chores).set(update).where(eq(chores.uuid, uuid));

  // Award points to the user (best-effort)
  try {
    const pointsToAward = row.points;
    const [existing] = await db.select().from(userHomes).where(and(eq(userHomes.homeId, row.homeId), eq(userHomes.userEmail, u.email)));
    if (existing) {
      await db
        .update(userHomes)
        .set({ points: existing.points + pointsToAward })
        .where(and(eq(userHomes.homeId, row.homeId), eq(userHomes.userEmail, u.email)));
    }
  } catch (e) {
    console.error("[chore complete] point awarding failed:", e);
  }

  return c.body(null, 204);
});

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /chores/:uuid/verify → 410 Gone
// ──────────────────────────────────────────────────────────────────────────────
choresRoutes.patch("/chores/:uuid/verify", requireUser, async (c) => {
  return c.json(
    {
      error: "The /verify endpoint has been deprecated. Please use /complete instead.",
      message: "Use PATCH /chores/:uuid/complete to complete a chore",
    },
    410
  );
});