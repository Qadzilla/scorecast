import { queryAll } from "../db.js";
import { notifyIfAllowed } from "./push.js";
import { pushCopy, type PushKind } from "./pushCopy.js";

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
