import { View, Pressable, StyleSheet } from "react-native";
import { Text } from "./Text";
import { colors, spacing, fontFamily } from "@/constants/theme";

// The single section-title pattern: an uppercase micro-label, a hairline rule
// that fills the remaining width, and an optional right-aligned action. Gives
// every screen the same editorial section rhythm.
export function SectionTitle({
  label,
  action,
  onAction,
}: {
  label: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.rule} />
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.action}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  label: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  action: { fontFamily: fontFamily.mono, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: colors.accent },
});
