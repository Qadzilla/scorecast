import { View, StyleSheet } from "react-native";
import { Text } from "./Text";
import { TeamCrest } from "./TeamCrest";
import type { MatchWithTeams } from "@/types/fixtures";
import { colors, spacing, radius, layout } from "@/constants/theme";

type MatchRowProps = {
  match: MatchWithTeams;
  /** Optional center override (e.g. score inputs on the predict screen). */
  center?: React.ReactNode;
  right?: React.ReactNode; // e.g. a PointsBadge
};

function kickoffTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// MatchRow — home crest+name · center cell · away name+crest (spec §3). Center
// shows kickoff time before start, a score chip after, live gets an accent dot.
// Red cards render as a small red square with count beside the crest.
export function MatchRow({ match, center, right }: MatchRowProps) {
  const started = match.status === "live" || match.status === "finished";
  const live = match.status === "live";

  return (
    <View style={styles.row}>
      <View style={styles.side}>
        <Text variant="body" numberOfLines={1} style={styles.homeName}>
          {match.homeTeam.shortName || match.homeTeam.name}
        </Text>
        <RedCards count={match.homeRedCards} />
        <TeamCrest name={match.homeTeam.name} code={match.homeTeam.code} logo={match.homeTeam.logo} size={28} />
      </View>

      <View style={styles.center}>
        {center ??
          (started ? (
            <View style={styles.scoreChip}>
              {live ? <View style={styles.liveDot} /> : null}
              <Text variant="heading" tabular>
                {match.homeScore ?? 0} - {match.awayScore ?? 0}
              </Text>
            </View>
          ) : (
            <Text variant="bodyMedium" color="textSecondary">
              {kickoffTime(match.kickoffTime)}
            </Text>
          ))}
      </View>

      <View style={[styles.side, styles.sideRight]}>
        <TeamCrest name={match.awayTeam.name} code={match.awayTeam.code} logo={match.awayTeam.logo} size={28} />
        <RedCards count={match.awayRedCards} />
        <Text variant="body" numberOfLines={1} style={styles.awayName}>
          {match.awayTeam.shortName || match.awayTeam.name}
        </Text>
      </View>

      {right ? <View style={styles.rightSlot}>{right}</View> : null}
    </View>
  );
}

function RedCards({ count }: { count: number }) {
  if (!count) return null;
  return (
    <View style={styles.redCard}>
      <Text variant="caption" color="textOnBrand" style={styles.redCardText}>
        {count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: layout.rowMinHeight,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  side: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sideRight: { justifyContent: "flex-end" },
  homeName: { flexShrink: 1, textAlign: "right", flex: 1 },
  awayName: { flexShrink: 1, flex: 1 },
  center: { minWidth: 72, alignItems: "center" },
  scoreChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  redCard: { width: 12, height: 16, borderRadius: 2, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center" },
  redCardText: { fontSize: 9, lineHeight: 12 },
  rightSlot: { marginLeft: spacing.sm },
});
