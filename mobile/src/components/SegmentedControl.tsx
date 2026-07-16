import { useEffect, useState } from "react";
import { View, Pressable, StyleSheet, type LayoutChangeEvent } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
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

const SPRING = { damping: 20, stiffness: 320, mass: 0.6 };

// SegmentedControl — a light track with a filled indicator (navy by default)
// that SLIDES to the active segment; active label is white, inactive muted.
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  activeColor = colors.textPrimary,
}: SegmentedControlProps<T>) {
  const [trackW, setTrackW] = useState(0);
  const count = segments.length;
  const gap = spacing.xs;
  const pad = spacing.xs;
  // Inner width available for the N segments (track minus padding), each segment
  // is (inner - gaps) / count; the indicator sits at index * (segW + gap).
  const inner = Math.max(0, trackW - pad * 2);
  const segW = count > 0 ? (inner - gap * (count - 1)) / count : 0;
  const activeIndex = Math.max(0, segments.findIndex((s) => s.key === value));

  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withSpring(activeIndex * (segW + gap), SPRING);
  }, [activeIndex, segW, gap, x]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    width: segW,
  }));

  const onTrackLayout = (e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width);

  return (
    <View style={styles.track} onLayout={onTrackLayout}>
      {trackW > 0 ? (
        <Animated.View style={[styles.indicator, { backgroundColor: activeColor }, indicatorStyle]} />
      ) : null}
      {segments.map((seg) => {
        const active = seg.key === value;
        return (
          <Pressable
            key={seg.key}
            style={styles.segment}
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
  indicator: {
    position: "absolute",
    top: spacing.xs,
    bottom: spacing.xs,
    left: spacing.xs,
    borderRadius: radius.sm,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: "center",
  },
});
