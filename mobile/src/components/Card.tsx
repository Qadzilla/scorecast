import { View, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { colors, radius, shadow, layout } from "@/constants/theme";

type CardProps = {
  children: React.ReactNode;
  /** Optional 4pt competition-colored left rail. */
  railColor?: string;
  onPress?: () => void;
  style?: ViewStyle;
  padded?: boolean;
};

// Card — surface, radius 14, shadow, optional left rail + press state (spec §3).
export function Card({ children, railColor, onPress, style, padded = true }: CardProps) {
  const body = (
    <View style={[styles.inner, padded && styles.padded, railColor && styles.withRail]}>
      {children}
    </View>
  );

  const content = (
    <>
      {railColor ? <View style={[styles.rail, { backgroundColor: railColor }]} /> : null}
      {body}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
    flexDirection: "row",
    ...shadow.card,
  },
  pressed: { backgroundColor: colors.surfaceAlt },
  rail: { width: 3 },
  inner: { flex: 1 },
  padded: { padding: layout.cardPadding },
  withRail: {},
});
