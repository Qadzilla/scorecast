import { useEffect } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
  ReduceMotion,
} from "react-native-reanimated";
import { colors, radius } from "@/constants/theme";

type SkeletonProps = {
  width?: ViewStyle["width"];
  height?: number;
  radius?: number;
  style?: ViewStyle;
};

/**
 * The loading primitive (MOBILE_DESIGN_SPEC.md §3): a surfaceAlt block with a
 * 1.2s opacity pulse. Every list screen composes its skeleton from these in
 * the shape of its real rows. Respects Reduce Motion (pulse disabled).
 */
export function Skeleton({ width = "100%", height = 16, radius: r = radius.sm, style }: SkeletonProps) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease), reduceMotion: ReduceMotion.System }),
      -1,
      true
    );
    return () => cancelAnimation(opacity);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[styles.base, { width, height, borderRadius: r }, animatedStyle, style]}
    />
  );
}

/** Convenience: a stack of full-width skeleton lines. */
export function SkeletonLines({ count = 3, gap = 12 }: { count?: number; gap?: number }) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={16} width={i === count - 1 ? "60%" : "100%"} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surfaceAlt,
  },
});
