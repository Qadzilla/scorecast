import { View, StyleSheet } from "react-native";
import { Text } from "./Text";
import { TeamCrest } from "./TeamCrest";
import { PointsBadge } from "./PointsBadge";
import { outcomeFromPoints, type UserPrediction } from "@/types/predictions";
import { colors, spacing, radius, layout } from "@/constants/theme";

// One prediction row: home crest · navy score chip · away crest · points badge.
// Shared by "your predictions" and a player's predictions so they always match.
export function PredictionRow({ p, first }: { p: UserPrediction; first?: boolean }) {
  const settled = p.match.status === "finished";
  return (
    <View style={[styles.row, !first && styles.divider]}>
      <TeamCrest name={p.match.homeTeam.name} code={p.match.homeTeam.code} logo={p.match.homeTeam.logo} size={36} />
      <View style={styles.chip}>
        <Text variant="heading" color="textOnBrand" tabular>{p.predictedHome}</Text>
        <Text variant="heading" color="textOnBrand" style={styles.dash}>–</Text>
        <Text variant="heading" color="textOnBrand" tabular>{p.predictedAway}</Text>
      </View>
      <TeamCrest name={p.match.awayTeam.name} code={p.match.awayTeam.code} logo={p.match.awayTeam.logo} size={36} />
      {settled ? (
        <View style={styles.badge}>
          <PointsBadge outcome={outcomeFromPoints(p.points)} points={p.points ?? 0} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: layout.cardPadding,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  chip: {
    backgroundColor: colors.textPrimary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    minWidth: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  // Even breathing room on both sides of the dash — a touch more on the left so
  // the fatter digits (0/2/3…) don't crowd it.
  dash: { marginLeft: 5, marginRight: 4, opacity: 0.7 },
  badge: { position: "absolute", right: layout.cardPadding, top: 0, bottom: 0, justifyContent: "center" },
});
