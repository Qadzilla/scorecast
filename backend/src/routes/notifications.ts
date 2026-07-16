import { Router } from "express";
import { queryOne, query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

interface Prefs {
  deadlines: boolean;
  results: boolean;
  updates: boolean;
}

const DEFAULT_PREFS: Prefs = { deadlines: true, results: true, updates: true };

// Current user's notification preferences. Absent row = all-on defaults.
router.get("/prefs", requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  try {
    const row = await queryOne<Prefs>(
      `SELECT deadlines, results, updates FROM notification_pref WHERE user_id = $1`,
      [user.id]
    );
    res.json(row ?? DEFAULT_PREFS);
  } catch (err) {
    console.error("Failed to fetch notification prefs:", err);
    res.status(500).json({ error: "Failed to fetch preferences" });
  }
});

// Upsert preferences. Body: { deadlines, results, updates } (booleans).
router.put("/prefs", requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const body = req.body ?? {};
  const next: Prefs = {
    deadlines: typeof body.deadlines === "boolean" ? body.deadlines : DEFAULT_PREFS.deadlines,
    results: typeof body.results === "boolean" ? body.results : DEFAULT_PREFS.results,
    updates: typeof body.updates === "boolean" ? body.updates : DEFAULT_PREFS.updates,
  };
  try {
    await query(
      `INSERT INTO notification_pref (user_id, deadlines, results, updates, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET deadlines = EXCLUDED.deadlines,
             results = EXCLUDED.results,
             updates = EXCLUDED.updates,
             updated_at = NOW()`,
      [user.id, next.deadlines, next.results, next.updates]
    );
    res.json(next);
  } catch (err) {
    console.error("Failed to update notification prefs:", err);
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

export default router;
