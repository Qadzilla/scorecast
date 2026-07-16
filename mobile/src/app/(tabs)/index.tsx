import { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, Pressable } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/Text";
import { Card } from "@/components/Card";
import { CountdownCard } from "@/components/CountdownCard";
import { SectionTitle } from "@/components/SectionTitle";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { TeamCrest } from "@/components/TeamCrest";
import { useSession } from "@/lib/auth";
import { useLeagues, useCurrentGameweek, useFavoriteTeam, useLeaderboard, useMe } from "@/lib/queries";
import { upcomingDeadline, type League } from "@/types/leagues";
import { formatRank } from "@/types/predictions";
import { colors, spacing, layout, radius, competition, fontFamily, type CompetitionKey } from "@/constants/theme";

export default function LeaguesHomeScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const fav = useFavoriteTeam();
  const me = useMe();
  const leagues = useLeagues();
  const [refreshing, setRefreshing] = useState(false);

  const firstName =
    (session?.user as { firstName?: string } | undefined)?.firstName ??
    session?.user?.name?.split(" ")[0] ??
    "there";

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["leagues"] }),
      qc.invalidateQueries({ queryKey: ["gameweek"] }),
      qc.invalidateQueries({ queryKey: ["leaderboard"] }),
      qc.invalidateQueries({ queryKey: ["favorite-team"] }),
    ]);
    setRefreshing(false);
  }, [qc]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>Welcome back</Text>
            <Text style={styles.name}>{firstName}</Text>
          </View>
          {fav.data?.team ? (
            <TeamCrest name={fav.data.team.name} code={fav.data.team.code} logo={fav.data.team.logo} size={44} />
          ) : null}
        </View>

        <View style={styles.section}>
          <SectionTitle label="Next deadlines" />
          <View style={styles.deadlines}>
            <DeadlineCard competitionKey="premier_league" />
            <DeadlineCard competitionKey="champions_league" />
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle
            label="Your leagues"
            action={me.data?.isAdmin ? "Create" : undefined}
            onAction={() => router.push("/league/create")}
          />
          {leagues.isLoading ? (
            <Card padded={false}>
              {[0, 1].map((i) => (
                <View key={i} style={[styles.row, i === 0 && styles.rowDivider]}>
                  <View style={{ gap: 6 }}>
                    <Skeleton width={140} height={16} />
                    <Skeleton width={90} height={11} />
                  </View>
                </View>
              ))}
            </Card>
          ) : leagues.data && leagues.data.length > 0 ? (
            <Card padded={false}>
              {leagues.data.map((league, i) => (
                <Animated.View key={league.id} entering={FadeInDown.duration(260).delay(i * 45)}>
                  <LeagueRow
                    league={league}
                    userId={session?.user?.id}
                    first={i === 0}
                    onPress={() => router.push({ pathname: "/league/[id]", params: { id: league.id } })}
                  />
                </Animated.View>
              ))}
            </Card>
          ) : (
            <Card>
              <EmptyState
                icon="trophy-outline"
                title="No leagues yet"
                subtitle="Join your friends' league with an invite code to start predicting."
                actionLabel="Join a league"
                onAction={() => router.push("/league/join")}
              />
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DeadlineCard({ competitionKey }: { competitionKey: CompetitionKey }) {
  const gw = useCurrentGameweek(competitionKey);
  if (gw.isLoading) {
    return <CountdownCard competitionKey={competitionKey} deadline={new Date().toISOString()} state="loading" />;
  }
  const upcoming = upcomingDeadline(gw.data);
  if (!upcoming) {
    const comp = competition[competitionKey];
    return (
      <View style={styles.emptyDeadline}>
        <View style={styles.emptyHead}>
          <View style={[styles.dot, { backgroundColor: "#8ba0b6" }]} />
          <Text style={styles.emptyLabel}>{comp.label}</Text>
        </View>
        <Text style={styles.emptyText}>No upcoming deadline</Text>
      </View>
    );
  }
  return <CountdownCard competitionKey={competitionKey} deadline={upcoming.deadline} gameweekName={upcoming.label} />;
}

function LeagueRow({
  league,
  userId,
  first,
  onPress,
}: {
  league: League;
  userId?: string;
  first: boolean;
  onPress: () => void;
}) {
  const board = useLeaderboard(league.id);
  const me = board.data?.entries.find((e) => e.userId === userId);
  const compColor = competition[league.type].main;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, !first && styles.rowDivider, pressed && styles.rowPressed]}>
      <View style={styles.rowInfo}>
        <Text variant="heading" numberOfLines={1}>{league.name}</Text>
        <Text variant="caption" color="textSecondary">
          {competition[league.type].label} · {league.memberCount} {league.memberCount === 1 ? "member" : "members"}
        </Text>
      </View>
      <View style={styles.standing}>
        {board.isLoading ? (
          <Skeleton width={40} height={24} />
        ) : me ? (
          <>
            <Text variant="numeral" tabular style={{ color: compColor, fontSize: 18 }}>{formatRank(me.rank)}</Text>
            <Text variant="caption" color="textTertiary" tabular>{me.totalPoints} pts</Text>
          </>
        ) : (
          <Text variant="caption" color="textTertiary">—</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: layout.gutter, paddingBottom: spacing.xxxl, gap: spacing.xxl },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerText: { gap: 2 },
  eyebrow: { fontFamily: fontFamily.mono, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: colors.textTertiary },
  name: { fontFamily: fontFamily.extrabold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, color: colors.textPrimary },
  section: { gap: spacing.md },
  deadlines: { gap: spacing.md },
  dot: { width: 7, height: 7, borderRadius: 4 },
  emptyDeadline: {
    backgroundColor: "#1d2d3d",
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#2c4056",
    padding: layout.cardPadding,
  },
  emptyHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  emptyLabel: { fontFamily: fontFamily.mono, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: colors.textOnBrand },
  emptyText: { fontFamily: fontFamily.bold, fontSize: 17, color: "#8ba0b6", marginTop: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: layout.cardPadding,
    paddingVertical: spacing.md,
    minHeight: 64,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  rowInfo: { flex: 1, gap: 3 },
  standing: { alignItems: "flex-end", minWidth: 52 },
});
