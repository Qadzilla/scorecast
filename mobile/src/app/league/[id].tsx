import { useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import * as Clipboard from "expo-clipboard";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Text } from "@/components/Text";
import { Card } from "@/components/Card";
import { SectionTitle } from "@/components/SectionTitle";
import { SegmentedControl } from "@/components/SegmentedControl";
import { CountdownCard } from "@/components/CountdownCard";
import { MatchRow } from "@/components/MatchRow";
import { LeaderboardRow } from "@/components/LeaderboardRow";
import { PredictionRow } from "@/components/PredictionRow";
import { PointsBadge } from "@/components/PointsBadge";
import { TeamCrest } from "@/components/TeamCrest";
import { Button } from "@/components/Button";
import { Banner } from "@/components/Banner";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton, SkeletonLines } from "@/components/Skeleton";
import { Sheet } from "@/components/Sheet";
import { useSession } from "@/lib/auth";
import { useLeagues, useCurrentGameweek, useGameweek, useLeaderboard, usePredictions } from "@/lib/queries";
import { upcomingDeadline } from "@/types/leagues";
import { isPredictionWindowOpen } from "@/types/fixtures";
import { outcomeFromPoints, type UserPrediction } from "@/types/predictions";
import { haptics } from "@/utils/haptics";
import { colors, spacing, layout, radius, competition, fontFamily } from "@/constants/theme";

type Pane = "fixtures" | "predictions" | "table";

