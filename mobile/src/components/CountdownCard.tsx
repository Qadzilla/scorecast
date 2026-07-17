import { useEffect, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { getTimeRemaining } from "@/types/fixtures";
import { colors, spacing, radius, layout, competition, fontFamily, type CompetitionKey } from "@/constants/theme";

type CountdownCardProps = {
  competitionKey: CompetitionKey;
  deadline: string; // ISO
  gameweekName?: string;
  state?: "loading" | "live";
  /** When set, the whole card becomes a button (UXR1) — the countdown is the
   *  front door to predicting, not a dead-end. */
  onPress?: () => void;
  /** Footer affordance shown when the card is a button, e.g. "Predict now". */
  actionLabel?: string;
};

// Dark-navy hero — a piece of the app icon dropped into the light UI. Off-white
// mono digits, a bright-blue competition dot, small-caps mono label. Urgency
// (<24h / <1h) shows in the digit + dot color. The focal element of the home.
const NAVY = "#1d2d3d";
const NAVY_BORDER = "#2c4056";
const ON = colors.textOnBrand; // off-white
const DIM = "#8ba0b6"; // muted light (units, gw name)
const ACCENT = colors.neon; // bright line-blue

export function CountdownCard({ competitionKey, deadline, gameweekName, state, onPress, actionLabel }: CountdownCardProps) {
  const comp = competition[competitionKey];
  const [remaining, setRemaining] = useState(() => getTimeRemaining(deadline));

  useEffect(() => {
    if (state) return;
    setRemaining(getTimeRemaining(deadline));
    const id = setInterval(() => setRemaining(getTimeRemaining(deadline)), 1000);
    return () => clearInterval(id);
  }, [deadline, state]);

  if (state === "loading") {
    return (
      <View style={styles.card}>
        <View style={styles.head}>
          <View style={[styles.dot, { backgroundColor: DIM }]} />
          <Text style={styles.label}>{comp.label}</Text>
        </View>
        <View style={styles.loadingBar} />
      </View>
    );
  }

  const passed = state !== "live" && remaining.total <= 0;
  const urgentColor =
    remaining.total > 0 && remaining.total < 60 * 60 * 1000
      ? colors.danger
      : remaining.total > 0 && remaining.total < 24 * 60 * 60 * 1000
        ? colors.warning
        : null;
  const dotColor = state === "live" ? colors.accent : passed ? DIM : urgentColor ?? ACCENT;
  const digitColor = urgentColor ?? ON;

  const inner = (
    <>
      <View style={styles.head}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.label}>{comp.label}</Text>
        {gameweekName ? <Text style={styles.gw}>{gameweekName}</Text> : null}
      </View>

      {state === "live" ? (
        <Text style={[styles.state, { color: colors.accent }]}>Matches in play</Text>
      ) : passed ? (
        <Text style={[styles.state, { color: DIM }]}>Deadline passed — locked</Text>
      ) : (
        <View style={styles.digits}>
          <TimeGroup value={remaining.days} unit="days" color={digitColor} />
          <Colon />
          <TimeGroup value={remaining.hours} unit="hrs" color={digitColor} />
          <Colon />
          <TimeGroup value={remaining.minutes} unit="min" color={digitColor} />
          <Colon />
          <TimeGroup value={remaining.seconds} unit="sec" color={digitColor} />
        </View>
      )}

      {onPress && actionLabel ? (
        <View style={styles.action}>
          <Text style={styles.actionText}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={15} color={ACCENT} />
        </View>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={styles.card}>{inner}</View>;
}

function TimeGroup({ value, unit, color }: { value: number; unit: string; color: string }) {
  return (
    <View style={styles.group}>
      <Text style={[styles.digit, { color }]}>{String(value).padStart(2, "0")}</Text>
      <Text style={styles.unit}>{unit}</Text>
    </View>
  );
}

function Colon() {
  return <Text style={styles.colon}>:</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: NAVY,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: NAVY_BORDER,
    padding: layout.cardPadding,
  },
  pressed: { opacity: 0.9 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: NAVY_BORDER,
  },
  actionText: { fontFamily: fontFamily.mono, fontSize: 12, letterSpacing: 0.3, textTransform: "uppercase", color: ACCENT },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 7, height: 7, borderRadius: 4 },
  label: { fontFamily: fontFamily.mono, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: ON },
  gw: { marginLeft: "auto", fontFamily: fontFamily.mono, fontSize: 11, color: DIM },
  state: { marginTop: spacing.md, fontFamily: fontFamily.bold, fontSize: 17 },
  digits: { flexDirection: "row", alignItems: "flex-start", marginTop: spacing.md },
  group: { alignItems: "center" },
  digit: { fontFamily: fontFamily.monoBold, fontSize: 32, lineHeight: 36 },
  unit: { fontFamily: fontFamily.mono, fontSize: 10, color: DIM, marginTop: 2, textTransform: "uppercase" },
  colon: { fontFamily: fontFamily.monoBold, fontSize: 32, lineHeight: 36, color: DIM, marginHorizontal: spacing.sm },
  loadingBar: { marginTop: spacing.md, height: 32, width: "70%", borderRadius: radius.sm, backgroundColor: NAVY_BORDER },
});
