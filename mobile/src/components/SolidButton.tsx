import { ActivityIndicator, StyleSheet, type ViewStyle } from "react-native";
import { Text } from "./Text";
import { PressableScale } from "./PressableScale";
import { brand } from "@/constants/brand";
import { radius, fontFamily } from "@/constants/theme";

// The blueprint primary button: a solid navy block (squared corners) with
// off-white text — the inverted primary that reads sharp on the light ground.
export function SolidButton({
  label,
  onPress,
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={loading || disabled}
      style={[styles.cta, disabled && styles.disabled, style as ViewStyle]}
    >
      {loading ? <ActivityIndicator color={brand.onInk} /> : <Text style={styles.text}>{label}</Text>}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  cta: {
    height: 54,
    borderRadius: radius.md,
    backgroundColor: brand.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.35 },
  text: { fontFamily: fontFamily.bold, fontSize: 16, color: brand.onInk },
});
