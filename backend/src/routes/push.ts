import { Router } from "express";
import crypto from "crypto";
import { query, queryOne } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

const PLATFORMS = ["ios", "android"] as const;
type Platform = (typeof PLATFORMS)[number];

// Register (or re-register) a device's Expo push token for the current user.
// Expo tokens rotate and a token can move between users (device handed on),
// so this upserts on the unique token and always points it at the caller.
router.post("/register", requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user.id;
  const { token, platform } = req.body ?? {};

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Token is required" });
    return;
  }
  if (!PLATFORMS.includes(platform as Platform)) {
    res.status(400).json({ error: "Platform must be 'ios' or 'android'" });
    return;
  }

  try {
    await query(
      `INSERT INTO push_token (id, "userId", token, platform, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (token) DO UPDATE
         SET "userId" = EXCLUDED."userId",
             platform = EXCLUDED.platform,
             "updatedAt" = NOW()`,
      [crypto.randomUUID(), userId, token, platform]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to register push token:", err);
    res.status(500).json({ error: "Failed to register push token" });
  }
});

// Unregister a token (on sign-out / notifications opt-out). Scoped to the
// caller so one user can't delete another's token.
router.delete("/register", requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user.id;
  const { token } = req.body ?? {};

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Token is required" });
    return;
  }

  try {
    await query(`DELETE FROM push_token WHERE token = $1 AND "userId" = $2`, [
      token,
      userId,
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to unregister push token:", err);
    res.status(500).json({ error: "Failed to unregister push token" });
  }
});

export default router;

// Prune tokens Expo reports as no longer valid (DeviceNotRegistered).
// Stubbed here; the sender service (NS*, MOBILE_PLAN.md §4.5) will call it
// with the receipts it gets back from the Expo Push Service.
export async function pruneToken(token: string): Promise<void> {
  await query(`DELETE FROM push_token WHERE token = $1`, [token]);
}

export async function tokensForUser(userId: string): Promise<string[]> {
  const rows = await queryOne<{ tokens: string[] }>(
    `SELECT COALESCE(array_agg(token), '{}') AS tokens
       FROM push_token WHERE "userId" = $1`,
    [userId]
  );
  return rows?.tokens ?? [];
}
