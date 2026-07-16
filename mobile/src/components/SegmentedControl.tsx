import { View, Pressable, StyleSheet } from "react-native";
import { Text } from "./Text";
import { haptics } from "@/utils/haptics";
import { colors, radius, spacing, fontFamily } from "@/constants/theme";

type SegmentedControlProps<T extends string> = {
  segments: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  /** Active-segment fill color. Defaults to the brand navy (deadline-card dark). */
  activeColor?: string;
};

// SegmentedControl — a light track with the active segment filled (navy by
// default) and white text; inactive segments are muted. Selection haptic.
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  activeColor = colors.textPrimary,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.track}>
      {segments.map((seg) => {
        const active = seg.key === value;
        return (
          <Pressable
            key={seg.key}
            style={[styles.segment, active && { backgroundColor: activeColor }]}
            onPress={() => {
              if (!active) {
                haptics.select();
                onChange(seg.key);
              }
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text
              variant="bodyMedium"
              center
              style={{
                color: active ? colors.textOnBrand : colors.textSecondary,
                fontFamily: active ? fontFamily.semibold : fontFamily.medium,
              }}
            >
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: "center",
  },
});
