import { query, withTransaction } from "../db.js";
import crypto from "crypto";

// football-data.org API
const API_BASE = "https://api.football-data.org/v4";
const API_KEY = process.env.FOOTBALL_DATA_API_KEY;

// Competition IDs in football-data.org
const COMPETITIONS = {
  premier_league: "PL",
  champions_league: "CL",
} as const;

interface ApiTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string; // 3-letter code
  crest: string;
}

interface ApiBooking {
  minute: number;
  team: { id: number };
  player: { id: number; name: string };
  card: "YELLOW" | "RED";
}

interface ApiMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  stage: string;
  homeTeam: ApiTeam;
  awayTeam: ApiTeam;
  score: {
    fullTime: {
      home: number | null;
      away: number | null;
    };
  };
  venue: string | null;
  bookings?: ApiBooking[];
}

interface ApiCompetition {
  id: number;
  name: string;
  currentSeason: {
    id: number;
    startDate: string;
    endDate: string;
    currentMatchday: number;
  };
}

// Helper to make API requests
async function apiRequest<T>(endpoint: string): Promise<T> {
  if (!API_KEY) {
    throw new Error("FOOTBALL_DATA_API_KEY environment variable is not set");
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "X-Auth-Token": API_KEY,
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Football API error: ${res.status} - ${error}`);
  }

  return res.json();
}

// Map API status to our status
function mapMatchStatus(apiStatus: string): string {
  switch (apiStatus) {
    case "SCHEDULED":
    case "TIMED":
      return "scheduled";
    case "IN_PLAY":
    case "PAUSED":
    case "LIVE":
      return "live";
    case "FINISHED":
      return "finished";
    case "POSTPONED":
      return "postponed";
    case "CANCELLED":
    case "SUSPENDED":
      return "cancelled";
    default:
      return "scheduled";
  }
}

// Sync teams for a competition
export async function syncTeams(competition: "premier_league" | "champions_league"): Promise<number> {
  const competitionCode = COMPETITIONS[competition];

  const data = await apiRequest<{ teams: ApiTeam[] }>(
    `/competitions/${competitionCode}/teams`
  );

  const now = new Date().toISOString();

  let count = 0;
  await withTransaction(async (client) => {
    for (const team of data.teams) {
      await client.query(
        `INSERT INTO team (id, name, "shortName", code, logo, competition, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT(id) DO UPDATE SET
          name = EXCLUDED.name,
          "shortName" = EXCLUDED."shortName",
          code = EXCLUDED.code,
          logo = EXCLUDED.logo,
          "updatedAt" = EXCLUDED."updatedAt"`,
        [
          `${competition}-${team.id}`,
          team.name,
          team.shortName || team.name,
          team.tla || team.shortName?.substring(0, 3).toUpperCase() || "???",
          team.crest,
          competition,
          now,
          now
        ]
      );
      count++;
    }
  });

  console.log(`Synced ${count} teams for ${competition}`);
  return count;
}

// Sync season for a competition
export async function syncSeason(competition: "premier_league" | "champions_league"): Promise<string> {
  const competitionCode = COMPETITIONS[competition];

  const data = await apiRequest<ApiCompetition>(
    `/competitions/${competitionCode}`
  );

  const season = data.currentSeason;
  const seasonId = `${competition}-${season.id}`;
  const now = new Date().toISOString();

  // Format season name (e.g., "2025-26")
  const startYear = new Date(season.startDate).getFullYear();
  const endYear = new Date(season.endDate).getFullYear();
  const seasonName = `${startYear}-${String(endYear).slice(-2)}`;

  // Mark all other seasons as not current
  await query(
    `UPDATE season SET "isCurrent" = false, "updatedAt" = $1 WHERE competition = $2`,
    [now, competition]
  );

  // Insert/update current season
  await query(
    `INSERT INTO season (id, name, competition, "startDate", "endDate", "isCurrent", "currentMatchday", "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8)
    ON CONFLICT(id) DO UPDATE SET
      name = EXCLUDED.name,
      "startDate" = EXCLUDED."startDate",
      "endDate" = EXCLUDED."endDate",
      "isCurrent" = true,
      "currentMatchday" = EXCLUDED."currentMatchday",
      "updatedAt" = EXCLUDED."updatedAt"`,
    [seasonId, seasonName, competition, season.startDate, season.endDate, season.currentMatchday, now, now]
  );

  console.log(`Synced season ${seasonName} for ${competition}`);
  return seasonId;
}

// UCL stage ordering and display names
const UCL_STAGE_ORDER: Record<string, number> = {
  LEAGUE_STAGE: 0,
  LEAGUE_STAGE_MATCHDAY_1: 0,
  LEAGUE_STAGE_MATCHDAY_2: 0,
  LEAGUE_STAGE_MATCHDAY_3: 0,
  LEAGUE_STAGE_MATCHDAY_4: 0,
  LEAGUE_STAGE_MATCHDAY_5: 0,
  LEAGUE_STAGE_MATCHDAY_6: 0,
  LEAGUE_STAGE_MATCHDAY_7: 0,
  LEAGUE_STAGE_MATCHDAY_8: 0,
  PLAYOFFS: 1,
  LAST_16: 2,
  QUARTER_FINALS: 3,
  SEMI_FINALS: 4,
  FINAL: 5,
};

// How many matchdays precede each stage (for sequential numbering)
const UCL_STAGE_NUMBER_OFFSET: Record<string, number> = {
  LEAGUE_STAGE: 0,       // matchdays 1-8 → numbers 1-8
  PLAYOFFS: 8,           // matchdays 1-2 → numbers 9-10
  LAST_16: 10,           // matchdays 1-2 → numbers 11-12
  QUARTER_FINALS: 12,    // matchdays 1-2 → numbers 13-14
  SEMI_FINALS: 14,       // matchdays 1-2 → numbers 15-16
  FINAL: 16,             // matchday 1 → number 17
};

const UCL_STAGE_DISPLAY: Record<string, string> = {
  LEAGUE_STAGE: "League Phase",
  PLAYOFFS: "Playoffs",
  LAST_16: "Round of 16",
  QUARTER_FINALS: "Quarter-Finals",
  SEMI_FINALS: "Semi-Finals",
  FINAL: "Final",
};

function normalizeUclStage(stage: string): string {
  // football-data.org may return LEAGUE_STAGE_MATCHDAY_1..8 — normalize to LEAGUE_STAGE
  if (stage.startsWith("LEAGUE_STAGE")) return "LEAGUE_STAGE";
  return stage;
}

function getUclGameweekName(stage: string, matchday: number, totalMatchdaysInStage: number): string {
  const display = UCL_STAGE_DISPLAY[stage] || stage;
  if (stage === "FINAL") return display;
  if (stage === "SEMI_FINALS" && totalMatchdaysInStage <= 1) return display;
  if (stage === "LEAGUE_STAGE") return `${display} - MD ${matchday}`;
  // Knockout rounds with legs
  return `${display} - Leg ${matchday}`;
}

// Sync matches for a competition (creates gameweeks and matchdays as needed)
export async function syncMatches(
  competition: "premier_league" | "champions_league",
  seasonId: string
): Promise<number> {
  const competitionCode = COMPETITIONS[competition];

  const data = await apiRequest<{ matches: ApiMatch[] }>(
    `/competitions/${competitionCode}/matches`
  );

  const isUcl = competition === "champions_league";

  // Group matches by (stage, matchday) for UCL, or just matchday for PL
  interface GameweekGroup {
    stage: string | null;
    matchday: number;
    matches: ApiMatch[];
  }

  const groupKey = (stage: string | null, matchday: number) =>
    isUcl ? `${stage}::${matchday}` : `${matchday}`;

  const groupMap = new Map<string, GameweekGroup>();

  for (const match of data.matches) {
    const matchday = match.matchday;
    const rawStage = match.stage;

    // Handle FINAL with no matchday
    if (isUcl && !matchday && rawStage === "FINAL") {
      const key = groupKey("FINAL", 1);
      if (!groupMap.has(key)) {
        groupMap.set(key, { stage: "FINAL", matchday: 1, matches: [] });
      }
      groupMap.get(key)!.matches.push(match);
      continue;
    }

    if (!matchday) {
      console.log(`Skipping match ${match.id} - no matchday assigned`);
      continue;
    }

    const stage = isUcl ? normalizeUclStage(rawStage) : null;
    const key = groupKey(stage, matchday);

    if (!groupMap.has(key)) {
      groupMap.set(key, { stage, matchday, matches: [] });
    }
    groupMap.get(key)!.matches.push(match);
  }

  // Sort groups: PL by matchday, UCL by stage order then matchday
  const groups = [...groupMap.values()].sort((a, b) => {
    if (isUcl) {
      const stageOrderA = UCL_STAGE_ORDER[a.stage!] ?? 99;
      const stageOrderB = UCL_STAGE_ORDER[b.stage!] ?? 99;
      if (stageOrderA !== stageOrderB) return stageOrderA - stageOrderB;
    }
    return a.matchday - b.matchday;
  });

  // Count matchdays per stage (for UCL name generation)
  const matchdaysPerStage = new Map<string, number>();
  if (isUcl) {
    for (const g of groups) {
      const count = matchdaysPerStage.get(g.stage!) ?? 0;
      matchdaysPerStage.set(g.stage!, count + 1);
    }
  }

  let matchCount = 0;
  const timestamp = new Date().toISOString();

  await withTransaction(async (client) => {
    // For UCL: clean up old-format gameweeks (seasonId-gw1..gw8) that don't include stage in the ID.
    // These were created by the previous sync logic and conflict with new stage-aware IDs.
    if (isUcl) {
      // Collect old-format gameweek IDs (pattern: seasonId-gwN, NOT seasonId-STAGE-gwN)
      const oldGameweeks = await client.query(
        `SELECT id FROM gameweek WHERE "seasonId" = $1 AND id LIKE $2`,
        [seasonId, `${seasonId}-gw%`]
      );
      if (oldGameweeks.rows.length > 0) {
        const oldIds = oldGameweeks.rows.map((r: { id: string }) => r.id);
        console.log(`Cleaning up ${oldIds.length} old-format UCL gameweeks: ${oldIds.join(', ')}`);

        // Delete in FK order: predictions → user_gameweek_scores → matches → matchdays → gameweeks
        await client.query(
          `DELETE FROM prediction WHERE "matchId" IN (
            SELECT m.id FROM match m
            JOIN matchday md ON m."matchdayId" = md.id
            WHERE md."gameweekId" = ANY($1)
          )`, [oldIds]
        );
        await client.query(
          `DELETE FROM user_gameweek_score WHERE "gameweekId" = ANY($1)`, [oldIds]
        );
        await client.query(
          `DELETE FROM match WHERE "matchdayId" IN (
            SELECT md.id FROM matchday md WHERE md."gameweekId" = ANY($1)
          )`, [oldIds]
        );
        await client.query(
          `DELETE FROM matchday WHERE "gameweekId" = ANY($1)`, [oldIds]
        );
        await client.query(
          `DELETE FROM gameweek WHERE id = ANY($1)`, [oldIds]
        );
        console.log(`Cleaned up old-format UCL gameweeks for season ${seasonId}`);
      }
    }

    for (const group of groups) {
      const { stage, matchday, matches } = group;

      // Skip gameweeks where ALL matches have TBD teams (knockout rounds not yet drawn)
      const hasRealMatches = matches.some(m => m.homeTeam?.name && m.awayTeam?.name);
      if (!hasRealMatches) {
        console.log(`Skipping ${stage || 'unknown'} MD${matchday} - all teams TBD`);
        continue;
      }

      // Sort matches by date to find first and last
      matches.sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());

      const firstMatch = matches[0];
      const lastMatch = matches[matches.length - 1];

      // Calculate deadline (1 hour before first match)
      const firstKickoff = new Date(firstMatch!.utcDate);
      const deadline = new Date(firstKickoff.getTime() - 60 * 60 * 1000);

      // Estimate end time (last match + 2 hours)
      const lastKickoff = new Date(lastMatch!.utcDate);
      const endsAt = new Date(lastKickoff.getTime() + 2 * 60 * 60 * 1000);

      // Determine gameweek status
      const now = new Date();
      let status: string;
      if (now < deadline) {
        status = "upcoming";
      } else if (now < endsAt) {
        status = "active";
      } else {
        status = "completed";
      }

      // Compute gameweek number and ID
      let gameweekNum: number;
      let gameweekId: string;
      let gameweekName: string;

      if (isUcl) {
        const offset = UCL_STAGE_NUMBER_OFFSET[stage!] ?? 0;
        gameweekNum = offset + matchday;
        gameweekId = `${seasonId}-${stage}-gw${matchday}`;
        const totalInStage = matchdaysPerStage.get(stage!) ?? 1;
        gameweekName = getUclGameweekName(stage!, matchday, totalInStage);
      } else {
        gameweekNum = matchday;
        gameweekId = `${seasonId}-gw${matchday}`;
        gameweekName = `Gameweek ${matchday}`;
      }

      // Create gameweek
      await client.query(
        `INSERT INTO gameweek (id, "seasonId", number, name, stage, deadline, "startsAt", "endsAt", status, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT(id) DO UPDATE SET
          number = EXCLUDED.number,
          name = EXCLUDED.name,
          stage = EXCLUDED.stage,
          deadline = EXCLUDED.deadline,
          "startsAt" = EXCLUDED."startsAt",
          "endsAt" = EXCLUDED."endsAt",
          status = EXCLUDED.status,
          "updatedAt" = EXCLUDED."updatedAt"`,
        [
          gameweekId,
          seasonId,
          gameweekNum,
          gameweekName,
          stage,
          deadline.toISOString(),
          firstKickoff.toISOString(),
          endsAt.toISOString(),
          status,
          timestamp,
          timestamp
        ]
      );

      // Group matches by date for matchdays
      const matchesByDate = new Map<string, ApiMatch[]>();
      for (const match of matches) {
        const date = match.utcDate.split("T")[0]!;
        if (!matchesByDate.has(date)) {
          matchesByDate.set(date, []);
        }
        matchesByDate.get(date)!.push(match);
      }

      // Create matchdays and matches
      let dayNumber = 1;
      const sortedDates = [...matchesByDate.keys()].sort();

      for (const date of sortedDates) {
        const dayMatches = matchesByDate.get(date)!;
        const matchdayId = `${gameweekId}-day${dayNumber}`;

        await client.query(
          `INSERT INTO matchday (id, "gameweekId", date, "dayNumber", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT(id) DO UPDATE SET
            date = EXCLUDED.date,
            "dayNumber" = EXCLUDED."dayNumber",
            "updatedAt" = EXCLUDED."updatedAt"`,
          [matchdayId, gameweekId, date, dayNumber, timestamp, timestamp]
        );

        // Insert matches
        for (const match of dayMatches) {
          const matchId = `${competition}-match-${match.id}`;
          const homeTeamId = `${competition}-${match.homeTeam.id}`;
          const awayTeamId = `${competition}-${match.awayTeam.id}`;

          // Ensure teams exist (for CL where teams from earlier rounds might not be in current teams list)
          // Skip if team data is incomplete (TBD matches)
          if (!match.homeTeam?.name || !match.awayTeam?.name) {
            console.log(`Skipping match ${match.id} - teams TBD`);
            continue;
          }

          // Ensure home team exists
          await client.query(
            `INSERT INTO team (id, name, "shortName", code, logo, competition, "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT(id) DO NOTHING`,
            [
              homeTeamId,
              match.homeTeam.name,
              match.homeTeam.shortName || match.homeTeam.name,
              match.homeTeam.tla || "???",
              match.homeTeam.crest || null,
              competition,
              timestamp,
              timestamp
            ]
          );

          // Ensure away team exists
          await client.query(
            `INSERT INTO team (id, name, "shortName", code, logo, competition, "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT(id) DO NOTHING`,
            [
              awayTeamId,
              match.awayTeam.name,
              match.awayTeam.shortName || match.awayTeam.name,
              match.awayTeam.tla || "???",
              match.awayTeam.crest || null,
              competition,
              timestamp,
              timestamp
            ]
          );

          // Count red cards from bookings if available
          let homeRedCards = 0;
          let awayRedCards = 0;
          if (match.bookings) {
            for (const booking of match.bookings) {
              if (booking.card === "RED") {
                if (booking.team.id === match.homeTeam.id) {
                  homeRedCards++;
                } else if (booking.team.id === match.awayTeam.id) {
                  awayRedCards++;
                }
              }
            }
          }

          await client.query(
            `INSERT INTO match (id, "matchdayId", "homeTeamId", "awayTeamId", "kickoffTime", "homeScore", "awayScore", status, venue, "homeRedCards", "awayRedCards", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT(id) DO UPDATE SET
              "matchdayId" = EXCLUDED."matchdayId",
              "kickoffTime" = EXCLUDED."kickoffTime",
              "homeScore" = EXCLUDED."homeScore",
              "awayScore" = EXCLUDED."awayScore",
              status = EXCLUDED.status,
              venue = EXCLUDED.venue,
              "homeRedCards" = EXCLUDED."homeRedCards",
              "awayRedCards" = EXCLUDED."awayRedCards",
              "updatedAt" = EXCLUDED."updatedAt"`,
            [
              matchId,
              matchdayId,
              homeTeamId,
              awayTeamId,
              match.utcDate,
              match.score.fullTime.home,
              match.score.fullTime.away,
              mapMatchStatus(match.status),
              match.venue,
              homeRedCards,
              awayRedCards,
              timestamp,
              timestamp
            ]
          );
          matchCount++;
        }

        dayNumber++;
      }
    }
  });

  console.log(`Synced ${matchCount} matches for ${competition}`);
  return matchCount;
}

