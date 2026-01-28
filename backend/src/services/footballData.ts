import { db } from "../db.js";
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
  const insertStmt = db.prepare(`
    INSERT INTO team (id, name, shortName, code, logo, competition, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      shortName = excluded.shortName,
      code = excluded.code,
      logo = excluded.logo,
      updatedAt = excluded.updatedAt
  `);

  let count = 0;
  const transaction = db.transaction(() => {
    for (const team of data.teams) {
      insertStmt.run(
        `${competition}-${team.id}`,
        team.name,
        team.shortName || team.name,
        team.tla || team.shortName?.substring(0, 3).toUpperCase() || "???",
        team.crest,
        competition,
        now,
        now
      );
      count++;
    }
  });

  transaction();
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
  db.prepare(`UPDATE season SET isCurrent = 0, updatedAt = ? WHERE competition = ?`).run(now, competition);

  // Insert/update current season
  db.prepare(`
    INSERT INTO season (id, name, competition, startDate, endDate, isCurrent, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      startDate = excluded.startDate,
      endDate = excluded.endDate,
      isCurrent = 1,
      updatedAt = excluded.updatedAt
  `).run(seasonId, seasonName, competition, season.startDate, season.endDate, now, now);

  console.log(`Synced season ${seasonName} for ${competition}`);
  return seasonId;
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

  // Group matches by matchday (gameweek)
  // Filter out matches without a matchday (TBD knockout rounds)
  const matchesByGameweek = new Map<number, ApiMatch[]>();
  for (const match of data.matches) {
    const gw = match.matchday;
    if (!gw) {
      console.log(`Skipping match ${match.id} - no matchday assigned`);
      continue;
    }
    if (!matchesByGameweek.has(gw)) {
      matchesByGameweek.set(gw, []);
    }
    matchesByGameweek.get(gw)!.push(match);
  }

  let matchCount = 0;
  const timestamp = new Date().toISOString();

  const transaction = db.transaction(() => {
    for (const [gameweekNum, matches] of matchesByGameweek) {
      // Sort matches by date to find first and last
      matches.sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());

      const firstMatch = matches[0];
      const lastMatch = matches[matches.length - 1];

      // Calculate deadline (1 hour before first match)
      const firstKickoff = new Date(firstMatch.utcDate);
      const deadline = new Date(firstKickoff.getTime() - 60 * 60 * 1000);

      // Estimate end time (last match + 2 hours)
      const lastKickoff = new Date(lastMatch.utcDate);
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

      // Create gameweek
      const gameweekId = `${seasonId}-gw${gameweekNum}`;
      db.prepare(`
        INSERT INTO gameweek (id, seasonId, number, name, deadline, startsAt, endsAt, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          deadline = excluded.deadline,
          startsAt = excluded.startsAt,
          endsAt = excluded.endsAt,
          status = excluded.status,
          updatedAt = excluded.updatedAt
      `).run(
        gameweekId,
        seasonId,
        gameweekNum,
        `Gameweek ${gameweekNum}`,
        deadline.toISOString(),
        firstKickoff.toISOString(),
        endsAt.toISOString(),
        status,
        timestamp,
        timestamp
      );

      // Group matches by date for matchdays
      const matchesByDate = new Map<string, ApiMatch[]>();
      for (const match of matches) {
        const date = match.utcDate.split("T")[0];
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

        db.prepare(`
          INSERT INTO matchday (id, gameweekId, date, dayNumber, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            date = excluded.date,
            dayNumber = excluded.dayNumber,
            updatedAt = excluded.updatedAt
        `).run(matchdayId, gameweekId, date, dayNumber, timestamp, timestamp);

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

          const ensureTeamStmt = db.prepare(`
            INSERT INTO team (id, name, shortName, code, logo, competition, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO NOTHING
          `);

          ensureTeamStmt.run(
            homeTeamId,
            match.homeTeam.name,
            match.homeTeam.shortName || match.homeTeam.name,
            match.homeTeam.tla || "???",
            match.homeTeam.crest || null,
            competition,
            timestamp,
            timestamp
          );

          ensureTeamStmt.run(
            awayTeamId,
            match.awayTeam.name,
            match.awayTeam.shortName || match.awayTeam.name,
            match.awayTeam.tla || "???",
            match.awayTeam.crest || null,
            competition,
            timestamp,
            timestamp
          );

          db.prepare(`
            INSERT INTO match (id, matchdayId, homeTeamId, awayTeamId, kickoffTime, homeScore, awayScore, status, venue, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              kickoffTime = excluded.kickoffTime,
              homeScore = excluded.homeScore,
              awayScore = excluded.awayScore,
              status = excluded.status,
              venue = excluded.venue,
              updatedAt = excluded.updatedAt
          `).run(
            matchId,
            matchdayId,
            homeTeamId,
            awayTeamId,
            match.utcDate,
            match.score.fullTime.home,
            match.score.fullTime.away,
            mapMatchStatus(match.status),
            match.venue,
            timestamp,
            timestamp
          );
          matchCount++;
        }

        dayNumber++;
      }
    }
  });

  transaction();
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

// Update only match results (for scoring predictions)
export async function updateMatchResults(competition: "premier_league" | "champions_league"): Promise<number> {
  const competitionCode = COMPETITIONS[competition];

  // Get matches from today and recent days
  const data = await apiRequest<{ matches: ApiMatch[] }>(
    `/competitions/${competitionCode}/matches?status=FINISHED&dateFrom=${getDateString(-7)}&dateTo=${getDateString(0)}`
  );

  let updated = 0;

  const updateStmt = db.prepare(`
    UPDATE match
    SET homeScore = ?, awayScore = ?, status = ?
    WHERE id = ? AND (homeScore IS NULL OR awayScore IS NULL OR status != 'finished')
  `);

  const transaction = db.transaction(() => {
    for (const match of data.matches) {
      const matchId = `${competition}-match-${match.id}`;
      const result = updateStmt.run(
        match.score.fullTime.home,
        match.score.fullTime.away,
        "finished",
        matchId
      );
      if (result.changes > 0) {
        updated++;
      }
    }
  });

  transaction();
  console.log(`Updated ${updated} match results for ${competition}`);
  return updated;
}

function getDateString(daysOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split("T")[0];
}
