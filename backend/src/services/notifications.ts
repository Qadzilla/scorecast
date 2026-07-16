import { queryAll } from "../db.js";
import { notifyIfAllowed, prefAllows, claimLog, sendToUser } from "./push.js";
import { pushCopy, type PushKind } from "./pushCopy.js";

// Ordinal for gameweek-complete copy ("1st", "2nd", "3rd", "11th"…).
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0] || "th");
}

// NS2 — deadline reminder cron (PUSH_SPEC.md §4). Runs every 30 min. Nudges
// league members who have NOT submitted predictions for a gameweek whose
// deadline is ~24h or ~1h away. Dedup is handled by notifyIfAllowed (push_log),
// so overlapping windows / re-runs never double-send.

// All users are in Jordan (UTC+3); show deadline times in local time.
function localTime(deadline: Date | string): string {
  return new Date(deadline).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Amman",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface WindowGameweek {
  id: string;
  number: number;
  name: string | null;
  deadline: string;
  competition: string;
  matchCount: string;
}

interface LeagueRow {
  id: string;
  name: string;
}

async function remindWindow(kind: PushKind, lower: string, upper: string): Promise<void> {
  const gameweeks = await queryAll<WindowGameweek>(
    `SELECT gw.id, gw.number, gw.name, gw.deadline, s.competition,
       (SELECT COUNT(*) FROM match m
          JOIN matchday md ON m."matchdayId" = md.id
         WHERE md."gameweekId" = gw.id) AS "matchCount"
     FROM gameweek gw
     JOIN season s ON gw."seasonId" = s.id
     WHERE gw.deadline BETWEEN NOW() + $1::interval AND NOW() + $2::interval`,
    [lower, upper]
  );

  for (const gw of gameweeks) {
    const leagues = await queryAll<LeagueRow>(`SELECT id, name FROM league WHERE type = $1`, [
      gw.competition,
    ]);

    for (const league of leagues) {
      // Members of this league with zero predictions for this gameweek.
      const unsubmitted = await queryAll<{ userId: string }>(
        `SELECT lm."userId" FROM league_member lm
         WHERE lm."leagueId" = $1
           AND NOT EXISTS (
             SELECT 1 FROM prediction p
               JOIN match m ON p."matchId" = m.id
               JOIN matchday md ON m."matchdayId" = md.id
             WHERE p."userId" = lm."userId"
               AND p."leagueId" = $1
               AND md."gameweekId" = $2
           )`,
        [league.id, gw.id]
      );

      const message =
        kind === "deadline_24h"
          ? pushCopy.deadline24h(gw.number, Number(gw.matchCount), league.name, localTime(gw.deadline))
          : pushCopy.deadline1h(gw.number, league.name);

      for (const member of unsubmitted) {
        await notifyIfAllowed({
          userId: member.userId,
          kind,
          subjectId: gw.id,
          leagueId: league.id,
          message,
          data: { leagueId: league.id, screen: "league" },
        });
      }
    }
  }
}

export async function runDeadlineReminders(): Promise<void> {
  try {
    await remindWindow("deadline_24h", "23 hours 30 minutes", "24 hours");
    await remindWindow("deadline_1h", "30 minutes", "1 hour");
  } catch (err) {
    console.error("[Reminders] Deadline reminder run failed:", err);
  }
}

// NS3 — results notifications. Called from runResultsUpdate with the matches
// touched this tick. Batches per (user, league): one notification collapsing all
// of the user's newly-scored matches in that league. push_log dedups per match,
// so re-scoring the same match on later ticks sends nothing new.
interface ResultRow {
  userId: string;
  leagueId: string;
  matchId: string;
  points: number;
  homeScore: number;
  awayScore: number;
  homeName: string;
  awayName: string;
}

