// Ported verbatim from the web app (frontend/src/types/fixtures.ts) — pure,
// platform-independent domain types + helpers.

export type CompetitionType = "premier_league" | "champions_league";

export type MatchStatus = "scheduled" | "live" | "finished" | "postponed" | "cancelled";

export interface Team {
  id: string;
  name: string;
  shortName: string;
  code: string;
  logo?: string | null;
  competition: CompetitionType;
}

export interface MatchWithTeams {
  id: string;
  kickoffTime: string;
  homeScore: number | null;
  awayScore: number | null;
  homeRedCards: number;
  awayRedCards: number;
  status: MatchStatus;
  venue?: string | null;
  homeTeam: Team;
  awayTeam: Team;
}

export function isPredictionWindowOpen(deadline: string): boolean {
  return new Date(deadline) > new Date();
}

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
