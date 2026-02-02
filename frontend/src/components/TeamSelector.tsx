import { useState, useEffect } from "react";

interface Team {
  id: string;
  name: string;
  shortName: string;
  code: string;
  logo: string | null;
  competition: string;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function TeamSelector({ onComplete }: { onComplete: () => void }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const res = await fetch(`${API_URL}/api/user/teams`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          data.sort((a: Team, b: Team) => a.name.localeCompare(b.name));
          setTeams(data);
        }
      } catch (err) {
        console.error("Failed to fetch teams:", err);
        setError("Failed to load teams");
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, []);

  const handleConfirm = async () => {
    if (!selectedTeam) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/user/favorite-team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ teamId: selectedTeam.id }),
      });

      if (res.ok) {
        onComplete();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save team");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background: "linear-gradient(135deg, #3d195b 0%, #3d195b 40%, #21105c 50%, #04065c 60%, #04065c 100%)",
      }}
    >
      <div className="w-full max-w-2xl px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-extrabold text-white">ScoreCast</h1>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl">
          {loading ? (
            <div className="py-12 text-center">
              <p className="text-white/70">Loading teams...</p>
            </div>
          ) : error && teams.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-red-300">{error}</p>
            </div>
          ) : (
            <>
              {/* Selected team display */}
              <div className="mb-4 h-16 flex items-center justify-center">
                {selectedTeam ? (
                  <div className="flex items-center gap-3">
                    {selectedTeam.logo && (
                      <img
                        src={selectedTeam.logo}
                        alt={selectedTeam.name}
                        className="w-12 h-12 object-contain"
                      />
                    )}
                    <p className="text-white font-semibold">{selectedTeam.name}</p>
                  </div>
                ) : (
                  <p className="text-white/40 text-sm">Select a team below</p>
                )}
              </div>

              {/* Teams grid - scrollable area */}
              <div className="max-h-96 overflow-y-auto rounded-xl bg-white/5 p-4">
                <div className="grid grid-cols-5 gap-4">
                  {teams.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => setSelectedTeam(team)}
                      className={`aspect-square p-3 rounded-xl transition-all duration-150 flex items-center justify-center ${
                        selectedTeam?.id === team.id
                          ? "bg-[#00ff87] scale-105 ring-2 ring-[#00ff87]"
                          : "bg-white/10 hover:bg-white/20"
                      }`}
                      title={team.name}
                    >
                      {team.logo ? (
                        <img
                          src={team.logo}
                          alt={team.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-white/70 text-sm font-bold">{team.code}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200 text-sm text-center">
                  {error}
                </div>
              )}

              {/* Confirm button */}
              <button
                onClick={handleConfirm}
                disabled={!selectedTeam || submitting}
                className="mt-6 w-full py-3 rounded-xl bg-[#00ff87] text-gray-900 font-semibold transition-all duration-200 hover:bg-[#00e67a] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? "Saving..." : "Continue"}
              </button>
            </>
          )}
        </div>

        <p className="text-white/40 text-xs text-center mt-4">
          You can change this later in settings
        </p>
      </div>
    </div>
  );
}