export async function notifyResults(matchIds: string[]): Promise<void> {
  if (matchIds.length === 0) return;
  try {
    const rows = await queryAll<ResultRow>(
      `SELECT p."userId", p."leagueId", p."matchId", p.points,
              m."homeScore", m."awayScore",
              ht."shortName" AS "homeName", at2."shortName" AS "awayName"
       FROM prediction p
       JOIN match m ON p."matchId" = m.id
       JOIN team ht ON m."homeTeamId" = ht.id
       JOIN team at2 ON m."awayTeamId" = at2.id
       WHERE p."matchId" = ANY($1) AND m.status = 'finished' AND p.points IS NOT NULL`,
      [matchIds]
    );

    const groups = new Map<string, ResultRow[]>();
    for (const r of rows) {
      const key = `${r.userId}::${r.leagueId}`;
      const list = groups.get(key) ?? [];
      list.push(r);
      groups.set(key, list);
    }

    for (const [key, preds] of groups) {
      const [userId, leagueId] = key.split("::") as [string, string];
      if (!(await prefAllows(userId, "results"))) continue;

      const fresh: ResultRow[] = [];
      for (const p of preds) {
        if (await claimLog(userId, "results", p.matchId, leagueId)) fresh.push(p);
      }
      if (fresh.length === 0) continue;

      const total = fresh.reduce((s, p) => s + p.points, 0);
      const one = fresh[0]!;
      const message =
        fresh.length === 1
          ? pushCopy.resultSingle(one.homeName, one.homeScore, one.awayName, one.awayScore, one.points)
          : pushCopy.resultBatch(fresh.length, total);
      await sendToUser(userId, "results", message, { leagueId, screen: "league" });
    }
  } catch (err) {
    console.error("[Results push] failed:", err);
  }
}

// NS3 — gameweek-complete notifications. Fires once per member per league when a
// gameweek's matches are all finished, with that member's gameweek rank + points.
export async function notifyGameweekComplete(): Promise<void> {
  try {
    // Only gameweeks that completed RECENTLY (a match settled in the last 3h) —
    // without this bound, the first run after deploy would notify every member
    // about every historically-completed gameweek. push_log then prevents
    // re-notification once the window passes.
    const complete = await queryAll<{ id: string; number: number; competition: string }>(
      `SELECT gw.id, gw.number, s.competition
       FROM gameweek gw JOIN season s ON gw."seasonId" = s.id
       WHERE EXISTS (SELECT 1 FROM match m JOIN matchday md ON m."matchdayId" = md.id WHERE md."gameweekId" = gw.id)
         AND NOT EXISTS (SELECT 1 FROM match m JOIN matchday md ON m."matchdayId" = md.id
                         WHERE md."gameweekId" = gw.id AND m.status <> 'finished')
         AND EXISTS (SELECT 1 FROM match m JOIN matchday md ON m."matchdayId" = md.id
                     WHERE md."gameweekId" = gw.id AND m."updatedAt" > NOW() - interval '3 hours')`
    );

    for (const gw of complete) {
      const leagues = await queryAll<{ id: string; name: string }>(
        `SELECT id, name FROM league WHERE type = $1`,
        [gw.competition]
      );
      for (const league of leagues) {
        const scores = await queryAll<{ userId: string; pts: string }>(
          `SELECT lm."userId", COALESCE(SUM(p.points), 0)::text AS pts
           FROM league_member lm
           LEFT JOIN prediction p ON p."userId" = lm."userId" AND p."leagueId" = $1
             AND p."matchId" IN (
               SELECT m.id FROM match m JOIN matchday md ON m."matchdayId" = md.id
               WHERE md."gameweekId" = $2
             )
           WHERE lm."leagueId" = $1
           GROUP BY lm."userId"`,
          [league.id, gw.id]
        );

        const ranked = scores
          .map((s) => ({ userId: s.userId, pts: Number(s.pts) }))
          .sort((a, b) => b.pts - a.pts);

        let rank = 0;
        let prevPts: number | null = null;
        let i = 0;
        for (const row of ranked) {
          i++;
          if (prevPts === null || row.pts < prevPts) {
            rank = i;
            prevPts = row.pts;
          }
          if (!(await prefAllows(row.userId, "gw_complete"))) continue;
          if (!(await claimLog(row.userId, "gw_complete", gw.id, league.id))) continue;
          await sendToUser(
            row.userId,
            "gw_complete",
            pushCopy.gwComplete(gw.number, league.name, ordinal(rank), row.pts),
            { leagueId: league.id, screen: "league" }
          );
        }
      }
    }
  } catch (err) {
    console.error("[GW complete push] failed:", err);
  }
}
