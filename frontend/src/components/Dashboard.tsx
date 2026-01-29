import { useState, useEffect, useCallback } from "react";
import { signOut, useSession } from "../lib/auth";
import { fixturesApi, predictionsApi, leaderboardApi } from "../lib/api";
import Predictions from "./Predictions";
import type { Gameweek, MatchWithTeams } from "../types/fixtures";
import type { PredictionInput } from "../types/predictions";

type NavItem = "leagues" | "create" | "join" | "account" | "league-detail";

// Helper to calculate time remaining
function getTimeRemaining(deadline: Date | null): { days: number; hours: number; minutes: number; seconds: number } {
  if (!deadline) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const total = deadline.getTime() - Date.now();
  if (total <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  return {
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / (1000 * 60)) % 60),
    seconds: Math.floor((total / 1000) % 60),
  };
}

interface ExtendedUser {
  id: string;
  name: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
}

interface League {
  id: string;
  name: string;
  description: string | null;
  type: "premier_league" | "champions_league";
  inviteCode: string;
  createdBy: string;
  createdAt: string;
  role: string;
  joinedAt: string;
  memberCount: number;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  totalPoints: number;
  teamLogo: string | null;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
// Admin email for UI visibility (set via VITE_ADMIN_EMAIL env var)
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "";

// Demo data
const DEMO_USER: ExtendedUser = {
  id: "demo-user",
  name: "Demo User",
  email: "demo@scorecast.club",
  firstName: "Demo",
  lastName: "User",
  username: "demouser",
};

const DEMO_LEAGUES: League[] = [
  {
    id: "demo-league-1",
    name: "Premier League Fans",
    description: "A demo league for Premier League predictions",
    type: "premier_league",
    inviteCode: "DEMO123",
    createdBy: "demo-user",
    createdAt: new Date().toISOString(),
    role: "member",
    joinedAt: new Date().toISOString(),
    memberCount: 8,
  },
];

const DEMO_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, userId: "1", username: "champion_predictor", firstName: "Alex", lastName: "Smith", totalPoints: 156, teamLogo: "https://crests.football-data.org/57.png" },
  { rank: 2, userId: "2", username: "football_guru", firstName: "Jordan", lastName: "Lee", totalPoints: 142, teamLogo: "https://crests.football-data.org/65.png" },
  { rank: 3, userId: "3", username: "score_master", firstName: "Sam", lastName: "Wilson", totalPoints: 138, teamLogo: "https://crests.football-data.org/61.png" },
  { rank: 4, userId: "demo-user", username: "demouser", firstName: "Demo", lastName: "User", totalPoints: 125, teamLogo: "https://crests.football-data.org/66.png" },
  { rank: 5, userId: "5", username: "pl_expert", firstName: "Casey", lastName: "Brown", totalPoints: 118, teamLogo: "https://crests.football-data.org/73.png" },
];

interface DashboardProps {
  demoMode?: boolean;
  onExitDemo?: () => void;
}

