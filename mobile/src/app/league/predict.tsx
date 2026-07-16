import { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, ScrollView, Switch, type TextInput } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Text } from "@/components/Text";
import { Card } from "@/components/Card";
import { SolidButton } from "@/components/SolidButton";
import { SectionTitle } from "@/components/SectionTitle";
import { Banner } from "@/components/Banner";
import { ScoreInput } from "@/components/ScoreInput";
import { TeamCrest } from "@/components/TeamCrest";
import { SkeletonLines } from "@/components/Skeleton";
import { useGameweek, usePredictions, useSubmitPredictions } from "@/lib/queries";
import { ApiError } from "@/lib/api";
import { maybePromptForPush } from "@/lib/notifications";
import { isPredictionWindowOpen, type MatchWithTeams } from "@/types/fixtures";
import { haptics } from "@/utils/haptics";
import { colors, spacing, layout, fontFamily } from "@/constants/theme";

type Entry = { home: string; away: string };

export default function PredictScreen() {
  const { leagueId, gameweekId } = useLocalSearchParams<{ leagueId: string; gameweekId: string }>();
  const router = useRouter();

  const gameweek = useGameweek(gameweekId);
  const existing = usePredictions(leagueId, gameweekId);
  const submit = useSubmitPredictions(leagueId, gameweekId);

  // Flatten matchdays → ordered matches (with day boundaries kept for headers).
  const matchdays = gameweek.data?.matchdays ?? [];
  const orderedMatches = useMemo(
    () => matchdays.flatMap((md) => md.matches),
    [matchdays]
  );

  const [entries, setEntries] = useState<Record<string, Entry>>({});
  // Hide these picks from other members until the deadline. Defaults to visible;
  // the player can flip it on. Seeded from the last submission if one exists.
  const [hidden, setHidden] = useState(false);
  // Once the player touches the slider we stop re-seeding it from server data —
  // but until then we keep it in sync with the latest fetch (so a stale cache
  // followed by a fresh refetch doesn't leave it stuck on the old value).
  const hiddenTouched = useRef(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Seed from existing predictions once both queries resolve.
  useEffect(() => {
    if (!existing.data) return;
    const seed: Record<string, Entry> = {};
    for (const p of existing.data) {
      seed[p.matchId] = { home: String(p.predictedHome), away: String(p.predictedAway) };
    }
    setEntries((prev) => ({ ...seed, ...prev }));
    if (!hiddenTouched.current && existing.data.length > 0) {
      setHidden(existing.data[0]!.hidden ?? false);
    }
  }, [existing.data]);

  const onToggleHidden = (v: boolean) => {
    hiddenTouched.current = true;
    setHidden(v);
  };

  const deadlineOpen = gameweek.data ? isPredictionWindowOpen(gameweek.data.deadline) : true;
  const filledCount = orderedMatches.filter((m) => {
    const e = entries[m.id];
    return e && e.home !== "" && e.away !== "";
  }).length;

  const setSlot = (matchId: string, side: "home" | "away", value: string) => {
    setEntries((prev) => {
      const cur = prev[matchId] ?? { home: "", away: "" };
      return { ...prev, [matchId]: { ...cur, [side]: value } };
    });
  };

  const focusSlot = (index: number) => {
    inputRefs.current[index]?.focus();
  };

  const onSubmit = () => {
    const predictions = orderedMatches
      .map((m) => ({ match: m, e: entries[m.id] }))
      .filter(({ e }) => e && e.home !== "" && e.away !== "")
      .map(({ match, e }) => ({
        matchId: match.id,
        homeScore: Number(e!.home),
        awayScore: Number(e!.away),
      }));
    if (predictions.length === 0) return;
    submit.mutate({ predictions, hidden }, {
      onSuccess: () => {
        haptics.success();
        // Contextual push opt-in — the ideal moment (they just engaged and
        // would benefit from a deadline reminder next time). No-op if already
        // decided. Fire before navigating so the screen is still mounted.
        void maybePromptForPush();
        router.back();
      },
    });
  };

  const deadlinePassedError =
    submit.error instanceof ApiError && submit.error.status === 400
      ? "The deadline has passed — predictions are locked."
      : submit.isError
        ? "Couldn't save your predictions. Try again."
        : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScreenHeader title="Make predictions" />

      {gameweek.isLoading || existing.isLoading ? (
        <View style={styles.pad}><SkeletonLines count={6} /></View>
      ) : orderedMatches.length === 0 ? (
        <View style={styles.pad}>
          <Banner kind="info" message="No matches to predict in this gameweek yet." />
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {!deadlineOpen ? (
              <Banner kind="offline" message="Deadline passed — these are locked." />
            ) : null}
            {deadlinePassedError ? <Banner kind="error" message={deadlinePassedError} /> : null}

            {matchdays.map((md, mdi) => (
              <Animated.View key={md.id} entering={FadeInDown.duration(260).delay(mdi * 70)} style={styles.day}>
                <SectionTitle
                  label={new Date(md.date).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" })}
                />
                <Card padded={false} style={styles.dayCard}>
                  {md.matches.map((m) => {
                    const globalIndex = orderedMatches.findIndex((x) => x.id === m.id);
                    const e = entries[m.id] ?? { home: "", away: "" };
                    const finished = m.status === "finished";
                    return (
                      <MatchPredictRow
                        key={m.id}
                        match={m}
                        entry={e}
                        locked={!deadlineOpen}
                        finished={finished}
                        homeRef={(r) => (inputRefs.current[globalIndex * 2] = r)}
                        awayRef={(r) => (inputRefs.current[globalIndex * 2 + 1] = r)}
                        onHome={(v) => {
                          setSlot(m.id, "home", v);
                          if (v) focusSlot(globalIndex * 2 + 1);
                        }}
                        onAway={(v) => {
                          setSlot(m.id, "away", v);
                          if (v) focusSlot((globalIndex + 1) * 2);
                        }}
                      />
                    );
                  })}
                </Card>
              </Animated.View>
            ))}
          </ScrollView>

          <View style={styles.submitBar}>
            <View style={styles.hideRow}>
              <View style={styles.hideText}>
                <Text variant="bodyMedium">Hide my picks until deadline</Text>
                <Text variant="caption" color="textTertiary">
                  {hidden
                    ? "Others won't be able to see your predictions until after the deadline."
                    : "Others can see your predictions as soon as you submit."}
                </Text>
              </View>
              <Switch
                value={hidden}
                onValueChange={onToggleHidden}
                disabled={!deadlineOpen}
                trackColor={{ true: colors.accent }}
              />
            </View>
            <View style={styles.submitRow}>
              <View style={styles.count}>
                <Text style={styles.countNum} tabular>{filledCount}</Text>
                <Text variant="caption" color="textTertiary" tabular>/{orderedMatches.length} entered</Text>
              </View>
              <View style={styles.submitBtn}>
                <SolidButton
                  label="Submit predictions"
                  onPress={onSubmit}
                  loading={submit.isPending}
                  disabled={!deadlineOpen || filledCount === 0}
                />
              </View>
            </View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function MatchPredictRow({
  match,
  entry,
  locked,
  finished,
  homeRef,
  awayRef,
  onHome,
  onAway,
}: {
  match: MatchWithTeams;
  entry: Entry;
  locked: boolean;
  finished: boolean;
  homeRef: (r: TextInput | null) => void;
  awayRef: (r: TextInput | null) => void;
  onHome: (v: string) => void;
  onAway: (v: string) => void;
}) {
  return (
    <View style={styles.matchRow}>
      <View style={[styles.team, styles.teamHome]}>
        <Text variant="bodyMedium" numberOfLines={1} style={styles.teamName}>
          {match.homeTeam.shortName || match.homeTeam.name}
        </Text>
        <TeamCrest name={match.homeTeam.name} code={match.homeTeam.code} logo={match.homeTeam.logo} size={24} />
      </View>

      <View style={styles.scores}>
        <ScoreInput
          ref={homeRef}
          value={entry.home}
          onChangeText={onHome}
          locked={locked && !finished}
          finalDisplay={finished ? String(match.homeScore ?? 0) : undefined}
        />
        <Text variant="numeral" color="textTertiary">:</Text>
        <ScoreInput
          ref={awayRef}
          value={entry.away}
          onChangeText={onAway}
          locked={locked && !finished}
          finalDisplay={finished ? String(match.awayScore ?? 0) : undefined}
        />
      </View>

      <View style={[styles.team, styles.teamAway]}>
        <TeamCrest name={match.awayTeam.name} code={match.awayTeam.code} logo={match.awayTeam.logo} size={24} />
        <Text variant="bodyMedium" numberOfLines={1} style={styles.teamName}>
          {match.awayTeam.shortName || match.awayTeam.name}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: layout.gutter },
  content: { padding: layout.gutter, paddingBottom: spacing.xxxl, gap: spacing.lg },
  day: { gap: spacing.xs },
  dayCard: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  team: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  teamHome: { justifyContent: "flex-end" },
  teamAway: { justifyContent: "flex-start" },
  teamName: { flexShrink: 1 },
  scores: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  submitBar: {
    padding: layout.gutter,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  hideRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  hideText: { flex: 1, gap: 2 },
  submitRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.lg },
  count: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  countNum: { fontFamily: fontFamily.bold, fontSize: 20, color: colors.textPrimary },
  submitBtn: { flex: 1 },
});
