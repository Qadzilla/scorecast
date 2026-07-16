import crypto from "crypto";
import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import { query, queryAll, queryOne } from "../db.js";
import type { PushKind, PushMessage } from "./pushCopy.js";

// EXPO_ACCESS_TOKEN is optional (only needed for enhanced push security).
const expo = new Expo(
  process.env.EXPO_ACCESS_TOKEN ? { accessToken: process.env.EXPO_ACCESS_TOKEN } : {}
);

// Under test, sends are captured here instead of hitting Expo (mirrors the
// email testOutbox). Tests assert on this to verify dedup + pref gating.
export interface SentPush {
  userId: string;
  kind: PushKind;
  title: string;
  body: string;
  tokens: string[];
}
export const pushTestOutbox: SentPush[] = [];

// kind → the preference category that gates it (PUSH_SPEC.md §2).
const PREF_COLUMN: Record<PushKind, "deadlines" | "results" | "updates"> = {
  deadline_24h: "deadlines",
  deadline_1h: "deadlines",
  results: "results",
  gw_complete: "updates",
};

// Is this notification category enabled for the user? Absent row = all-on.
export async function prefAllows(userId: string, kind: PushKind): Promise<boolean> {
  const col = PREF_COLUMN[kind];
  const pref = await queryOne<{ allowed: boolean }>(
    `SELECT ${col} AS allowed FROM notification_pref WHERE user_id = $1`,
    [userId]
  );
  return pref ? pref.allowed : true;
}

// Claim the dedup slot for (user, kind, subject, league). Returns true if this
// is the first claim (proceed to send), false if already notified.
export async function claimLog(
  userId: string,
  kind: PushKind,
  subjectId: string,
  leagueId: string
): Promise<boolean> {
  const logged = await queryOne<{ id: string }>(
    `INSERT INTO push_log (id, user_id, kind, subject_id, league_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, kind, subject_id, league_id) DO NOTHING
     RETURNING id`,
    [crypto.randomUUID(), userId, kind, subjectId, leagueId]
  );
  return !!logged;
}

// Send a message to all of a user's devices (or capture to the test outbox).
// Best-effort; never throws.
export async function sendToUser(
  userId: string,
  kind: PushKind,
  message: PushMessage,
  data?: Record<string, unknown>
): Promise<void> {
  const tokens = await tokensForUser(userId);
  if (process.env.NODE_ENV === "test") {
    pushTestOutbox.push({ userId, kind, title: message.title, body: message.body, tokens });
    return;
  }
  if (tokens.length === 0) return;
  await deliver(
    tokens.map((to) => ({
      to,
      sound: "default" as const,
      title: message.title,
      body: message.body,
      data: data ?? {},
    }))
  );
}

async function tokensForUser(userId: string): Promise<string[]> {
  const rows = await queryAll<{ token: string }>(
    `SELECT token FROM push_token WHERE "userId" = $1`,
    [userId]
  );
  return rows.map((r) => r.token);
}

async function pruneToken(token: string): Promise<void> {
  await query(`DELETE FROM push_token WHERE token = $1`, [token]);
}

// Deliver already-built Expo messages: chunk, send, and prune tokens Expo
// reports as DeviceNotRegistered. Never throws (best-effort from cron).
async function deliver(messages: ExpoPushMessage[]): Promise<void> {
  const valid = messages.filter((m) => typeof m.to === "string" && Expo.isExpoPushToken(m.to));
  if (valid.length === 0) return;
  for (const chunk of expo.chunkPushNotifications(valid)) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((t, i) => {
        if (t.status === "error" && t.details?.error === "DeviceNotRegistered") {
          const item = chunk[i];
          const to = item?.to;
          if (typeof to === "string") void pruneToken(to);
        }
      });
    } catch (err) {
      console.error("[Push] send chunk failed:", err);
    }
  }
}

export interface NotifyOptions {
  userId: string;
  kind: PushKind;
  subjectId: string; // gameweekId or matchId
  leagueId: string; // always set → per-(user,league,subject) dedup
  message: PushMessage;
  data?: Record<string, unknown>; // deep-link payload, e.g. { leagueId }
}

/**
 * The single choke point every notification trigger goes through
 * (PUSH_SPEC.md §4): preference gate → push_log dedup → send. Returns true if a
 * push was actually dispatched, false if gated off or already sent. Best-effort;
 * a failure here must never break the caller (cron/scoring).
 */
export async function notifyIfAllowed(opts: NotifyOptions): Promise<boolean> {
  try {
    if (!(await prefAllows(opts.userId, opts.kind))) return false;
    if (!(await claimLog(opts.userId, opts.kind, opts.subjectId, opts.leagueId))) return false;
    await sendToUser(opts.userId, opts.kind, opts.message, opts.data);
    return true;
  } catch (err) {
    console.error("[Push] notifyIfAllowed failed:", err);
    return false;
  }
}
