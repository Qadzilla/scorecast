import { useState } from "react";
import type { MatchWithTeams, Gameweek } from "../types/fixtures";
import type { PredictionInput } from "../types/predictions";
import { POINTS, calculatePredictionPoints, getPointsBadgeColor } from "../types/predictions";

interface PredictionsProps {
  gameweek: Gameweek;
  matches: MatchWithTeams[];
  existingPredictions?: Record<string, { homeScore: number; awayScore: number; points: number | null }>;
  onSubmit: (predictions: PredictionInput[]) => Promise<void>;
  isDeadlinePassed: boolean;
  leagueType: "premier_league" | "champions_league";
}

export default function Predictions({
  gameweek,
  matches,
  existingPredictions = {},
  onSubmit,
  isDeadlinePassed,
  leagueType,
}: PredictionsProps) {
  const [predictions, setPredictions] = useState<Record<string, { home: string; away: string }>>(() => {
    // Initialize with existing predictions or empty
    const initial: Record<string, { home: string; away: string }> = {};
    for (const match of matches) {
      const existing = existingPredictions[match.id];
      initial[match.id] = {
        home: existing?.homeScore?.toString() ?? "",
        away: existing?.awayScore?.toString() ?? "",
      };
    }
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const themeColor = leagueType === "premier_league" ? "#3d195b" : "#04065c";

  const handleScoreChange = (matchId: string, team: "home" | "away", value: string) => {
    // Only allow numbers 0-9
    if (value !== "" && !/^\d$/.test(value)) return;

    setPredictions((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [team]: value,
      },
    }));
  };

  const handleSubmit = async () => {
    setError("");

    // Validate all predictions are filled
    const incomplete = matches.filter(
      (m) => !predictions[m.id]?.home || !predictions[m.id]?.away
    );

    if (incomplete.length > 0) {
      setError(`Please enter predictions for all ${matches.length} matches`);
      return;
    }

    setSubmitting(true);
    try {
      const predictionInputs: PredictionInput[] = matches.map((match) => ({
        matchId: match.id,
        homeScore: parseInt(predictions[match.id].home, 10),
        awayScore: parseInt(predictions[match.id].away, 10),
      }));
      await onSubmit(predictionInputs);
    } catch {
      setError("Failed to submit predictions. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Group matches by date
  const matchesByDate = matches.reduce((acc, match) => {
    const date = new Date(match.kickoffTime).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(match);
    return acc;
  }, {} as Record<string, MatchWithTeams[]>);

  const allPredictionsFilled = matches.every(
    (m) => predictions[m.id]?.home && predictions[m.id]?.away
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {gameweek.name || `Gameweek ${gameweek.number}`}
          </h3>
          <p className="text-sm text-gray-500">
            {matches.length} matches • {isDeadlinePassed ? "Predictions locked" : "Predictions open"}
          </p>
        </div>
        {!isDeadlinePassed && (
          <div className="text-right">
            <p className="text-xs text-gray-500">Points available</p>
            <p className="text-lg font-bold" style={{ color: themeColor }}>
              {matches.length * POINTS.EXACT_SCORE}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Matches by date */}
      <div className="space-y-6">
        {Object.entries(matchesByDate).map(([date, dateMatches]) => (
          <div key={date}>
            <h4 className="text-sm font-medium text-gray-500 mb-3">{date}</h4>
            <div className="space-y-3">
              {dateMatches.map((match) => {
                const pred = predictions[match.id];
                const existing = existingPredictions[match.id];
                const isFinished = match.status === "finished";
                const hasResult = match.homeScore !== null && match.awayScore !== null;

                // Calculate points if match is finished and user made a prediction
                let pointsResult: { points: number; type: "exact" | "result" | "incorrect" } | null = null;
                if (isFinished && hasResult && existing) {
                  pointsResult = calculatePredictionPoints(
                    existing.homeScore,
                    existing.awayScore,
                    match.homeScore!,
                    match.awayScore!
                  );
                }

                return (
                  <div
                    key={match.id}
                    className="bg-white rounded-lg border border-gray-200 p-4"
                  >
                    {/* Kickoff time */}
                    <div className="text-xs text-gray-400 mb-2">
                      {new Date(match.kickoffTime).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {match.venue && ` • ${match.venue}`}
                    </div>

                    {/* Match row */}
                    <div className="flex items-center gap-2 sm:gap-4">
                      {/* Home team */}
                      <div className="flex-1 flex items-center justify-end gap-1 sm:gap-2">
                        <span className="font-medium text-gray-900 text-right text-sm sm:text-base truncate max-w-[60px] sm:max-w-none">
                          {match.homeTeam.shortName}
                        </span>
                        {match.homeTeam.logo && (
                          <img src={match.homeTeam.logo} alt={match.homeTeam.name} className="w-6 h-6 sm:w-8 sm:h-8 object-contain flex-shrink-0" />
                        )}
                      </div>

                      {/* Score inputs / Result */}
                      <div className="flex items-center gap-1 sm:gap-2">
                        {isDeadlinePassed ? (
                          // Show predictions (locked)
                          <>
                            <div
                              className="w-11 h-11 sm:w-10 sm:h-10 rounded flex items-center justify-center text-white font-bold"
                              style={{ backgroundColor: themeColor }}
                            >
                              {existing?.homeScore ?? "-"}
                            </div>
                            <span className="text-gray-400">-</span>
                            <div
                              className="w-11 h-11 sm:w-10 sm:h-10 rounded flex items-center justify-center text-white font-bold"
                              style={{ backgroundColor: themeColor }}
                            >
                              {existing?.awayScore ?? "-"}
                            </div>
                          </>
                        ) : (
                          // Editable inputs
                          <>
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              value={pred?.home ?? ""}
                              onChange={(e) => handleScoreChange(match.id, "home", e.target.value)}
                              className="w-12 h-12 sm:w-10 sm:h-10 rounded border-2 border-gray-200 text-center text-lg font-bold focus:border-gray-400 focus:outline-none transition-colors"
                              style={{
                                borderColor: pred?.home ? themeColor : undefined,
                                color: themeColor
                              }}
                            />
                            <span className="text-gray-400 font-bold">-</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              value={pred?.away ?? ""}
                              onChange={(e) => handleScoreChange(match.id, "away", e.target.value)}
                              className="w-12 h-12 sm:w-10 sm:h-10 rounded border-2 border-gray-200 text-center text-lg font-bold focus:border-gray-400 focus:outline-none transition-colors"
                              style={{
                                borderColor: pred?.away ? themeColor : undefined,
                                color: themeColor
                              }}
                            />
                          </>
                        )}
                      </div>

                      {/* Away team */}
                      <div className="flex-1 flex items-center gap-1 sm:gap-2">
                        {match.awayTeam.logo && (
                          <img src={match.awayTeam.logo} alt={match.awayTeam.name} className="w-6 h-6 sm:w-8 sm:h-8 object-contain flex-shrink-0" />
                        )}
                        <span className="font-medium text-gray-900 text-sm sm:text-base truncate max-w-[60px] sm:max-w-none">
                          {match.awayTeam.shortName}
                        </span>
                      </div>

                      {/* Points badge (if finished) */}
                      {pointsResult && (
                        <div
                          className={`ml-2 px-2 py-1 rounded text-xs font-bold ${getPointsBadgeColor(pointsResult.type)}`}
                        >
                          +{pointsResult.points}
                        </div>
                      )}
                    </div>

                    {/* Actual result (if finished) */}
                    {isFinished && hasResult && (
                      <div className="mt-2 pt-2 border-t border-gray-100 text-center">
                        <span className="text-xs text-gray-400">Final: </span>
                        <span className="text-sm font-semibold text-gray-700">
                          {match.homeScore} - {match.awayScore}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Submit button */}
      {!isDeadlinePassed && (
        <div className="mt-6">
          <button
            onClick={handleSubmit}
            disabled={submitting || !allPredictionsFilled}
            className="w-full py-3 rounded-lg font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: themeColor }}
          >
            {submitting ? "Submitting..." : "Submit Predictions"}
          </button>
          <p className="text-xs text-gray-400 text-center mt-2">
            You can update your predictions until the deadline
          </p>
        </div>
      )}

      {/* Points legend */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-xs font-medium text-gray-500 mb-2">Scoring</p>
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-1">
            <span className={`px-2 py-0.5 rounded font-bold ${getPointsBadgeColor("exact")}`}>+3</span>
            <span className="text-gray-600">Exact score</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`px-2 py-0.5 rounded font-bold ${getPointsBadgeColor("result")}`}>+1</span>
            <span className="text-gray-600">Correct result</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`px-2 py-0.5 rounded font-bold ${getPointsBadgeColor("incorrect")}`}>+0</span>
            <span className="text-gray-600">Incorrect</span>
          </div>
        </div>
      </div>
    </div>
  );
}
