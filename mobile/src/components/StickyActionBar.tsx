import { type ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, layout, spacing } from "@/constants/theme";

// A bottom-pinned action bar that keeps a screen's primary action in the thumb
// zone (UXR2). Render it as the LAST child of a full-height container whose
// SafeAreaView omits the bottom edge — the bar absorbs the bottom inset itself
// so its surface fill runs to the screen edge (no two-tone strip under it).
export function StickyActionBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>{children}</View>;
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
});
