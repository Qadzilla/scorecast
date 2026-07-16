import { Router } from "express";
import { queryOne, query, queryAll } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { sendToUser } from "../services/push.js";
import { pushCopy } from "../services/pushCopy.js";

const router = Router();

// TEMPORARY (NS6 on-device delivery test). Secret-guarded, and only ever
// targets the admin's OWN registered devices — so the blast radius is the
// admin's phone. REMOVE after the delivery test is confirmed.
const NS6_TEST_SECRET = "sc-ns6-9f2a7c4e1b8d6350q";

router.post("/test", async (req, res) => {
  if ((req.body?.secret ?? "") !== NS6_TEST_SECRET) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const adminEmail = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim().toLowerCase();
  if (!adminEmail) {
    res.status(400).json({ error: "no ADMIN_EMAILS configured" });
    return;
  }
  const user = await queryOne<{ id: string }>(`SELECT id FROM "user" WHERE LOWER(email) = $1`, [adminEmail]);
  if (!user) {
    res.status(404).json({ error: "admin user not found" });
    return;
  }
  const tokens = await queryAll<{ token: string }>(`SELECT token FROM push_token WHERE "userId" = $1`, [user.id]);
  const league = await queryOne<{ id: string; name: string }>(
    `SELECT l.id, l.name FROM league l
     JOIN league_member lm ON l.id = lm."leagueId"
     WHERE lm."userId" = $1 ORDER BY lm."joinedAt" DESC LIMIT 1`,
    [user.id]
  );
  const leagueName = league?.name ?? "Your League";
  const data = league ? { leagueId: league.id, screen: "league" } : {};

  // Fire one of each of the 4 types (real copy + delivery path). Direct send —
  // bypasses pref/dedup so the test is repeatable.
  await sendToUser(user.id, "deadline_24h", pushCopy.deadline24h(22, 10, leagueName, "19:30"), data);
  await sendToUser(user.id, "deadline_1h", pushCopy.deadline1h(22, leagueName), data);
  await sendToUser(user.id, "results", pushCopy.resultSingle("ARS", 2, "CHE", 1, 3), data);
  await sendToUser(user.id, "gw_complete", pushCopy.gwComplete(22, leagueName, "2nd", 14), data);

  res.json({ sent: 4, devices: tokens.length, league: league?.id ?? null });
});

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
