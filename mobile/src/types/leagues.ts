import type { CompetitionType, MatchWithTeams } from "./fixtures";

export type LeagueRole = "admin" | "member";

export interface League {
  id: string;
  name: string;
  description: string | null;
  type: CompetitionType;
  inviteCode: string;
  createdBy: string | null;
  createdAt: string;
  role: LeagueRole;
  joinedAt: string;
  memberCount: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  totalPoints: number;
  exactScores: number;
  correctResults: number;
  gameweeksPlayed: number;
  teamLogo: string | null;
}

export interface Leaderboard {
  entries: LeaderboardEntry[];
  isSeasonComplete: boolean;
  champion: LeaderboardEntry | null;
}

// The current-gameweek payload from GET /api/fixtures/gameweek/current/:competition.
export interface CurrentGameweek {
  id: string;
  seasonId: string;
  number: number;
  name: string | null;
  deadline: string;
  startsAt: string;
  endsAt: string;
  status: string;
  isGameweekComplete: boolean;
  totalMatches: number;
  finishedMatches: number;
  nextDeadline: {
    gameweekId: string;
    gameweekNumber: number;
    gameweekName: string;
    deadline: string;
  } | null;
}

// Full gameweek detail from GET /api/fixtures/gameweek/:id — matchdays each
// holding their matches (used by the league-detail Fixtures pane).
export interface Matchday {
  id: string;
  date: string;
  dayNumber: number;
  matches: MatchWithTeams[];
}

export interface GameweekDetail {
  id: string;
  seasonId: string;
  number: number;
  name: string | null;
  deadline: string;
  startsAt: string;
  endsAt: string;
  status: string;
  seasonName: string;
  competition: string;
  matchdays: Matchday[];
}

// The deadline to actually count down to: the current gameweek's if it's still
// in the future, otherwise the next gameweek's. Null when the season is over.
export function upcomingDeadline(gw: CurrentGameweek | undefined): { deadline: string; label: string } | null {
  if (!gw) return null;
  const now = Date.now();
  if (new Date(gw.deadline).getTime() > now) {
    return { deadline: gw.deadline, label: gw.name ?? `Gameweek ${gw.number}` };
  }
  if (gw.nextDeadline) {
    return {
      deadline: gw.nextDeadline.deadline,
      label: gw.nextDeadline.gameweekName ?? `Gameweek ${gw.nextDeadline.gameweekNumber}`,
    };
  }
  return null;
}
