import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { colors, spacing, radius, competition, fontFamily, type CompetitionKey } from "@/constants/theme";

type LeaderboardRowProps = {
  rank: number;
  username: string;
  points: number;
  isCurrentUser?: boolean;
  isChampion?: boolean; // season complete, rank 1
  competitionKey?: CompetitionKey;
};

// LeaderboardRow — rank · avatar-initials · username (+"You") · points (spec §3).
// Top-3 ranks take the competition color; own row gets a tinted background;
// champion gets a gold trophy.
export function LeaderboardRow({
  rank,
  username,
  points,
  isCurrentUser,
  isChampion,
  competitionKey = "premier_league",
}: LeaderboardRowProps) {
  const comp = competition[competitionKey];
  const topThree = rank <= 3;

  return (
    <View style={[styles.row, isCurrentUser && { backgroundColor: comp.tint }]}>
      <View style={styles.rankCell}>
        {isChampion ? (
          <Ionicons name="trophy" size={16} color={colors.warning} />
        ) : (
          <Text variant="numeral" tabular style={{ fontSize: 15, color: topThree ? comp.main : colors.textSecondary }}>
            {rank}
          </Text>
        )}
      </View>

      <View style={[styles.avatar, { backgroundColor: comp.main }]}>
        <Text variant="caption" color="textOnBrand">
          {username.slice(0, 1).toUpperCase()}
        </Text>
      </View>

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
  avatar: { width: 30, height: 30, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
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
