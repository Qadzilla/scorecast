import { View, StyleSheet } from "react-native";
import { Text } from "./Text";
import { colors, radius, spacing, type ColorToken } from "@/constants/theme";
import type { PredictionOutcome } from "@/types/predictions";

type PointsBadgeProps = {
  /** Outcome once scored, or "pending" while the match is live/unscored. */
  outcome: PredictionOutcome | "pending";
  points?: number;
};

// PointsBadge — pill mapping outcome → token colors (spec §3). Replaces the web
// app's Tailwind getPointsBadgeColor. exact=accent fill, result=accentTint,
// miss=surfaceAlt muted, pending=warningTint.
const MAP: Record<PredictionOutcome | "pending", { fill: ColorToken; fg: ColorToken; text: string }> = {
  exact: { fill: "accent", fg: "textOnBrand", text: "3 pts" },
  result: { fill: "accentTint", fg: "accent", text: "1 pt" },
  incorrect: { fill: "surfaceAlt", fg: "textTertiary", text: "0 pts" },
  pending: { fill: "warningTint", fg: "warning", text: "…" },
};

export function PointsBadge({ outcome, points }: PointsBadgeProps) {
  const c = MAP[outcome];
  const label =
    points != null && outcome !== "pending" ? `${points} ${points === 1 ? "pt" : "pts"}` : c.text;
  return (
    <View style={[styles.pill, { backgroundColor: colors[c.fill] }]}>
      <Text variant="caption" color={c.fg} style={styles.text}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 24,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  text: { fontWeight: "700" },
});