export default function Dashboard({ demoMode = false, onExitDemo }: DashboardProps) {
  const [activeNav, setActiveNav] = useState<NavItem>("leagues");
  const { data: session } = useSession();
  const user = demoMode ? DEMO_USER : (session?.user as ExtendedUser | undefined);

  // Leagues state
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [showPredictionsForm, setShowPredictionsForm] = useState(false);

  // Fixture data state
  const [currentGameweek, setCurrentGameweek] = useState<Gameweek | null>(null);
  const [matches, setMatches] = useState<MatchWithTeams[]>([]);
  const [loadingFixtures, setLoadingFixtures] = useState(false);

  // User predictions state
  const [userPredictions, setUserPredictions] = useState<Record<string, { homeScore: number; awayScore: number; points: number | null }>>({});
  const [loadingPredictions, setLoadingPredictions] = useState(false);

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [isSeasonComplete, setIsSeasonComplete] = useState(false);
  const [champion, setChampion] = useState<LeaderboardEntry | null>(null);

  // Create league form state
  const [createName, setCreateName] = useState("");
  const [createType, setCreateType] = useState<"premier_league" | "champions_league">("premier_league");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState<{ name: string; inviteCode: string } | null>(null);

  // Join league form state
  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState("");

  // Countdown state - fetched from API
  const [plDeadline, setPlDeadline] = useState<Date | null>(null);
  const [uclDeadline, setUclDeadline] = useState<Date | null>(null);
  const [plGameweekNum, setPlGameweekNum] = useState<number | null>(null);
  const [uclGameweekNum, setUclGameweekNum] = useState<number | null>(null);
  const [plCountdown, setPlCountdown] = useState(getTimeRemaining(null));
  const [uclCountdown, setUclCountdown] = useState(getTimeRemaining(null));

  // Favorite team state
  const [favoriteTeam, setFavoriteTeam] = useState<{ id: string; name: string; logo: string | null } | null>(null);

  // Account settings state
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [editingTeam, setEditingTeam] = useState(false);
  const [availableTeams, setAvailableTeams] = useState<{ id: string; name: string; logo: string | null }[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

  // Fetch deadlines from API
  useEffect(() => {
    const fetchDeadlines = async () => {
      try {
        const plGameweek = await fixturesApi.getCurrentGameweek("premier_league");
        setPlDeadline(new Date(plGameweek.deadline));
        setPlGameweekNum(plGameweek.number);
      } catch (err) {
        console.error("Failed to fetch PL deadline:", err);
      }

      try {
        const uclGameweek = await fixturesApi.getCurrentGameweek("champions_league");
        setUclDeadline(new Date(uclGameweek.deadline));
        setUclGameweekNum(uclGameweek.number);
      } catch (err) {
        console.error("Failed to fetch UCL deadline:", err);
      }
    };

    fetchDeadlines();
  }, []);

  // Fetch user's favorite team
  useEffect(() => {
    const fetchFavoriteTeam = async () => {
      try {
        const res = await fetch(`${API_URL}/api/user/favorite-team`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.team) {
            setFavoriteTeam(data.team);
          }
        }
      } catch (err) {
        console.error("Failed to fetch favorite team:", err);
      }
    };

    fetchFavoriteTeam();
  }, []);

  // Update countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      setPlCountdown(getTimeRemaining(plDeadline));
      setUclCountdown(getTimeRemaining(uclDeadline));
    }, 1000);
    return () => clearInterval(timer);
  }, [plDeadline, uclDeadline]);

  // Fetch user's leagues
  const fetchLeagues = async () => {
    if (demoMode) {
      setLeagues(DEMO_LEAGUES);
      setLoadingLeagues(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/leagues`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setLeagues(data);
      }
    } catch (err) {
      console.error("Failed to fetch leagues:", err);
    } finally {
      setLoadingLeagues(false);
    }
  };

  useEffect(() => {
    fetchLeagues();
  }, [demoMode]);

  // Fetch league data when selecting a league
  const fetchLeagueData = useCallback(async (league: League) => {
    setLoadingFixtures(true);
    setLoadingPredictions(true);
    setLoadingLeaderboard(true);

    // Demo mode - use mock data
    if (demoMode) {
      setLeaderboard(DEMO_LEADERBOARD);
      setLoadingLeaderboard(false);
      setLoadingFixtures(false);
      setLoadingPredictions(false);
      setCurrentGameweek({
        id: "demo-gw",
        number: 23,
        name: "Gameweek 23",
        status: "active",
        seasonId: "demo-season",
        deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      setMatches([]);
      setUserPredictions({});
      return;
    }

    try {
      // Fetch current gameweek (basic info)
      const currentGw = await fixturesApi.getCurrentGameweek(league.type);

      // Fetch full gameweek with matchdays
      const fullGameweek = await fixturesApi.getGameweek(currentGw.id);
      setCurrentGameweek({
        ...fullGameweek,
        name: fullGameweek.name || undefined,
        status: fullGameweek.status as "upcoming" | "active" | "completed",
      });

      // Extract matches from matchdays
      const allMatches: MatchWithTeams[] = [];
      for (const matchday of fullGameweek.matchdays) {
        for (const match of matchday.matches) {
          allMatches.push({
            id: match.id,
            matchdayId: matchday.id,
            kickoffTime: match.kickoffTime,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            status: match.status as "scheduled" | "live" | "finished" | "postponed" | "cancelled",
            venue: match.venue || undefined,
            homeTeam: {
              id: match.homeTeam.id,
              name: match.homeTeam.name,
              shortName: match.homeTeam.shortName,
              code: match.homeTeam.code,
              logo: match.homeTeam.logo || undefined,
              competition: league.type,
            },
            awayTeam: {
              id: match.awayTeam.id,
              name: match.awayTeam.name,
              shortName: match.awayTeam.shortName,
              code: match.awayTeam.code,
              logo: match.awayTeam.logo || undefined,
              competition: league.type,
            },
          });
        }
      }
      setMatches(allMatches);
      setLoadingFixtures(false);

      // Fetch user predictions
      try {
        const predictions = await predictionsApi.getPredictions(league.id, currentGw.id);
        const predMap: Record<string, { homeScore: number; awayScore: number; points: number | null }> = {};
        for (const pred of predictions) {
          predMap[pred.matchId] = {
            homeScore: pred.predictedHome,
            awayScore: pred.predictedAway,
            points: pred.points,
          };
        }
        setUserPredictions(predMap);
      } catch (err) {
        console.error("Failed to fetch predictions:", err);
        setUserPredictions({});
      }
      setLoadingPredictions(false);

      // Fetch leaderboard
      try {
        const lb = await leaderboardApi.getLeaderboard(league.id);
        setLeaderboard(lb.entries.slice(0, 5)); // Top 5
        setIsSeasonComplete(lb.isSeasonComplete);
        setChampion(lb.champion);
      } catch (err) {
        console.error("Failed to fetch leaderboard:", err);
        setLeaderboard([]);
        setIsSeasonComplete(false);
        setChampion(null);
      }
      setLoadingLeaderboard(false);
    } catch (err) {
      console.error("Failed to fetch league data:", err);
      setLoadingFixtures(false);
      setLoadingPredictions(false);
      setLoadingLeaderboard(false);
    }
  }, []);

  // Fetch data when league is selected
  useEffect(() => {
    if (selectedLeague && activeNav === "league-detail") {
      fetchLeagueData(selectedLeague);
    }
  }, [selectedLeague, activeNav, fetchLeagueData]);

  const handleSignOut = async () => {
    await signOut();
  };

  // Create league handler
  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess(null);

    if (!createName.trim()) {
      setCreateError("League name is required");
      return;
    }

    setCreateLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/leagues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: createName.trim(),
          type: createType,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setCreateError(data.error || "Failed to create league");
        return;
      }

      setCreateSuccess({ name: data.name, inviteCode: data.inviteCode });
      setCreateName("");
      setCreateType("premier_league");
      fetchLeagues();
    } catch {
      setCreateError("An unexpected error occurred");
    } finally {
      setCreateLoading(false);
    }
  };

  // Join league handler
  const handleJoinLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError("");

    if (!joinCode.trim()) {
      setJoinError("Invite code is required");
      return;
    }

    setJoinLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/leagues/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ inviteCode: joinCode.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setJoinError(data.error || "Failed to join league");
        return;
      }

      setJoinCode("");
      setJoinError("");
      fetchLeagues();
      setActiveNav("leagues");
    } catch {
      setJoinError("An unexpected error occurred");
    } finally {
      setJoinLoading(false);
    }
  };

  // Submit predictions handler
  const handleSubmitPredictions = async (predictions: PredictionInput[]) => {
    if (!selectedLeague || !currentGameweek) return;

    await predictionsApi.submitPredictions(selectedLeague.id, currentGameweek.id, predictions);

    // Update local state
    const predMap: Record<string, { homeScore: number; awayScore: number; points: number | null }> = {};
    for (const pred of predictions) {
      predMap[pred.matchId] = {
        homeScore: pred.homeScore,
        awayScore: pred.awayScore,
        points: null,
      };
    }
    setUserPredictions(predMap);
    setShowPredictionsForm(false);
  };

  const isDeadlinePassed = currentGameweek ? new Date(currentGameweek.deadline) <= new Date() : true;

  // Fetch available teams for team selector
  const fetchTeams = async () => {
    if (availableTeams.length > 0) return; // Already fetched
    setTeamsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/user/teams`, {
        credentials: "include",
      });
      if (res.ok) {
        const teams = await res.json();
        setAvailableTeams(teams);
      }
    } catch (err) {
      console.error("Failed to fetch teams:", err);
    } finally {
      setTeamsLoading(false);
    }
  };

  // Update username handler
  const handleUpdateUsername = async () => {
    if (!newUsername.trim()) {
      setUsernameError("Username is required");
      return;
    }

    setUsernameLoading(true);
    setUsernameError("");

    try {
      const res = await fetch(`${API_URL}/api/user/username`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: newUsername.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setUsernameError(data.error || "Failed to update username");
        return;
      }

      // Refresh the page to get updated session
      window.location.reload();
    } catch {
      setUsernameError("An unexpected error occurred");
    } finally {
      setUsernameLoading(false);
    }
  };

  // Update favorite team handler
  const handleUpdateTeam = async (teamId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/user/favorite-team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ teamId }),
      });

      if (res.ok) {
        const data = await res.json();
        setFavoriteTeam(data.team);
        setEditingTeam(false);
      }
    } catch (err) {
      console.error("Failed to update team:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Demo Mode Banner */}
      {demoMode && (
        <div className="bg-gradient-to-r from-[#00ff87] to-[#60efff] text-gray-900 text-center py-2 px-4 font-medium">
          You're viewing the demo. This is sample data.{" "}
          <button onClick={onExitDemo} className="underline font-bold hover:no-underline">
            Sign up to create your own leagues!
          </button>
        </div>
      )}
      {/* Header */}
      <header
        className="h-32 flex items-center justify-between px-6"
        style={{
          background: activeNav === "league-detail" && selectedLeague
            ? selectedLeague.type === "premier_league"
              ? "#3d195b"
              : "#04065c"
            : "linear-gradient(to right, #3d195b 0%, #3d195b 45%, #21105c 52%, #04065c 58%, #04065c 100%)",
        }}
      >
        <h1 className="text-5xl font-bold text-white">ScoreCast</h1>
        <div className="flex items-center gap-5">
          <span className="text-white/70 text-lg">
            {user?.username || user?.email}
          </span>
          {favoriteTeam?.logo ? (
            <img
              src={favoriteTeam.logo}
              alt={favoriteTeam.name}
              className="w-12 h-12 object-contain"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#00ff87] flex items-center justify-center text-gray-900 font-semibold text-xl">
              {user?.firstName?.charAt(0).toUpperCase() || user?.name?.charAt(0).toUpperCase() || "U"}
            </div>
          )}
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-[calc(100vh-8rem)] bg-white border-r border-gray-200">
          <nav className="p-4 space-y-1">
            {/* My Leagues Section */}
            <button
              onClick={() => {
                setSelectedLeague(null);
                setActiveNav("leagues");
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeNav === "leagues" && !selectedLeague
                  ? "bg-[#00ff87]/20 text-[#00915c] font-semibold"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15c-3 0-5-2-5-5V4h10v6c0 3-2 5-5 5zm0 0v4m0 0H9m3 0h3M7 4H4v3a3 3 0 003 3m10-6h3v3a3 3 0 01-3 3" />
              </svg>
              <span className="font-medium">My Leagues</span>
            </button>

            {/* Individual Leagues (nested under My Leagues) */}
            {leagues.length > 0 && (
              <div className="ml-4 space-y-1">
                {leagues.map((league) => (
                  <button
                    key={league.id}
                    onClick={() => {
                      setSelectedLeague(league);
                      setActiveNav("league-detail");
                      setShowPredictionsForm(false);
                    }}
                    className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg text-left transition-colors text-sm ${
                      selectedLeague?.id === league.id
                        ? "bg-[#00ff87]/20 text-[#00915c] font-semibold"
                        : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${
                      league.type === "premier_league" ? "bg-[#3d195b]" : "bg-[#04065c]"
                    }`} />
                    <span className="truncate">{league.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Other Nav Items */}
            {user?.email === ADMIN_EMAIL && (
              <button
                onClick={() => setActiveNav("create")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  activeNav === "create"
                    ? "bg-[#00ff87]/20 text-[#00915c] font-semibold"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="font-medium">Create League</span>
              </button>
            )}

            <button
              onClick={() => setActiveNav("join")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeNav === "join"
                  ? "bg-[#00ff87]/20 text-[#00915c] font-semibold"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <span className="font-medium">Join League</span>
            </button>

            <button
              onClick={() => setActiveNav("account")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeNav === "account"
                  ? "bg-[#00ff87]/20 text-[#00915c] font-semibold"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="font-medium">Account</span>
            </button>
          </nav>

          {/* Logout/Exit Demo button at bottom */}
          <div className="absolute bottom-0 w-64 p-4 border-t border-gray-200">
            {demoMode ? (
              <button
                onClick={onExitDemo}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-[#00ff87] to-[#60efff] text-gray-900 hover:opacity-90 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                <span className="font-medium">Exit Demo</span>
              </button>
            ) : (
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="font-medium">Log Out</span>
              </button>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {activeNav === "leagues" && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">My Leagues</h2>

              {loadingLeagues ? (
                <div className="bg-white rounded-xl p-8 text-center border border-gray-200 shadow-sm">
                  <p className="text-gray-500">Loading leagues...</p>
                </div>
              ) : leagues.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center border border-gray-200 shadow-sm">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#00ff87]/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-[#00915c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15c-3 0-5-2-5-5V4h10v6c0 3-2 5-5 5zm0 0v4m0 0H9m3 0h3M7 4H4v3a3 3 0 003 3m10-6h3v3a3 3 0 01-3 3" />
                    </svg>
                  </div>
                  <p className="text-gray-500 mb-4">You haven't joined any leagues yet.</p>
                  <div className="flex gap-3 justify-center">
                    {user?.email === ADMIN_EMAIL && (
                      <button
                        onClick={() => setActiveNav("create")}
                        className="px-6 py-2 bg-[#00ff87] text-gray-900 font-semibold rounded-lg hover:bg-[#00e67a] transition-colors"
                      >
                        Create League
                      </button>
                    )}
                    <button
                      onClick={() => setActiveNav("join")}
                      className="px-6 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Join League
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="p-6 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">Leaderboard Snapshot</h3>
                    <p className="text-sm text-gray-500 mt-1">Your ranking across all leagues</p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {leagues.map((league, index) => (
                      <div
                        key={league.id}
                        className="p-4 flex items-center gap-4"
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                          league.type === "premier_league" ? "bg-[#3d195b]" : "bg-[#04065c]"
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{league.name}</p>
                          <p className="text-xs text-gray-500">
                            {league.memberCount} member{league.memberCount !== 1 ? "s" : ""} • {league.role}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">--</p>
                          <p className="text-xs text-gray-500">points</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 bg-gray-50 rounded-b-xl">
                    <p className="text-xs text-gray-500 text-center">Select a league from the sidebar to view full standings</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeNav === "create" && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Create League</h2>
              <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm">
                {createSuccess ? (
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#00ff87]/20 flex items-center justify-center">
                      <svg className="w-8 h-8 text-[#00915c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">League Created!</h3>
                    <p className="text-gray-500 mb-4">"{createSuccess.name}" has been created.</p>
                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                      <p className="text-sm text-gray-500 mb-1">Share this invite code:</p>
                      <p className="font-mono text-2xl font-bold text-gray-900">{createSuccess.inviteCode}</p>
                    </div>
                    <button
                      onClick={() => {
                        setCreateSuccess(null);
                        setActiveNav("leagues");
                      }}
                      className="px-6 py-2 bg-[#00ff87] text-gray-900 font-semibold rounded-lg hover:bg-[#00e67a] transition-colors"
                    >
                      View My Leagues
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#00ff87]/20 flex items-center justify-center">
                      <svg className="w-8 h-8 text-[#00915c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <p className="text-gray-500 mb-6">Create a new league and invite your friends to compete.</p>
                    <form onSubmit={handleCreateLeague} className="max-w-sm mx-auto space-y-4">
                      {createError && (
                        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                          {createError}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setCreateType("premier_league")}
                          className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                            createType === "premier_league"
                              ? "bg-[#3d195b] text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          Premier League
                        </button>
                        <button
                          type="button"
                          onClick={() => setCreateType("champions_league")}
                          className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                            createType === "champions_league"
                              ? "bg-[#04065c] text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          Champions League
                        </button>
                      </div>
                      <div>
                        <input
                          type="text"
                          value={createName}
                          onChange={(e) => setCreateName(e.target.value)}
                          placeholder="League Name"
                          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[#00ff87] focus:ring-1 focus:ring-[#00ff87] outline-none transition-colors text-center"
                          maxLength={100}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={createLoading}
                        className="w-full py-3 bg-[#00ff87] text-gray-900 font-semibold rounded-lg hover:bg-[#00e67a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {createLoading ? "Creating..." : "Create League"}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeNav === "join" && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Join League</h2>
              <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#00ff87]/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-[#00915c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 mb-6">Enter an invite code to join an existing league.</p>
                  <form onSubmit={handleJoinLeague} className="max-w-sm mx-auto space-y-4">
                    {joinError && (
                      <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                        {joinError}
                      </div>
                    )}
                    <div>
                      <input
                        type="text"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="Invite Code"
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[#00ff87] focus:ring-1 focus:ring-[#00ff87] outline-none transition-colors font-mono text-center text-lg tracking-wider"
                        maxLength={8}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={joinLoading}
                      className="w-full py-3 bg-[#00ff87] text-gray-900 font-semibold rounded-lg hover:bg-[#00e67a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {joinLoading ? "Joining..." : "Join League"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {activeNav === "league-detail" && selectedLeague && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                {showPredictionsForm && (
                  <button
                    onClick={() => setShowPredictionsForm(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                <h2 className="text-2xl font-bold text-gray-900">{selectedLeague.name}</h2>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  selectedLeague.type === "premier_league"
                    ? "bg-[#3d195b] text-white"
                    : "bg-[#04065c] text-white"
                }`}>
                  {selectedLeague.type === "premier_league" ? "Premier League" : "Champions League"}
                </span>
              </div>

              {loadingFixtures ? (
                <div className="bg-white rounded-xl p-8 text-center border border-gray-200 shadow-sm">
                  <p className="text-gray-500">Loading fixtures...</p>
                </div>
              ) : showPredictionsForm && currentGameweek ? (
                /* Full Predictions Form */
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                  <Predictions
                    gameweek={currentGameweek}
                    matches={matches}
                    existingPredictions={userPredictions}
                    onSubmit={handleSubmitPredictions}
                    isDeadlinePassed={isDeadlinePassed}
                    leagueType={selectedLeague.type}
                  />
                </div>
              ) : (
                /* Dashboard View */
                <div className="space-y-6">
                  {/* Season Complete - Champion Banner */}
                  {isSeasonComplete && champion && (
                    <div
                      className="rounded-xl p-8 text-center text-white relative overflow-hidden"
                      style={{
                        background: selectedLeague?.type === "premier_league"
                          ? "linear-gradient(135deg, #3d195b 0%, #6b2d8a 50%, #3d195b 100%)"
                          : "linear-gradient(135deg, #04065c 0%, #1a237e 50%, #04065c 100%)",
                      }}
                    >
                      {/* Decorative elements */}
                      <div className="absolute top-0 left-0 w-full h-full opacity-10">
                        <div className="absolute top-4 left-8 text-6xl">&#9733;</div>
                        <div className="absolute top-8 right-12 text-4xl">&#9733;</div>
                        <div className="absolute bottom-4 left-16 text-3xl">&#9733;</div>
                        <div className="absolute bottom-8 right-8 text-5xl">&#9733;</div>
                      </div>

                      <div className="relative z-10">
                        <div className="text-5xl mb-3">&#128081;</div>
                        <h3 className="text-2xl font-bold mb-2">Season Complete!</h3>
                        <p className="text-white/80 mb-4">
                          {selectedLeague?.type === "premier_league" ? "Premier League" : "Champions League"} Champion
                        </p>

                        <div className="inline-flex items-center gap-4 bg-white/20 backdrop-blur-sm rounded-xl px-6 py-4">
                          {champion.teamLogo ? (
                            <img src={champion.teamLogo} alt="" className="w-16 h-16 object-contain" />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-yellow-400 flex items-center justify-center text-2xl">
                              &#128081;
                            </div>
                          )}
                          <div className="text-left">
                            <p className="text-2xl font-bold">{champion.username || champion.firstName || "Champion"}</p>
                            <p className="text-white/80">{champion.totalPoints} points</p>
                          </div>
                        </div>

                        {champion.userId === user?.id && (
                          <p className="mt-4 text-yellow-300 font-semibold text-lg">
                            Congratulations! You are the champion! &#127942;
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Top Row - 3 columns */}
                  <div className="grid grid-cols-3 gap-6">
                    {/* Leaderboard */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm min-h-[600px] max-h-[600px] overflow-y-auto flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-gray-900">Leaderboard</h3>
                          {isSeasonComplete && (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                              Final
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-500">Points</span>
                      </div>
                      {loadingLeaderboard ? (
                        <p className="text-gray-500 text-sm">Loading...</p>
                      ) : leaderboard.length === 0 ? (
                        <p className="text-gray-500 text-sm">No standings yet</p>
                      ) : (
                        <div className="space-y-3 flex-1">
                          {leaderboard.map((entry) => (
                            <div
                              key={entry.userId}
                              className={`flex items-center gap-3 p-3 rounded-lg ${
                                entry.userId === user?.id ? "bg-[#00ff87]/10" : ""
                              }`}
                            >
                              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                entry.rank === 1 ? "bg-yellow-400 text-yellow-900" :
                                entry.rank === 2 ? "bg-gray-300 text-gray-700" :
                                entry.rank === 3 ? "bg-orange-300 text-orange-900" :
                                "bg-gray-100 text-gray-600"
                              }`}>
                                {isSeasonComplete && entry.rank === 1 ? "👑" : entry.rank}
                              </span>
                              <span className={`flex-1 flex items-center gap-2 ${entry.userId === user?.id ? "font-semibold" : ""}`}>
                                {entry.username || entry.firstName || "Anonymous"}
                                {entry.teamLogo && (
                                  <img src={entry.teamLogo} alt="" className="w-5 h-5 object-contain" />
                                )}
                              </span>
                              <span className="font-bold text-gray-900 text-lg">{entry.totalPoints}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* My Predictions Summary */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm min-h-[600px] max-h-[600px] flex flex-col">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">My Predictions</h3>
                      <div className="flex-1 overflow-y-auto">
                        {loadingPredictions ? (
                          <p className="text-gray-500 text-sm">Loading...</p>
                        ) : Object.keys(userPredictions).length > 0 ? (
                          /* Show predictions list */
                          <div className="space-y-2">
                            {matches.map((match) => {
                              const pred = userPredictions[match.id];
                              return (
                                <div key={match.id} className="flex items-center text-sm py-2 border-b border-gray-100 last:border-0">
                                  <div className="flex-1 flex items-center justify-end gap-2">
                                    <span className="font-medium">{match.homeTeam.code}</span>
                                    {match.homeTeam.logo && (
                                      <img src={match.homeTeam.logo} alt={match.homeTeam.name} className="w-5 h-5 object-contain" />
                                    )}
                                  </div>
                                  {pred ? (
                                    <span className="px-3 font-bold" style={{ color: selectedLeague.type === "premier_league" ? "#3d195b" : "#04065c" }}>
                                      {pred.homeScore} - {pred.awayScore}
                                    </span>
                                  ) : (
                                    <span className="px-3 text-gray-300">- - -</span>
                                  )}
                                  <div className="flex-1 flex items-center gap-2">
                                    {match.awayTeam.logo && (
                                      <img src={match.awayTeam.logo} alt={match.awayTeam.name} className="w-5 h-5 object-contain" />
                                    )}
                                    <span className="font-medium">{match.awayTeam.code}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          /* No predictions yet */
                          <div className="text-center py-8">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                            </div>
                            <p className="text-gray-500">No predictions yet</p>
                            <p className="text-gray-400 text-sm mt-1">Make your predictions before the deadline</p>
                          </div>
                        )}
                      </div>
                      {/* Only show button if deadline hasn't passed */}
                      {!isDeadlinePassed && (
                        <button
                          onClick={() => setShowPredictionsForm(true)}
                          className="mt-4 w-full py-3 rounded-lg font-semibold text-white transition-colors"
                          style={{ backgroundColor: selectedLeague.type === "premier_league" ? "#3d195b" : "#04065c" }}
                        >
                          {Object.keys(userPredictions).length > 0 ? "Edit Predictions" : "Make Predictions"}
                        </button>
                      )}
                      {isDeadlinePassed && (
                        <p className="mt-4 text-center text-sm text-gray-500">
                          Predictions locked
                        </p>
                      )}
                    </div>

                    {/* Gameweek Fixtures */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm min-h-[600px] max-h-[600px] overflow-y-auto">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        {currentGameweek ? `Gameweek ${currentGameweek.number}` : "Fixtures"}
                      </h3>
                      {matches.length === 0 ? (
                        <p className="text-gray-500 text-sm">No fixtures available</p>
                      ) : (
                        <div className="space-y-2">
                          {matches.map((match) => (
                            <div key={match.id} className="flex items-center text-sm py-2 border-b border-gray-100 last:border-0">
                              <div className="w-20 text-xs text-gray-500 text-left">
                                <div>{new Date(match.kickoffTime).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</div>
                                <div>{new Date(match.kickoffTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</div>
                              </div>
                              <div className="flex-1 flex items-center justify-end gap-2">
                                <span className="font-medium">{match.homeTeam.code}</span>
                                {match.homeTeam.logo && (
                                  <img src={match.homeTeam.logo} alt={match.homeTeam.name} className="w-6 h-6 object-contain" />
                                )}
                              </div>
                              {match.status === "finished" ? (
                                <span className="px-3 font-bold text-gray-900">
                                  {match.homeScore} - {match.awayScore}
                                </span>
                              ) : (
                                <span className="px-3 text-gray-400">vs</span>
                              )}
                              <div className="flex-1 flex items-center gap-2">
                                {match.awayTeam.logo && (
                                  <img src={match.awayTeam.logo} alt={match.awayTeam.name} className="w-6 h-6 object-contain" />
                                )}
                                <span className="font-medium">{match.awayTeam.code}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Row - League Info */}
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">League Info</h3>
                    <div className="grid grid-cols-4 gap-6">
                      <div>
                        <p className="text-sm text-gray-500">Members</p>
                        <p className="text-gray-900 font-medium">{selectedLeague.memberCount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Your Role</p>
                        <p className="text-gray-900 font-medium capitalize">{selectedLeague.role}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Created</p>
                        <p className="text-gray-900 font-medium">
                          {new Date(selectedLeague.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Joined</p>
                        <p className="text-gray-900 font-medium">
                          {new Date(selectedLeague.joinedAt).toLocaleDateString()}
                        </p>
                      </div>
                      {user?.email === ADMIN_EMAIL && (
                        <div>
                          <p className="text-sm text-gray-500">Invite Code</p>
                          <p className="text-gray-900 font-mono font-medium">{selectedLeague.inviteCode}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeNav === "account" && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Account Settings</h2>

              {/* Profile Section */}
              <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Profile</h3>

                {/* Favorite Team */}
                <div className="mb-6">
                  <label className="block text-gray-500 text-sm mb-2">Favorite Team</label>
                  {editingTeam ? (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-3">Select your favorite team:</p>
                      {teamsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <p className="text-gray-500">Loading teams...</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-5 gap-3 max-h-72 overflow-y-auto p-1">
                          {availableTeams.map((team) => (
                            <button
                              key={team.id}
                              onClick={() => handleUpdateTeam(team.id)}
                              className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 hover:shadow-md ${
                                favoriteTeam?.id === team.id
                                  ? "border-[#3d195b] bg-white shadow-md"
                                  : "border-transparent bg-white hover:border-gray-200"
                              }`}
                            >
                              {team.logo ? (
                                <img src={team.logo} alt={team.name} className="w-12 h-12 object-contain" />
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-gray-200" />
                              )}
                              <span className="text-xs text-gray-700 text-center line-clamp-2 leading-tight">{team.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => setEditingTeam(false)}
                        className="mt-4 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-white transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      {favoriteTeam?.logo ? (
                        <img src={favoriteTeam.logo} alt={favoriteTeam.name} className="w-14 h-14 object-contain" />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                      <div>
                        <p className="text-gray-900 font-medium text-lg">{favoriteTeam?.name || "No team selected"}</p>
                        <p className="text-gray-500 text-sm">Your favorite team badge</p>
                      </div>
                      <button
                        onClick={() => {
                          fetchTeams();
                          setEditingTeam(true);
                        }}
                        className="px-4 py-2 bg-[#3d195b] text-white text-sm font-medium rounded-lg hover:bg-[#2d1245] transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Change
                      </button>
                    </div>
                  )}
                </div>

                {/* Username */}
                <div className="mb-6">
                  <label className="block text-gray-500 text-sm mb-2">Username</label>
                  {editingUsername ? (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          placeholder="Enter new username"
                          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 focus:border-[#3d195b] focus:ring-2 focus:ring-[#3d195b]/20 outline-none transition-all"
                        />
                        <button
                          onClick={handleUpdateUsername}
                          disabled={usernameLoading}
                          className="px-5 py-2.5 bg-[#3d195b] text-white font-medium rounded-lg hover:bg-[#2d1245] disabled:opacity-50 transition-colors"
                        >
                          {usernameLoading ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => {
                            setEditingUsername(false);
                            setUsernameError("");
                            setNewUsername("");
                          }}
                          className="px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                      {usernameError && (
                        <p className="mt-3 text-red-500 text-sm">{usernameError}</p>
                      )}
                      <p className="mt-3 text-gray-500 text-sm">3-20 characters, letters, numbers, and underscores only</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-gray-900 font-medium text-lg">{user?.username || "Not set"}</p>
                        <p className="text-gray-500 text-sm">Your display name</p>
                      </div>
                      <button
                        onClick={() => {
                          setNewUsername(user?.username || "");
                          setEditingUsername(true);
                        }}
                        className="px-4 py-2 bg-[#3d195b] text-white text-sm font-medium rounded-lg hover:bg-[#2d1245] transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Account Info Section */}
              <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Account Information</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-gray-500 text-sm mb-1">First Name</label>
                    <p className="text-gray-900">{user?.firstName || "Not set"}</p>
                  </div>
                  <div>
                    <label className="block text-gray-500 text-sm mb-1">Last Name</label>
                    <p className="text-gray-900">{user?.lastName || "Not set"}</p>
                  </div>
                  <div>
                    <label className="block text-gray-500 text-sm mb-1">Email</label>
                    <p className="text-gray-900">{user?.email}</p>
                  </div>
                  <div>
                    <label className="block text-gray-500 text-sm mb-1">User ID</label>
                    <p className="text-gray-900 font-mono text-sm">{user?.id}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Right Sidebar - Countdown Timers (only for league sections) */}
        {activeNav !== "account" && (
          <aside className="w-72 min-h-[calc(100vh-8rem)] bg-white border-l border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              {activeNav === "league-detail" ? "Next Deadline" : "Next Deadlines"}
            </h3>

            {/* Premier League Countdown - show if not in league-detail OR if league is PL */}
            {(activeNav !== "league-detail" || selectedLeague?.type === "premier_league") && plDeadline && (
              <div className={activeNav !== "league-detail" ? "mb-6" : ""}>
                {activeNav !== "league-detail" && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-3 h-3 rounded-full bg-[#3d195b]" />
                    <span className="font-medium text-gray-900">Premier League</span>
                    {plGameweekNum && <span className="text-xs text-gray-500">GW{plGameweekNum}</span>}
                  </div>
                )}
                <div className="bg-[#3d195b] rounded-lg p-4">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-2xl font-bold text-white">{String(plCountdown.days).padStart(2, '0')}</p>
                      <p className="text-xs text-white/70">days</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{String(plCountdown.hours).padStart(2, '0')}</p>
                      <p className="text-xs text-white/70">hrs</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{String(plCountdown.minutes).padStart(2, '0')}</p>
                      <p className="text-xs text-white/70">min</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{String(plCountdown.seconds).padStart(2, '0')}</p>
                      <p className="text-xs text-white/70">sec</p>
                    </div>
                  </div>
                  <p className="text-xs text-white/70 mt-3 text-center">
                    {plDeadline.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {plDeadline.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )}

            {/* Champions League Countdown - show if not in league-detail OR if league is UCL */}
            {(activeNav !== "league-detail" || selectedLeague?.type === "champions_league") && uclDeadline && (
              <div>
                {activeNav !== "league-detail" && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-3 h-3 rounded-full bg-[#04065c]" />
                    <span className="font-medium text-gray-900">Champions League</span>
                    {uclGameweekNum && <span className="text-xs text-gray-500">MD{uclGameweekNum}</span>}
                  </div>
                )}
                <div className="bg-[#04065c] rounded-lg p-4">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-2xl font-bold text-white">{String(uclCountdown.days).padStart(2, '0')}</p>
                      <p className="text-xs text-white/70">days</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{String(uclCountdown.hours).padStart(2, '0')}</p>
                      <p className="text-xs text-white/70">hrs</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{String(uclCountdown.minutes).padStart(2, '0')}</p>
                      <p className="text-xs text-white/70">min</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{String(uclCountdown.seconds).padStart(2, '0')}</p>
                      <p className="text-xs text-white/70">sec</p>
                    </div>
                  </div>
                  <p className="text-xs text-white/70 mt-3 text-center">
                    {uclDeadline.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {uclDeadline.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )}

            {/* Show message if no upcoming deadlines */}
            {!plDeadline && !uclDeadline && (
              <p className="text-gray-500 text-sm">No upcoming deadlines</p>
            )}
          </aside>
        )}
      </div>

    </div>
  );
}
