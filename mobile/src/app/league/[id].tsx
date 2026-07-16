import { useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import * as Clipboard from "expo-clipboard";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Text } from "@/components/Text";
import { Card } from "@/components/Card";
import { SegmentedControl } from "@/components/SegmentedControl";
import { CountdownCard } from "@/components/CountdownCard";
import { MatchRow } from "@/components/MatchRow";
import { LeaderboardRow } from "@/components/LeaderboardRow";
import { Button } from "@/components/Button";
import { Banner } from "@/components/Banner";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton, SkeletonLines } from "@/components/Skeleton";
import { Sheet } from "@/components/Sheet";
import { useSession } from "@/lib/auth";
import { useLeagues, useCurrentGameweek, useGameweek, useLeaderboard } from "@/lib/queries";
import { upcomingDeadline } from "@/types/leagues";
import { isPredictionWindowOpen } from "@/types/fixtures";
import { haptics } from "@/utils/haptics";
import { colors, spacing, layout, competition } from "@/constants/theme";

type Pane = "fixtures" | "predictions" | "table";

export default function LeagueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const leagues = useLeagues();
  const league = leagues.data?.find((l) => l.id === id);

  const [pane, setPane] = useState<Pane>("fixtures");
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
          <Pressable onPress={() => setInfoOpen(true)} hitSlop={layout.hitSlop} accessibilityLabel="League info">
            <Ionicons name="information-circle-outline" size={24} color={colors.textPrimary} />
          </Pressable>
        }
      />

      <View style={styles.segmentWrap}>
        <SegmentedControl
          segments={[
            { key: "fixtures", label: "Fixtures" },
            { key: "predictions", label: "Predictions" },
            { key: "table", label: "Table" },
          ]}
          value={pane}
          onChange={setPane}
          activeColor={compColor}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {pane === "fixtures" && (
          <FixturesPane
            loading={current.isLoading || gameweek.isLoading}
            gwName={gameweek.data?.name ?? (current.data ? `Gameweek ${current.data.number}` : "")}
            matchdays={gameweek.data?.matchdays}
          />
        )}

        {pane === "predictions" && (
          <View style={{ gap: spacing.md }}>
            {current.isLoading ? (
              <CountdownCard competitionKey={league.type} deadline={new Date().toISOString()} state="loading" />
            ) : (
              (() => {
                const up = upcomingDeadline(current.data);
                return up ? (
                  <CountdownCard competitionKey={league.type} deadline={up.deadline} gameweekName={up.label} />
                ) : (
                  <Card railColor={compColor}>
                    <Text variant="title" color="textSecondary">No upcoming deadline</Text>
                  </Card>
                );
              })()
            )}
            <Button
              label={deadlineOpen ? "Make / edit predictions" : "Deadline passed"}
              variant="brand"
              competitionKey={league.type}
              disabled={!deadlineOpen || !current.data}
              onPress={() =>
                router.push({
                  pathname: "/league/predict",
                  params: { leagueId: league.id, gameweekId: current.data?.id ?? "" },
                })
              }
            />
            <Text variant="caption" color="textTertiary" center>
              Your predictions and points show here (MS15).
            </Text>
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
          />
        )}
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
  gwName,
  matchdays,
}: {
  loading: boolean;
  gwName: string;
  matchdays?: { id: string; date: string; matches: Parameters<typeof MatchRow>[0]["match"][] }[];
}) {
  if (loading) return <SkeletonLines count={5} />;
  if (!matchdays || matchdays.length === 0) {
    return <EmptyState icon="calendar-outline" title="No fixtures" subtitle="This gameweek has no matches yet." />;
  }
  return (
    <View style={{ gap: spacing.lg }}>
      {gwName ? <Text variant="heading">{gwName}</Text> : null}
      {matchdays.map((md) => (
        <View key={md.id} style={{ gap: spacing.xs }}>
          <Text variant="label" color="textSecondary">
            {new Date(md.date).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}
          </Text>
          <Card padded={false} style={styles.matchCard}>
            {md.matches.map((m) => (
              <View key={m.id} style={styles.matchRowWrap}>
                <MatchRow match={m} />
              </View>
            ))}
          </Card>
        </View>
      ))}
    </View>
  );
}

function TablePane({
  loading,
  error,
  entries,
  isSeasonComplete,
  userId,
  competitionKey,
}: {
  loading: boolean;
  error: boolean;
  entries?: { rank: number; userId: string; username: string; totalPoints: number }[];
  isSeasonComplete: boolean;
  userId?: string;
  competitionKey: "premier_league" | "champions_league";
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
    <Card padded={false} style={{ paddingVertical: spacing.sm }}>
      {entries.map((e) => (
        <LeaderboardRow
          key={e.userId}
          rank={e.rank}
          username={e.username}
          points={e.totalPoints}
          isCurrentUser={e.userId === userId}
          isChampion={isSeasonComplete && e.rank === 1}
          competitionKey={competitionKey}
        />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: layout.gutter, gap: spacing.md },
  segmentWrap: { paddingHorizontal: layout.gutter, paddingBottom: spacing.md },
  content: { paddingHorizontal: layout.gutter, paddingBottom: spacing.xxxl, gap: spacing.md },
  matchCard: { paddingHorizontal: layout.cardPadding },
  matchRowWrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
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