export default function LeagueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const leagues = useLeagues();
  const league = leagues.data?.find((l) => l.id === id);

  const [pane, setPane] = useState<Pane>("table");
  const [infoOpen, setInfoOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const current = useCurrentGameweek(league?.type ?? "premier_league");
  const gameweek = useGameweek(current.data?.id);
  const board = useLeaderboard(id, true);

  const compColor = league ? competition[league.type].main : colors.plPurple;
  const deadlineOpen = current.data ? isPredictionWindowOpen(current.data.deadline) : false;

  const copyCode = async () => {
    if (!league) return;
    await Clipboard.setStringAsync(league.inviteCode);
    haptics.success();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (leagues.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="League" />
        <View style={styles.pad}><SkeletonLines count={4} /></View>
      </SafeAreaView>
    );
  }

  if (!league) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="League" />
        <View style={styles.pad}>
          <Banner kind="error" message="League not found or you're no longer a member." />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title={league.name}
        right={
          <View style={styles.headerActions}>
            {league.role === "admin" ? (
              <Pressable
                onPress={() => router.push({ pathname: "/league/manage", params: { leagueId: league.id } })}
                hitSlop={layout.hitSlop}
                accessibilityLabel="Manage league"
              >
                <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
              </Pressable>
            ) : null}
            <Pressable onPress={() => setInfoOpen(true)} hitSlop={layout.hitSlop} accessibilityLabel="League info">
              <Ionicons name="information-circle-outline" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>
        }
      />

      <View style={styles.segmentWrap}>
        <SegmentedControl
          segments={[
            { key: "table", label: "Table" },
            { key: "fixtures", label: "Fixtures" },
            { key: "predictions", label: "Predictions" },
          ]}
          value={pane}
          onChange={setPane}
          activeColor={colors.textPrimary}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View key={pane} entering={FadeIn.duration(220)} style={{ gap: spacing.md }}>
        {pane === "fixtures" && (
          <FixturesPane
            loading={current.isLoading || gameweek.isLoading}
            matchdays={gameweek.data?.matchdays}
          />
        )}

        {pane === "predictions" && (
          <View style={{ gap: spacing.lg }}>
            {current.isLoading ? (
              <CountdownCard competitionKey={league.type} deadline={new Date().toISOString()} state="loading" />
            ) : (
              (() => {
                const up = upcomingDeadline(current.data);
                return up ? (
                  <CountdownCard competitionKey={league.type} deadline={up.deadline} gameweekName={up.label} />
                ) : (
                  <Card>
                    <Text variant="heading" color="textSecondary">No upcoming deadline</Text>
                  </Card>
                );
              })()
            )}
            <Button
              label={deadlineOpen ? "Make / edit predictions" : "View predictions"}
              variant="brand"
              competitionKey={league.type}
              disabled={!current.data}
              onPress={() =>
                router.push({
                  pathname: "/league/predict",
                  params: { leagueId: league.id, gameweekId: current.data?.id ?? "" },
                })
              }
            />
            <View style={{ gap: spacing.sm }}>
              <SectionTitle label="Your predictions" />
              <PredictionsList leagueId={league.id} gameweekId={current.data?.id} />
            </View>
          </View>
        )}

        {pane === "table" && (
          <TablePane
            loading={board.isLoading}
            error={board.isError}
            entries={board.data?.entries}
            isSeasonComplete={board.data?.isSeasonComplete ?? false}
            userId={session?.user?.id}
            competitionKey={league.type}
            onPlayer={(e) =>
              router.push({
                pathname: "/league/player",
                params: {
                  leagueId: league.id,
                  gameweekId: current.data?.id ?? "",
                  userId: e.userId,
                  username: e.username,
                  teamLogo: e.teamLogo ?? "",
                  gwLabel: gameweek.data?.name ?? (current.data ? `Gameweek ${current.data.number}` : ""),
                },
              })
            }
          />
        )}
        </Animated.View>
      </ScrollView>

      <Sheet visible={infoOpen} onClose={() => setInfoOpen(false)} title="League info">
        <Text variant="caption" color="textSecondary">Invite code</Text>
        <Pressable onPress={copyCode} style={styles.codeBox}>
          <Text variant="numeral" style={{ letterSpacing: 4 }}>{league.inviteCode}</Text>
          <Ionicons name={copied ? "checkmark" : "copy-outline"} size={20} color={copied ? colors.accent : colors.textSecondary} />
        </Pressable>
        <Text variant="caption" color={copied ? "accent" : "textTertiary"} center>
          {copied ? "Copied!" : "Tap to copy — share it so friends can join."}
        </Text>
        <View style={styles.infoRow}>
          <Text variant="body" color="textSecondary">Competition</Text>
          <Text variant="bodyMedium">{competition[league.type].label}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text variant="body" color="textSecondary">Members</Text>
          <Text variant="bodyMedium">{league.memberCount}</Text>
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

function FixturesPane({
  loading,
  matchdays,
}: {
  loading: boolean;
  matchdays?: { id: string; date: string; matches: Parameters<typeof MatchRow>[0]["match"][] }[];
}) {
  if (loading) return <SkeletonLines count={5} />;
  if (!matchdays || matchdays.length === 0) {
    return <EmptyState icon="calendar-outline" title="No fixtures" subtitle="This gameweek has no matches yet." />;
  }
  return (
    <View style={{ gap: spacing.xl }}>
      {matchdays.map((md, mdi) => (
        <Animated.View key={md.id} entering={FadeInDown.duration(260).delay(mdi * 70)} style={{ gap: spacing.sm }}>
          <SectionTitle
            label={new Date(md.date).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" })}
          />
          <Card padded={false} style={styles.matchCard}>
            {md.matches.map((m, i) => (
              <View key={m.id} style={[styles.matchRowWrap, i === 0 && styles.noBorder]}>
                <MatchRow match={m} />
              </View>
            ))}
          </Card>
        </Animated.View>
      ))}
    </View>
  );
}

function PredictionsList({ leagueId, gameweekId }: { leagueId: string; gameweekId?: string }) {
  const preds = usePredictions(leagueId, gameweekId);
  if (preds.isLoading) return <SkeletonLines count={3} />;
  if (!preds.data || preds.data.length === 0) {
    return (
      <Text variant="caption" color="textTertiary" center>
        You haven't predicted this gameweek yet.
      </Text>
    );
  }
  return (
    <Card padded={false} style={styles.predCard}>
      {preds.data.map((p: UserPrediction, i) => (
        <Animated.View key={p.id} entering={FadeInDown.duration(240).delay(i * 40)}>
          <PredictionRow p={p} first={i === 0} />
        </Animated.View>
      ))}
    </Card>
  );
}

function TablePane({
  loading,
  error,
  entries,
  isSeasonComplete,
  userId,
  competitionKey,
  onPlayer,
}: {
  loading: boolean;
  error: boolean;
  entries?: { rank: number; userId: string; username: string; totalPoints: number; teamLogo: string | null }[];
  isSeasonComplete: boolean;
  userId?: string;
  competitionKey: "premier_league" | "champions_league";
  onPlayer: (e: { userId: string; username: string; teamLogo: string | null }) => void;
}) {
  if (loading) {
    return (
      <Card>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ paddingVertical: spacing.sm }}>
            <Skeleton width="70%" height={16} />
          </View>
        ))}
      </Card>
    );
  }
  if (error) return <Banner kind="error" message="Couldn't load the table." />;
  if (!entries || entries.length === 0) {
    return <EmptyState icon="podium-outline" title="No standings yet" subtitle="Standings appear once predictions are scored." />;
  }
  return (
    <Card padded={false}>
      <View style={styles.tableHead}>
        <Text style={[styles.colLabel, styles.colRank]}>#</Text>
        <Text style={[styles.colLabel, styles.colPlayer]}>Player</Text>
        <Text style={[styles.colLabel, styles.colPts]}>Pts</Text>
      </View>
      {entries.map((e, i) => (
        <Animated.View key={e.userId} entering={FadeInDown.duration(220).delay(i * 30)} style={i > 0 ? styles.rowDivider : undefined}>
          <Pressable onPress={() => onPlayer(e)} style={({ pressed }) => pressed && styles.rowPressed}>
            <LeaderboardRow
              rank={e.rank}
              username={e.username}
              points={e.totalPoints}
              teamLogo={e.teamLogo}
              isCurrentUser={e.userId === userId}
              isChampion={isSeasonComplete && e.rank === 1}
              competitionKey={competitionKey}
            />
          </Pressable>
        </Animated.View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: layout.gutter, gap: spacing.md },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  segmentWrap: { paddingHorizontal: layout.gutter, paddingBottom: spacing.md },
  content: { paddingHorizontal: layout.gutter, paddingBottom: spacing.xxxl, gap: spacing.md },
  matchCard: { paddingHorizontal: layout.cardPadding },
  matchRowWrap: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  noBorder: { borderTopWidth: 0 },
  predCard: { paddingHorizontal: layout.cardPadding },
  predRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  predScoreChip: {
    backgroundColor: colors.textPrimary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    minWidth: 56,
    alignItems: "center",
  },
  predBadge: { position: "absolute", right: 0, top: 0, bottom: 0, justifyContent: "center" },
  tableHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  colLabel: { fontFamily: fontFamily.semibold, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: colors.textTertiary },
  colRank: { width: 28, textAlign: "center" },
  colPlayer: { flex: 1, marginLeft: 30 + spacing.md },
  colPts: { width: 44, textAlign: "right" },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
