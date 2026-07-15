import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { colors, spacing, radius, layout, competition, type CompetitionKey } from "@/constants/theme";

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
          <Ionicons name="trophy" size={18} color={colors.warning} />
        ) : (
          <Text variant="numeral" style={{ fontSize: 17, color: topThree ? comp.main : colors.textPrimary }}>
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
          <Text variant="caption" color="accent">
            You
          </Text>
        </View>
      ) : null}

      <Text variant="numeral" style={styles.points} tabular>
        {points}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: layout.rowMinHeight,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    borderRadius: radius.sm,
  },
  rankCell: { width: 32, alignItems: "center" },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  name: { flex: 1 },
  youChip: {
    backgroundColor: colors.accentTint,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  points: { fontSize: 17 },
});
