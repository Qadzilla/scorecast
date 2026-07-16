import { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Text } from "@/components/Text";
import { Card } from "@/components/Card";
import { CountdownCard } from "@/components/CountdownCard";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { TeamCrest } from "@/components/TeamCrest";
import {
  useSession,
} from "@/lib/auth";
import {
  useLeagues,
  useCurrentGameweek,
  useFavoriteTeam,
  useLeaderboard,
  useMe,
} from "@/lib/queries";
import { upcomingDeadline, type League } from "@/types/leagues";
import { formatRank } from "@/types/predictions";
import { colors, spacing, layout, competition, type CompetitionKey } from "@/constants/theme";

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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text variant="caption" color="textSecondary">Welcome back</Text>
            <Text variant="display">{firstName}</Text>
          </View>
          {fav.data?.team ? (
            <TeamCrest
              name={fav.data.team.name}
              code={fav.data.team.code}
              logo={fav.data.team.logo}
              size={44}
            />
          ) : null}
        </View>

        {/* Deadlines */}
        <Text variant="label" color="textSecondary" style={styles.sectionLabel}>Next deadlines</Text>
        <View style={styles.deadlines}>
          <DeadlineCard competitionKey="premier_league" />
          <DeadlineCard competitionKey="champions_league" />
        </View>

        {/* Leagues */}
        <View style={[styles.sectionLabel, styles.sectionRow]}>
          <Text variant="label" color="textSecondary">Your leagues</Text>
          {me.data?.isAdmin ? (
            <Text variant="caption" color="accent" onPress={() => router.push("/league/create")}>
              + Create
            </Text>
          ) : null}
        </View>
        {leagues.isLoading ? (
          <View style={styles.list}>
            {[0, 1].map((i) => (
              <Card key={i}>
                <Skeleton width="60%" height={18} />
                <View style={{ height: spacing.sm }} />
                <Skeleton width="35%" height={12} />
              </Card>
            ))}
          </View>
        ) : leagues.data && leagues.data.length > 0 ? (
          <View style={styles.list}>
            {leagues.data.map((league) => (
              <LeagueCard
                key={league.id}
                league={league}
                userId={session?.user?.id}
                onPress={() => router.push({ pathname: "/league/[id]", params: { id: league.id } })}
              />
            ))}
          </View>
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
      </ScrollView>
    </SafeAreaView>
  );
}

// One countdown card per competition; handles loading and season-over states.
function DeadlineCard({ competitionKey }: { competitionKey: CompetitionKey }) {
  const gw = useCurrentGameweek(competitionKey);
  if (gw.isLoading) {
    return <CountdownCard competitionKey={competitionKey} deadline={new Date().toISOString()} state="loading" />;
  }
  const upcoming = upcomingDeadline(gw.data);
  if (!upcoming) {
    return (
      <Card railColor={competition[competitionKey].main}>
        <Text variant="label" style={{ color: competition[competitionKey].main }}>
          {competition[competitionKey].label}
        </Text>
        <Text variant="title" color="textSecondary" style={{ marginTop: spacing.sm }}>
          No upcoming deadline
        </Text>
      </Card>
    );
  }
  return (
    <CountdownCard
      competitionKey={competitionKey}
      deadline={upcoming.deadline}
      gameweekName={upcoming.label}
    />
  );
}

// A league row with the user's own standing (rank + points), pulled from the
// league's leaderboard.
function LeagueCard({
  league,
  userId,
  onPress,
}: {
  league: League;
  userId?: string;
  onPress: () => void;
}) {
  const board = useLeaderboard(league.id);
  const me = board.data?.entries.find((e) => e.userId === userId);

  return (
    <Card railColor={competition[league.type].main} onPress={onPress}>
      <View style={styles.leagueRow}>
        <View style={styles.leagueInfo}>
          <Text variant="heading" numberOfLines={1}>{league.name}</Text>
          <Text variant="caption" color="textSecondary">
            {competition[league.type].label} · {league.memberCount}{" "}
            {league.memberCount === 1 ? "member" : "members"}
          </Text>
        </View>
        <View style={styles.standing}>
          {board.isLoading ? (
            <Skeleton width={44} height={28} />
          ) : me ? (
            <>
              <Text variant="numeral" style={{ color: competition[league.type].main }}>
                {formatRank(me.rank)}
              </Text>
              <Text variant="caption" color="textSecondary">{me.totalPoints} pts</Text>
            </>
          ) : (
            <Text variant="caption" color="textTertiary">No standing yet</Text>
          )}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: layout.gutter, paddingBottom: spacing.xxxl, gap: spacing.md },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerText: { gap: 2 },
  sectionLabel: { marginTop: spacing.md },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  deadlines: { gap: spacing.md },
  list: { gap: spacing.md },
  leagueRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  leagueInfo: { flex: 1, gap: 2 },
  standing: { alignItems: "flex-end", minWidth: 56 },
});
