import { useState, useEffect, useCallback } from "react";
import { signOut, useSession } from "../lib/auth";
import { fixturesApi, predictionsApi, leaderboardApi, leaguesAdminApi } from "../lib/api";
import Predictions from "./Predictions";
import type { Gameweek, MatchWithTeams } from "../types/fixtures";
import type { PredictionInput } from "../types/predictions";
import { calculatePredictionPoints, getPointsBadgeColor } from "../types/predictions";

interface LeagueMember {
  id: string;
  userId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  joinedAt: string;
}

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

  // Admin panel state
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [editingLeagueName, setEditingLeagueName] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState("");
  const [savingLeagueName, setSavingLeagueName] = useState(false);
  const [leagueMembers, setLeagueMembers] = useState<LeagueMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [kickingMember, setKickingMember] = useState<string | null>(null);

  // Rules modal state
  const [showRulesModal, setShowRulesModal] = useState(false);

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
  const [plIsNextDeadline, setPlIsNextDeadline] = useState(false);
  const [uclIsNextDeadline, setUclIsNextDeadline] = useState(false);

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
        const currentDeadline = new Date(plGameweek.deadline);
        const now = new Date();

        // If current deadline has passed and there's a next deadline, show that
        if (currentDeadline <= now && plGameweek.nextDeadline) {
          setPlDeadline(new Date(plGameweek.nextDeadline.deadline));
          setPlGameweekNum(plGameweek.nextDeadline.gameweekNumber);
          setPlIsNextDeadline(true);
        } else {
          setPlDeadline(currentDeadline);
          setPlGameweekNum(plGameweek.number);
          setPlIsNextDeadline(false);
        }
      } catch (err) {
        console.error("Failed to fetch PL deadline:", err);
      }

      try {
        const uclGameweek = await fixturesApi.getCurrentGameweek("champions_league");
        const currentDeadline = new Date(uclGameweek.deadline);
        const now = new Date();

        // If current deadline has passed and there's a next deadline, show that
        if (currentDeadline <= now && uclGameweek.nextDeadline) {
          setUclDeadline(new Date(uclGameweek.nextDeadline.deadline));
          setUclGameweekNum(uclGameweek.nextDeadline.gameweekNumber);
          setUclIsNextDeadline(true);
        } else {
          setUclDeadline(currentDeadline);
          setUclGameweekNum(uclGameweek.number);
          setUclIsNextDeadline(false);
        }
      } catch (err) {
        console.error("Failed to fetch UCL deadline:", err);
      }
    };

    fetchDeadlines();
  }, []);

  // Fetch user's favorite team (skip in demo mode)
  useEffect(() => {
    if (demoMode) return;

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
  }, [demoMode]);

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
      // Auto-select the first demo league and show it
      setSelectedLeague(DEMO_LEAGUES[0]);
      setActiveNav("league-detail");
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

    // Demo mode - fetch real fixtures but use mock leaderboard
    if (demoMode) {
      setLeaderboard(DEMO_LEADERBOARD);
      setLoadingLeaderboard(false);
      setUserPredictions({});
      setLoadingPredictions(false);

      try {
        // Fetch real current gameweek
        const currentGw = await fixturesApi.getCurrentGameweek(league.type);
        const fullGameweek = await fixturesApi.getGameweek(currentGw.id);
        setCurrentGameweek({
          ...fullGameweek,
          name: fullGameweek.name || undefined,
          status: fullGameweek.status as "upcoming" | "active" | "completed",
        });

        // Extract real matches from matchdays
        const allMatches: MatchWithTeams[] = [];
        for (const matchday of fullGameweek.matchdays) {
          for (const match of matchday.matches) {
            allMatches.push({
              id: match.id,
              matchdayId: matchday.id,
              kickoffTime: match.kickoffTime,
              homeScore: match.homeScore,
              awayScore: match.awayScore,
              homeRedCards: match.homeRedCards,
              awayRedCards: match.awayRedCards,
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
      } catch (err) {
        console.error("Demo mode - failed to fetch fixtures:", err);
        setMatches([]);
      }
      setLoadingFixtures(false);
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
            homeRedCards: match.homeRedCards,
            awayRedCards: match.awayRedCards,
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

    // In demo mode, only update local state (don't save to backend)
    if (!demoMode) {
      await predictionsApi.submitPredictions(selectedLeague.id, currentGameweek.id, predictions);
    }

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

  // Admin panel handlers
  const fetchLeagueMembers = async (leagueId: string) => {
    setLoadingMembers(true);
    try {
      const members = await leaguesAdminApi.getMembers(leagueId);
      setLeagueMembers(members);
    } catch (err) {
      console.error("Failed to fetch members:", err);
    }
    setLoadingMembers(false);
  };

  const handleSaveLeagueName = async () => {
    if (!selectedLeague || !newLeagueName.trim()) return;
    setSavingLeagueName(true);
    try {
      await leaguesAdminApi.updateLeague(selectedLeague.id, newLeagueName.trim());
      // Update local state
      setSelectedLeague({ ...selectedLeague, name: newLeagueName.trim() });
      setLeagues(leagues.map(l => l.id === selectedLeague.id ? { ...l, name: newLeagueName.trim() } : l));
      setEditingLeagueName(false);
    } catch (err) {
      console.error("Failed to update league name:", err);
    }
    setSavingLeagueName(false);
  };

  const handleKickMember = async (userId: string) => {
    if (!selectedLeague) return;
    if (!confirm("Are you sure you want to remove this member from the league?")) return;
    setKickingMember(userId);
    try {
      await leaguesAdminApi.kickMember(selectedLeague.id, userId);
      // Update local state
      setLeagueMembers(leagueMembers.filter(m => m.userId !== userId));
      setSelectedLeague({ ...selectedLeague, memberCount: selectedLeague.memberCount - 1 });
      setLeagues(leagues.map(l => l.id === selectedLeague.id ? { ...l, memberCount: l.memberCount - 1 } : l));
    } catch (err) {
      console.error("Failed to kick member:", err);
    }
    setKickingMember(null);
  };

  const openAdminPanel = () => {
    if (selectedLeague) {
      setShowAdminPanel(true);
      setNewLeagueName(selectedLeague.name);
      fetchLeagueMembers(selectedLeague.id);
    }
  };

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
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200">
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
        <aside 
          className="w-64 min-h-[calc(100vh-8rem)] relative"
          style={{
            background: 'linear-gradient(180deg, #1a0826 0%, #120830 50%, #0a0a2e 100%)'
          }}
        >
          <nav className="p-4 space-y-1">
            {/* My Leagues Section */}
            <button
              onClick={() => {
                setSelectedLeague(null);
                setActiveNav("leagues");
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                activeNav === "leagues" && !selectedLeague
                  ? "bg-[#00ff87]/20 text-[#00ff87] font-semibold shadow-lg shadow-[#00ff87]/10"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
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
                    className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg text-left transition-all duration-200 text-sm ${
                      selectedLeague?.id === league.id
                        ? "bg-[#00ff87]/20 text-[#00ff87] font-semibold shadow-lg shadow-[#00ff87]/10"
                        : "text-white/50 hover:bg-white/10 hover:text-white/90"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${
                      league.type === "premier_league" ? "bg-[#9b4dca]" : "bg-[#3b82f6]"
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
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                  activeNav === "create"
                    ? "bg-[#00ff87]/20 text-[#00ff87] font-semibold shadow-lg shadow-[#00ff87]/10"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
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
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                activeNav === "join"
                  ? "bg-[#00ff87]/20 text-[#00ff87] font-semibold shadow-lg shadow-[#00ff87]/10"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <span className="font-medium">Join League</span>
            </button>

            <button
              onClick={() => setActiveNav("account")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                activeNav === "account"
                  ? "bg-[#00ff87]/20 text-[#00ff87] font-semibold shadow-lg shadow-[#00ff87]/10"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="font-medium">Account</span>
            </button>
          </nav>

          {/* Logout/Exit Demo button at bottom */}
          <div className="absolute bottom-0 w-64 p-4 border-t border-white/10">
            {demoMode ? (
              <button
                onClick={onExitDemo}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-[#00ff87] to-[#60efff] text-gray-900 hover:opacity-90 transition-all duration-200 shadow-lg shadow-[#00ff87]/20"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                <span className="font-medium">Exit Demo</span>
              </button>
            ) : (
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition-all duration-200"
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
        <main className="flex-1 p-10">
          {activeNav === "leagues" && (
            <div className="space-y-8">
              {/* Welcome Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                    Welcome back, {user?.firstName || user?.username || "Predictor"}!
                  </h2>
                  <p className="text-gray-500 mt-1">Ready to make some winning predictions?</p>
                </div>
                <button
                  onClick={() => setActiveNav("join")}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#00ff87] to-[#60efff] text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  + Join League
                </button>
              </div>

              {loadingLeagues ? (
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 text-center border border-white/50 shadow-xl shadow-gray-200/50 transition-all duration-300">
                  <p className="text-gray-500">Loading your leagues...</p>
                </div>
              ) : leagues.length === 0 ? (
                /* Empty State - No Leagues */
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-12 text-center border border-white/50 shadow-xl shadow-gray-200/50 transition-all duration-300">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#00ff87]/30 to-[#60efff]/30 flex items-center justify-center">
                    <svg className="w-10 h-10 text-[#00915c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15c-3 0-5-2-5-5V4h10v6c0 3-2 5-5 5zm0 0v4m0 0H9m3 0h3M7 4H4v3a3 3 0 003 3m10-6h3v3a3 3 0 01-3 3" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Start Your Prediction Journey</h3>
                  <p className="text-gray-500 mb-8 max-w-md mx-auto">
                    Join a league to compete with friends and prove you're the ultimate football predictor!
                  </p>
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={() => setActiveNav("join")}
                      className="px-8 py-3 bg-gradient-to-r from-[#00ff87] to-[#60efff] text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      Join a League
                    </button>
                    {user?.email === ADMIN_EMAIL && (
                      <button
                        onClick={() => setActiveNav("create")}
                        className="px-8 py-3 border-2 border-gray-300 text-gray-700 font-bold rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-all duration-200"
                      >
                        Create League
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* Has Leagues - Show Dashboard */
                <>
                  {/* Upcoming Deadlines */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-gradient-to-br from-[#3d195b] to-[#6b2d8a] rounded-2xl p-6 text-white shadow-xl">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                          <span className="text-lg">⚽</span>
                        </div>
                        <div>
                          <p className="text-white/70 text-sm">Premier League</p>
                          <p className="font-bold">
                            {plGameweekNum ? `Gameweek ${plGameweekNum}` : "No upcoming gameweek"}
                          </p>
                        </div>
                      </div>
                      {plDeadline && plCountdown.days + plCountdown.hours + plCountdown.minutes > 0 ? (
                        <div className="flex gap-3">
                          <div className="bg-white/20 rounded-lg px-3 py-2 text-center min-w-[60px]">
                            <p className="text-2xl font-bold">{plCountdown.days}</p>
                            <p className="text-xs text-white/70">days</p>
                          </div>
                          <div className="bg-white/20 rounded-lg px-3 py-2 text-center min-w-[60px]">
                            <p className="text-2xl font-bold">{plCountdown.hours}</p>
                            <p className="text-xs text-white/70">hrs</p>
                          </div>
                          <div className="bg-white/20 rounded-lg px-3 py-2 text-center min-w-[60px]">
                            <p className="text-2xl font-bold">{plCountdown.minutes}</p>
                            <p className="text-xs text-white/70">min</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-white/70">No upcoming deadline</p>
                      )}
                    </div>
                    <div className="bg-gradient-to-br from-[#04065c] to-[#1a237e] rounded-2xl p-6 text-white shadow-xl">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                          <span className="text-lg">🏆</span>
                        </div>
                        <div>
                          <p className="text-white/70 text-sm">Champions League</p>
                          <p className="font-bold">
                            {uclGameweekNum ? `Matchday ${uclGameweekNum}` : "No upcoming matchday"}
                          </p>
                        </div>
                      </div>
                      {uclDeadline && uclCountdown.days + uclCountdown.hours + uclCountdown.minutes > 0 ? (
                        <div className="flex gap-3">
                          <div className="bg-white/20 rounded-lg px-3 py-2 text-center min-w-[60px]">
                            <p className="text-2xl font-bold">{uclCountdown.days}</p>
                            <p className="text-xs text-white/70">days</p>
                          </div>
                          <div className="bg-white/20 rounded-lg px-3 py-2 text-center min-w-[60px]">
                            <p className="text-2xl font-bold">{uclCountdown.hours}</p>
                            <p className="text-xs text-white/70">hrs</p>
                          </div>
                          <div className="bg-white/20 rounded-lg px-3 py-2 text-center min-w-[60px]">
                            <p className="text-2xl font-bold">{uclCountdown.minutes}</p>
                            <p className="text-xs text-white/70">min</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-white/70">No upcoming deadline</p>
                      )}
                    </div>
                  </div>

                  {/* League Cards */}
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4">Your Leagues</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {leagues.map((league) => (
                        <button
                          key={league.id}
                          onClick={() => {
                            setSelectedLeague(league);
                            setActiveNav("league-detail");
                            setShowPredictionsForm(false);
                          }}
                          className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-xl shadow-gray-200/50 transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] text-left group"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-lg ${
                                league.type === "premier_league" 
                                  ? "bg-gradient-to-br from-[#3d195b] to-[#6b2d8a]" 
                                  : "bg-gradient-to-br from-[#04065c] to-[#1a237e]"
                              }`}>
                                {league.type === "premier_league" ? "⚽" : "🏆"}
                              </div>
                              <div>
                                <h4 className="font-bold text-gray-900 text-lg group-hover:text-[#3d195b] transition-colors">
                                  {league.name}
                                </h4>
                                <p className="text-sm text-gray-500">
                                  {league.type === "premier_league" ? "Premier League" : "Champions League"}
                                </p>
                              </div>
                            </div>
                            <svg className="w-5 h-5 text-gray-400 group-hover:text-[#00ff87] group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              <span>{league.memberCount} members</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span className="capitalize">{league.role}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeNav === "create" && (
            <div>
              <h2 className="text-3xl font-extrabold text-gray-900 mb-8 tracking-tight">Create League</h2>
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-white/50 shadow-xl shadow-gray-200/50 transition-all duration-300 hover:shadow-2xl">
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
              <h2 className="text-3xl font-extrabold text-gray-900 mb-8 tracking-tight">Join League</h2>
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-white/50 shadow-xl shadow-gray-200/50 transition-all duration-300 hover:shadow-2xl">
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
              <div className="flex items-center gap-4 mb-8">
                {showPredictionsForm && (
                  <button
                    onClick={() => setShowPredictionsForm(false)}
                    className="p-2.5 hover:bg-white/50 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">{selectedLeague.name}</h2>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${
                  selectedLeague.type === "premier_league"
                    ? "bg-gradient-to-r from-[#3d195b] to-[#6b2d8a] text-white"
                    : "bg-gradient-to-r from-[#04065c] to-[#1a237e] text-white"
                }`}>
                  {selectedLeague.type === "premier_league" ? "Premier League" : "Champions League"}
                </span>
                <button
                  onClick={() => setShowRulesModal(true)}
                  className="ml-auto flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/50 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Rules
                </button>
              </div>

              {loadingFixtures ? (
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 text-center border border-white/50 shadow-xl shadow-gray-200/50 transition-all duration-300">
                  <p className="text-gray-500">Loading fixtures...</p>
                </div>
              ) : showPredictionsForm && currentGameweek ? (
                /* Full Predictions Form */
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-xl shadow-gray-200/50 transition-all duration-300 hover:shadow-2xl">
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
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-xl shadow-gray-200/50 min-h-[600px] max-h-[600px] overflow-y-auto flex flex-col transition-all duration-300 hover:shadow-2xl hover:shadow-gray-300/50">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold text-gray-900">Leaderboard</h3>
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
                              className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                                entry.userId === user?.id 
                                  ? "bg-gradient-to-r from-[#00ff87]/20 to-[#60efff]/10 border border-[#00ff87]/30 shadow-sm" 
                                  : "hover:bg-gray-50"
                              }`}
                            >
                              <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-md ${
                                entry.rank === 1 ? "bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900" :
                                entry.rank === 2 ? "bg-gradient-to-br from-gray-200 to-gray-400 text-gray-700" :
                                entry.rank === 3 ? "bg-gradient-to-br from-orange-300 to-orange-500 text-orange-900" :
                                "bg-gray-100 text-gray-600"
                              }`}>
                                {isSeasonComplete && entry.rank === 1 ? "👑" : entry.rank}
                              </span>
                              <span className={`flex-1 flex items-center gap-2 ${entry.userId === user?.id ? "font-bold text-gray-900" : "text-gray-700"}`}>
                                {entry.username || entry.firstName || "Anonymous"}
                                {entry.teamLogo && (
                                  <img src={entry.teamLogo} alt="" className="w-6 h-6 object-contain" />
                                )}
                              </span>
                              <span className="font-bold text-gray-900 text-lg tabular-nums">{entry.totalPoints}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* My Predictions Summary */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-xl shadow-gray-200/50 min-h-[600px] max-h-[600px] flex flex-col transition-all duration-300 hover:shadow-2xl hover:shadow-gray-300/50">
                      <h3 className="text-xl font-bold text-gray-900 mb-4">My Predictions</h3>
                      <div className="flex-1 overflow-y-auto">
                        {loadingPredictions ? (
                          <p className="text-gray-500 text-sm">Loading...</p>
                        ) : Object.keys(userPredictions).length > 0 ? (
                          /* Show predictions list */
                          <div className="space-y-2">
                            {matches.map((match) => {
                              const pred = userPredictions[match.id];
                              const isFinished = match.status === "finished";
                              const hasResult = match.homeScore !== null && match.awayScore !== null;

                              // Calculate points if match is finished and user made a prediction
                              let pointsResult: { points: number; type: "exact" | "result" | "incorrect" } | null = null;
                              if (isFinished && hasResult && pred) {
                                pointsResult = calculatePredictionPoints(
                                  pred.homeScore,
                                  pred.awayScore,
                                  match.homeScore!,
                                  match.awayScore!
                                );
                              }

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
                                  {/* Points badge for finished matches */}
                                  {pointsResult ? (
                                    <span className={`ml-2 w-8 text-center px-1.5 py-0.5 rounded text-xs font-bold ${getPointsBadgeColor(pointsResult.type)}`}>
                                      +{pointsResult.points}
                                    </span>
                                  ) : (
                                    <span className="ml-2 w-8" />
                                  )}
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
                          className="mt-4 w-full py-3.5 rounded-xl font-bold text-white transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                          style={{ 
                            background: selectedLeague.type === "premier_league" 
                              ? "linear-gradient(135deg, #3d195b 0%, #6b2d8a 100%)" 
                              : "linear-gradient(135deg, #04065c 0%, #1a237e 100%)" 
                          }}
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
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-xl shadow-gray-200/50 min-h-[600px] max-h-[600px] overflow-y-auto transition-all duration-300 hover:shadow-2xl hover:shadow-gray-300/50">
                      <h3 className="text-xl font-bold text-gray-900 mb-4">
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
                                <div className="px-3 flex flex-col items-center">
                                  {/* Red cards row */}
                                  {(match.homeRedCards > 0 || match.awayRedCards > 0) && (
                                    <div className="flex items-center gap-4 text-xs mb-0.5">
                                      <span className="w-4 text-center">
                                        {match.homeRedCards > 0 && (
                                          <span className="inline-block w-2.5 h-3.5 bg-red-600 rounded-sm" title={`${match.homeRedCards} red card${match.homeRedCards > 1 ? 's' : ''}`} />
                                        )}
                                      </span>
                                      <span className="w-2" />
                                      <span className="w-4 text-center">
                                        {match.awayRedCards > 0 && (
                                          <span className="inline-block w-2.5 h-3.5 bg-red-600 rounded-sm" title={`${match.awayRedCards} red card${match.awayRedCards > 1 ? 's' : ''}`} />
                                        )}
                                      </span>
                                    </div>
                                  )}
                                  {/* Score row */}
                                  <span className="font-bold text-gray-900">
                                    {match.homeScore} - {match.awayScore}
                                  </span>
                                </div>
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
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-xl shadow-gray-200/50 transition-all duration-300 hover:shadow-2xl">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">League Info</h3>
                      {user?.email === ADMIN_EMAIL && (
                        <button
                          onClick={() => showAdminPanel ? setShowAdminPanel(false) : openAdminPanel()}
                          className="text-sm px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                        >
                          {showAdminPanel ? "Hide Admin" : "Manage League"}
                        </button>
                      )}
                    </div>
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

                    {/* Admin Panel */}
                    {showAdminPanel && user?.email === ADMIN_EMAIL && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <h4 className="text-md font-semibold text-gray-900 mb-4">Admin Controls</h4>

                        {/* Edit League Name */}
                        <div className="mb-6">
                          <label className="block text-sm text-gray-500 mb-2">League Name</label>
                          {editingLeagueName ? (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newLeagueName}
                                onChange={(e) => setNewLeagueName(e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00ff87]"
                                maxLength={100}
                              />
                              <button
                                onClick={handleSaveLeagueName}
                                disabled={savingLeagueName || !newLeagueName.trim()}
                                className="px-4 py-2 bg-[#00ff87] text-gray-900 font-medium rounded-lg hover:bg-[#00cc6a] disabled:opacity-50 transition-colors"
                              >
                                {savingLeagueName ? "Saving..." : "Save"}
                              </button>
                              <button
                                onClick={() => {
                                  setEditingLeagueName(false);
                                  setNewLeagueName(selectedLeague.name);
                                }}
                                className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-900 font-medium">{selectedLeague.name}</span>
                              <button
                                onClick={() => setEditingLeagueName(true)}
                                className="text-sm text-blue-600 hover:text-blue-800"
                              >
                                Edit
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Members List */}
                        <div>
                          <label className="block text-sm text-gray-500 mb-2">Members ({leagueMembers.length})</label>
                          {loadingMembers ? (
                            <p className="text-gray-500 text-sm">Loading members...</p>
                          ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {leagueMembers.map((member) => (
                                <div key={member.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                                  <div>
                                    <span className="font-medium text-gray-900">
                                      {member.firstName && member.lastName
                                        ? `${member.firstName} ${member.lastName}`
                                        : member.username || member.email}
                                    </span>
                                    {member.role === "admin" && (
                                      <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Admin</span>
                                    )}
                                    <p className="text-xs text-gray-500">{member.email}</p>
                                  </div>
                                  {member.role !== "admin" && (
                                    <button
                                      onClick={() => handleKickMember(member.userId)}
                                      disabled={kickingMember === member.userId}
                                      className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                                    >
                                      {kickingMember === member.userId ? "Removing..." : "Remove"}
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeNav === "account" && (
            <div>
              <h2 className="text-3xl font-extrabold text-gray-900 mb-8 tracking-tight">Account Settings</h2>

              {/* Profile Section */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-white/50 shadow-xl shadow-gray-200/50 transition-all duration-300 hover:shadow-2xl mb-6">
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
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-white/50 shadow-xl shadow-gray-200/50 transition-all duration-300 hover:shadow-2xl">
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
              {activeNav === "league-detail"
                ? (plIsNextDeadline || uclIsNextDeadline ? "Next Deadline" : "Deadline")
                : "Deadlines"}
            </h3>

            {/* Premier League Countdown - show if not in league-detail OR if league is PL */}
            {(activeNav !== "league-detail" || selectedLeague?.type === "premier_league") && plDeadline && (
              <div className={activeNav !== "league-detail" ? "mb-6" : ""}>
                {activeNav !== "league-detail" && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-3 h-3 rounded-full bg-[#3d195b]" />
                    <span className="font-medium text-gray-900">Premier League</span>
                    {plGameweekNum && <span className="text-xs text-gray-500">{plIsNextDeadline ? "Next: " : ""}GW{plGameweekNum}</span>}
                  </div>
                )}
                {activeNav === "league-detail" && plIsNextDeadline && (
                  <p className="text-sm text-gray-600 mb-3">Gameweek {plGameweekNum}</p>
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
                    {uclGameweekNum && <span className="text-xs text-gray-500">{uclIsNextDeadline ? "Next: " : ""}MD{uclGameweekNum}</span>}
                  </div>
                )}
                {activeNav === "league-detail" && uclIsNextDeadline && (
                  <p className="text-sm text-gray-600 mb-3">Matchday {uclGameweekNum}</p>
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

      {/* Rules Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div
              className="px-6 py-4 text-white"
              style={{
                background: selectedLeague?.type === "premier_league"
                  ? "linear-gradient(135deg, #3d195b 0%, #6b2d8a 100%)"
                  : "linear-gradient(135deg, #04065c 0%, #1a237e 100%)",
              }}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">How to Play</h3>
                <button
                  onClick={() => setShowRulesModal(false)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Predict Match Scores</h4>
                  <p className="text-sm text-gray-600">
                    Before each gameweek deadline, predict the final score for every match. You can update your predictions until the deadline passes.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Scoring System</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm">+3</span>
                      <div>
                        <p className="font-medium text-gray-900">Exact Score</p>
                        <p className="text-xs text-gray-500">You predicted the exact final score</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center font-bold text-sm">+1</span>
                      <div>
                        <p className="font-medium text-gray-900">Correct Result</p>
                        <p className="text-xs text-gray-500">Right outcome (home win, away win, or draw)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold text-sm">+0</span>
                      <div>
                        <p className="font-medium text-gray-900">Incorrect</p>
                        <p className="text-xs text-gray-500">Wrong result prediction</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Compete & Climb</h4>
                  <p className="text-sm text-gray-600">
                    Your points accumulate across the season. Compete with other league members on the leaderboard to become the prediction champion!
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowRulesModal(false)}
                className="w-full mt-6 py-3 rounded-lg font-semibold text-white transition-colors"
                style={{
                  backgroundColor: selectedLeague?.type === "premier_league" ? "#3d195b" : "#04065c",
                }}
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
