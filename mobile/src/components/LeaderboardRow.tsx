import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { TeamCrest } from "./TeamCrest";
import { medalColors, type Medal } from "@/constants/medals";
import { colors, spacing, radius, competition, fontFamily, type CompetitionKey } from "@/constants/theme";

type LeaderboardRowProps = {
  rank: number;
  username: string;
  points: number;
  teamLogo?: string | null;
  isCurrentUser?: boolean;
  isChampion?: boolean; // season complete, rank 1
  competitionKey?: CompetitionKey;
  isSecondLast?: boolean; // paid 2nd-last position (yellow medal) — pool only
};

// LeaderboardRow — rank · club crest · username (+"You") · points (spec §3).
// Paid positions get a medal-colored rank circle: gold/silver/bronze for the
// podium, yellow for 2nd-last. Own row gets a tinted background; a season
// champion keeps the trophy. The avatar is the player's favorite-team crest.
export function LeaderboardRow({
  rank,
  username,
  points,
  teamLogo,
  isCurrentUser,
  isChampion,
  competitionKey = "premier_league",
  isSecondLast,
}: LeaderboardRowProps) {
  const comp = competition[competitionKey];
  const medal: Medal | null =
    rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : isSecondLast ? "yellow" : null;

  return (
    <View style={[styles.row, isCurrentUser && { backgroundColor: comp.tint }]}>
      <View style={styles.rankCell}>
        {isChampion ? (
          <Ionicons name="trophy" size={16} color={medalColors.gold} />
        ) : medal ? (
          <View style={[styles.medalCircle, { backgroundColor: medalColors[medal] }]}>
            <Text style={styles.medalRank} tabular>{rank}</Text>
          </View>
        ) : (
          <Text variant="numeral" tabular style={{ fontSize: 15, color: colors.textSecondary }}>
            {rank}
          </Text>
        )}
      </View>

      <TeamCrest name={username} logo={teamLogo} size={28} fallbackColor={comp.main} />

      <Text variant="bodyMedium" numberOfLines={1} style={styles.name}>
        {username}
      </Text>
      {isCurrentUser ? (
        <View style={styles.youChip}>
          <Text style={styles.youText}>You</Text>
        </View>
      ) : null}

      <Text variant="numeral" tabular style={styles.points}>
        {points}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  rankCell: { width: 28, alignItems: "center" },
  medalCircle: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  medalRank: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.textPrimary },
  name: { flex: 1 },
  youChip: {
    backgroundColor: colors.accentTint,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  youText: {
    fontFamily: fontFamily.semibold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.accent,
  },
  points: { fontSize: 16, width: 44, textAlign: "right", color: colors.textPrimary },
});