// Full sync for a competition
export async function syncCompetition(competition: "premier_league" | "champions_league"): Promise<{
  teams: number;
  seasonId: string;
  matches: number;
}> {
  console.log(`Starting full sync for ${competition}...`);

  const teams = await syncTeams(competition);
  const seasonId = await syncSeason(competition);
  const matches = await syncMatches(competition, seasonId);

  console.log(`Completed sync for ${competition}: ${teams} teams, ${matches} matches`);

  return { teams, seasonId, matches };
}

// Sync both competitions
export async function syncAll(): Promise<{
  premier_league: { teams: number; seasonId: string; matches: number };
  champions_league: { teams: number; seasonId: string; matches: number };
}> {
  const pl = await syncCompetition("premier_league");
  // Small delay to respect rate limits
  await new Promise(resolve => setTimeout(resolve, 1000));
  const cl = await syncCompetition("champions_league");

  return {
    premier_league: pl,
    champions_league: cl,
  };
}

// NOTE: Red cards feature requires paid API tier to fetch individual match details
// The database columns and frontend UI are in place - just need to enable this
// when/if the API subscription is upgraded.
//
// To enable: uncomment fetchMatchDetails calls below and the /matches/{id} endpoint
// will return bookings data with red card information.

// Update only match results (for scoring predictions)
export async function updateMatchResults(competition: "premier_league" | "champions_league"): Promise<number> {
  const competitionCode = COMPETITIONS[competition];

  // Get matches from today and recent days
  const data = await apiRequest<{ matches: ApiMatch[] }>(
    `/competitions/${competitionCode}/matches?status=FINISHED&dateFrom=${getDateString(-7)}&dateTo=${getDateString(0)}`
  );

  let updated = 0;

  await withTransaction(async (client) => {
    for (const match of data.matches) {
      const matchId = `${competition}-match-${match.id}`;

      // Always update with latest scores from API
      const result = await client.query(
        `UPDATE match
        SET "homeScore" = $1, "awayScore" = $2, status = 'finished', "updatedAt" = NOW()
        WHERE id = $3 AND ("homeScore" != $1 OR "awayScore" != $2 OR status != 'finished')`,
        [
          match.score.fullTime.home,
          match.score.fullTime.away,
          matchId
        ]
      );
      if ((result.rowCount ?? 0) > 0) {
        updated++;
      }
    }
  });

  console.log(`Updated ${updated} match results for ${competition}`);
  return updated;
}

function getDateString(daysOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split("T")[0]!;
}
