import { View, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text } from "./Text";
import { colors, spacing, layout } from "@/constants/theme";

type ScreenHeaderProps = {
  title: string;
  /** "large" = left-aligned display title (tab roots); "nav" = centered with back chevron. */
  variant?: "large" | "nav";
  onBack?: () => void; // defaults to router.back()
  right?: React.ReactNode;
};

// ScreenHeader — two variants (spec §3). Transparent over the screen bg.
export function ScreenHeader({ title, variant = "nav", onBack, right }: ScreenHeaderProps) {
  const router = useRouter();
  const back = onBack ?? (() => router.back());

  if (variant === "large") {
    return (
      <View style={styles.large}>
        <Text variant="display">{title}</Text>
        {right}
      </View>
    );
  }

  return (
    <View style={styles.nav}>
      <Pressable
        onPress={back}
        hitSlop={layout.hitSlop}
        style={styles.side}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
      </Pressable>
      <Text variant="heading" center numberOfLines={1} style={styles.navTitle}>
        {title}
      </Text>
      <View style={styles.side}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  large: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: layout.gutter,
    paddingVertical: spacing.md,
  },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.sm,
  },
  side: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  navTitle: { flex: 1 },
});
