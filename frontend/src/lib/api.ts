const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Generic fetch with credentials
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || "Request failed");
  }

  return res.json();
}

// Fixtures API
export const fixturesApi = {
  // Get current gameweek for a competition
  getCurrentGameweek: (competition: "premier_league" | "champions_league") =>
    apiFetch<{
      id: string;
      seasonId: string;
      number: number;
      name: string | null;
      deadline: string;
      startsAt: string;
      endsAt: string;
      status: string;
    }>(`/api/fixtures/gameweek/current/${competition}`),

  // Get gameweek by ID with matches
  getGameweek: (gameweekId: string) =>
    apiFetch<{
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
      matchdays: Array<{
        id: string;
        date: string;
        dayNumber: number;
        matches: Array<{
          id: string;
          kickoffTime: string;
          homeScore: number | null;
          awayScore: number | null;
          status: string;
          venue: string | null;
          homeTeam: {
            id: string;
            name: string;
            shortName: string;
            code: string;
            logo: string | null;
          };
          awayTeam: {
            id: string;
            name: string;
            shortName: string;
            code: string;
            logo: string | null;
          };
        }>;
      }>;
    }>(`/api/fixtures/gameweek/${gameweekId}`),

  // Get all gameweeks for a season
  getSeasonGameweeks: (seasonId: string) =>
    apiFetch<Array<{
      id: string;
      number: number;
      name: string | null;
      deadline: string;
      startsAt: string;
      endsAt: string;
      status: string;
      matchCount: number;
    }>>(`/api/fixtures/season/${seasonId}/gameweeks`),

  // Get current season for a competition
  getCurrentSeason: (competition: "premier_league" | "champions_league") =>
    apiFetch<{
      id: string;
      name: string;
      competition: string;
      startDate: string;
      endDate: string;
      isCurrent: number;
    }>(`/api/fixtures/season/current/${competition}`),

  // Get all teams for a competition
  getTeams: (competition: "premier_league" | "champions_league") =>
    apiFetch<Array<{
      id: string;
      name: string;
      shortName: string;
      code: string;
      logo: string | null;
      competition: string;
    }>>(`/api/fixtures/teams/${competition}`),
};

// Predictions API
export const predictionsApi = {
  // Get user's predictions for a gameweek in a league
  getPredictions: (leagueId: string, gameweekId: string) =>
    apiFetch<Array<{
      id: string;
      matchId: string;
      predictedHome: number;
      predictedAway: number;
      points: number | null;
      createdAt: string;
      updatedAt: string;
      match: {
        id: string;
        kickoffTime: string;
        homeScore: number | null;
        awayScore: number | null;
        status: string;
        venue: string | null;
        homeTeam: {
          id: string;
          name: string;
          shortName: string;
          code: string;
        };
        awayTeam: {
          id: string;
          name: string;
          shortName: string;
          code: string;
        };
      };
    }>>(`/api/predictions/${leagueId}/gameweek/${gameweekId}`),

  // Submit/update predictions for a gameweek
  submitPredictions: (
    leagueId: string,
    gameweekId: string,
    predictions: Array<{ matchId: string; homeScore: number; awayScore: number }>
  ) =>
    apiFetch<{ success: boolean; message: string }>(
      `/api/predictions/${leagueId}/gameweek/${gameweekId}`,
      {
        method: "POST",
        body: JSON.stringify({ predictions }),
      }
    ),
};

// Leaderboard API
export const leaderboardApi = {
  // Get league leaderboard
  getLeaderboard: (leagueId: string) =>
    apiFetch<{
      entries: Array<{
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
      }>;
      isSeasonComplete: boolean;
      champion: {
        rank: number;
        userId: string;
        username: string;
        firstName: string | null;
        lastName: string | null;
        totalPoints: number;
        teamLogo: string | null;
      } | null;
    }>(`/api/leaderboard/${leagueId}`),

  // Get user's rank in a league
  getUserRank: (leagueId: string, userId: string) =>
    apiFetch<{
      rank: number;
      totalMembers: number;
      userId: string;
      username: string;
      firstName: string | null;
      lastName: string | null;
      totalPoints: number;
      exactScores: number;
      correctResults: number;
    }>(`/api/leaderboard/${leagueId}/user/${userId}`),

  // Get gameweek leaderboard
  getGameweekLeaderboard: (leagueId: string, gameweekId: string) =>
    apiFetch<Array<{
      rank: number;
      userId: string;
      username: string;
      firstName: string | null;
      lastName: string | null;
      gameweekPoints: number;
      exactScores: number;
      correctResults: number;
      predictionsMade: number;
    }>>(`/api/leaderboard/${leagueId}/gameweek/${gameweekId}`),
};
