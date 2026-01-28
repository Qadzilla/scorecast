// Competition types
export type CompetitionType = "premier_league" | "champions_league";

// Match status
export type MatchStatus = "scheduled" | "live" | "finished" | "postponed" | "cancelled";

// Team
export interface Team {
  id: string;
  name: string;
  shortName: string;
  code: string; // 3-letter code (e.g., "ARS", "CHE")
  logo?: string;
  competition: CompetitionType;
}

// Season
export interface Season {
  id: string;
  name: string; // e.g., "2025-26"
  competition: CompetitionType;
  startDate: string; // ISO date
  endDate: string; // ISO date
  isCurrent: boolean;
}

// Match
export interface Match {
  id: string;
  matchdayId: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoffTime: string; // ISO datetime
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  venue?: string;
}

// Match with team details (for API responses)
export interface MatchWithTeams extends Omit<Match, "homeTeamId" | "awayTeamId"> {
  homeTeam: Team;
  awayTeam: Team;
}

// Matchday - a single day of matches within a gameweek
export interface Matchday {
  id: string;
  gameweekId: string;
  date: string; // ISO date (just the date, no time)
  dayNumber: number; // 1, 2, 3... within the gameweek
}

// Matchday with matches (for API responses)
export interface MatchdayWithMatches extends Matchday {
  matches: MatchWithTeams[];
}

// Gameweek - contains multiple matchdays
// Deadline is calculated as 1 hour before first match of first matchday
export interface Gameweek {
  id: string;
  seasonId: string;
  number: number; // Gameweek 1, 2, 3...
  name?: string; // Optional custom name (e.g., "Boxing Day", "Final Matchday")
  deadline: string; // ISO datetime - 1 hour before first match
  startsAt: string; // ISO datetime - kickoff of first match
  endsAt: string; // ISO datetime - end of last match (estimated)
  status: "upcoming" | "active" | "completed";
}

// Gameweek with matchdays (for API responses)
export interface GameweekWithMatchdays extends Gameweek {
  matchdays: MatchdayWithMatches[];
  season: Season;
}

// Gameweek summary (for list views)
export interface GameweekSummary extends Gameweek {
  matchCount: number;
  completedMatchCount: number;
}

// Helper to check if predictions are still allowed for a gameweek
export function isPredictionWindowOpen(deadline: string): boolean {
  return new Date(deadline) > new Date();
}

// Helper to format countdown
export function getTimeRemaining(deadline: string): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
} {
  const total = new Date(deadline).getTime() - Date.now();
  if (total <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  }
  return {
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / (1000 * 60)) % 60),
    seconds: Math.floor((total / 1000) % 60),
    total,
  };
}
