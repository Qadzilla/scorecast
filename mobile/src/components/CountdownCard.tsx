import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Card } from "./Card";
import { Text } from "./Text";
import { Skeleton } from "./Skeleton";
import { getTimeRemaining } from "@/types/fixtures";
import { colors, spacing, competition, type CompetitionKey, type ColorToken } from "@/constants/theme";

type CountdownCardProps = {
  competitionKey: CompetitionKey;
  deadline: string; // ISO
  gameweekName?: string;
  /** Force a non-time state. */
  state?: "loading" | "live";
};

// CountdownCard — competition-railed card with a DD:HH:MM:SS tick and threshold
// states (spec §3): normal, <24h (warning), <1h (danger), passed, live, loading.
export function CountdownCard({ competitionKey, deadline, gameweekName, state }: CountdownCardProps) {
  const comp = competition[competitionKey];
  const [remaining, setRemaining] = useState(() => getTimeRemaining(deadline));

  useEffect(() => {
    if (state) return; // no ticking for loading/live
    setRemaining(getTimeRemaining(deadline));
    const id = setInterval(() => setRemaining(getTimeRemaining(deadline)), 1000);
    return () => clearInterval(id);
  }, [deadline, state]);

  if (state === "loading") {
    return (
      <Card railColor={comp.main}>
        <Skeleton width="40%" height={12} />
        <View style={{ height: spacing.sm }} />
        <Skeleton width="70%" height={30} />
      </Card>
    );
  }

  const passed = state !== "live" && remaining.total <= 0;
  const urgent: { rail?: string; digit: ColorToken } =
    remaining.total > 0 && remaining.total < 60 * 60 * 1000
      ? { rail: colors.danger, digit: "danger" }
      : remaining.total > 0 && remaining.total < 24 * 60 * 60 * 1000
        ? { rail: colors.warning, digit: "warning" }
        : { digit: "textPrimary" };

  const railColor = state === "live" ? colors.accent : urgent.rail ?? comp.main;

  return (
    <Card railColor={railColor}>
      <Text variant="label" style={{ color: railColor }}>
        {comp.label}
      </Text>

      {state === "live" ? (
        <Text variant="title" color="accent" style={styles.body}>
          Matches in play
        </Text>
      ) : passed ? (
        <Text variant="title" color="textSecondary" style={styles.body}>
          Deadline passed — GW locked
        </Text>
      ) : (
        <View style={[styles.body, styles.digits]}>
          <TimeGroup value={remaining.days} unit="days" color={urgent.digit} />
          <Colon />
          <TimeGroup value={remaining.hours} unit="hrs" color={urgent.digit} />
          <Colon />
          <TimeGroup value={remaining.minutes} unit="min" color={urgent.digit} />
          <Colon />
          <TimeGroup value={remaining.seconds} unit="sec" color={urgent.digit} />
        </View>
      )}

      {gameweekName ? (
        <Text variant="caption" color="textSecondary" style={styles.footer}>
          {gameweekName}
        </Text>
      ) : null}
    </Card>
  );
}

function TimeGroup({ value, unit, color }: { value: number; unit: string; color: ColorToken }) {
  return (
    <View style={styles.group}>
      <Text variant="numeralLg" color={color}>
        {String(value).padStart(2, "0")}
      </Text>
      <Text variant="caption" color="textTertiary">
        {unit}
      </Text>
    </View>
  );
}

function Colon() {
  return (
    <Text variant="numeralLg" color="textTertiary" style={styles.colon}>
      :
    </Text>
  );
}

const styles = StyleSheet.create({
  body: { marginTop: spacing.sm },
  digits: { flexDirection: "row", alignItems: "flex-start" },
  group: { alignItems: "center" },
  colon: { marginHorizontal: spacing.sm, marginTop: -2 },
  footer: { marginTop: spacing.sm },
});
