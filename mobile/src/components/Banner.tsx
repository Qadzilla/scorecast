import { View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { colors, radius, spacing, layout, type ColorToken } from "@/constants/theme";

export type BannerKind = "error" | "offline" | "success" | "info";

type BannerProps = {
  kind: BannerKind;
  message: string;
  onRetry?: () => void; // shown for error/offline
};

const CONFIG: Record<
  BannerKind,
  { fill: ColorToken; fg: ColorToken; icon: keyof typeof Ionicons.glyphMap }
> = {
  error: { fill: "dangerTint", fg: "danger", icon: "alert-circle" },
  offline: { fill: "warningTint", fg: "warning", icon: "cloud-offline" },
  success: { fill: "accentTint", fg: "accent", icon: "checkmark-circle" },
  info: { fill: "surfaceAlt", fg: "textSecondary", icon: "information-circle" },
};

// Banner — inline strip, tint fill + full-strength icon/text (spec §3).
export function Banner({ kind, message, onRetry }: BannerProps) {
  const c = CONFIG[kind];
  return (
    <View style={[styles.wrap, { backgroundColor: colors[c.fill] }]}>
      <Ionicons name={c.icon} size={18} color={colors[c.fg]} />
      <Text variant="caption" color={c.fg} style={styles.msg}>
        {message}
      </Text>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={layout.hitSlop} accessibilityRole="button">
          <Text variant="caption" color={c.fg} style={styles.retry}>
            Retry
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  msg: { flex: 1 },
  retry: { textDecorationLine: "underline" },
});
