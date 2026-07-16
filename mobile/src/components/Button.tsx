import { ActivityIndicator, StyleSheet, type ViewStyle } from "react-native";
import { Text } from "./Text";
import { PressableScale } from "./PressableScale";
import { colors, radius, spacing, layout, competition, type CompetitionKey } from "@/constants/theme";

export type ButtonVariant = "primary" | "brand" | "secondary" | "destructive" | "ghost";

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  /** For variant="brand": which competition color to fill with. */
  competitionKey?: CompetitionKey;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  style?: ViewStyle;
};

// Button — 5 variants × {default, pressed, disabled, loading} (spec §3).
export function Button({
  label,
  onPress,
  variant = "primary",
  competitionKey = "premier_league",
  disabled,
  loading,
  compact,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const brandColor = competition[competitionKey].main;

  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.base,
        compact && styles.compact,
        variantStyle(variant, brandColor),
        isDisabled && styles.disabled,
        style,
      ].filter(Boolean) as ViewStyle[]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "secondary" || variant === "ghost" ? colors.accent : colors.textOnBrand} />
      ) : (
        <Text variant="bodyMedium" color={labelColor(variant)} center>
          {label}
        </Text>
      )}
    </PressableScale>
  );
}

function labelColor(variant: ButtonVariant): "textOnBrand" | "textPrimary" | "accent" {
  if (variant === "secondary") return "textPrimary";
  if (variant === "ghost") return "accent";
  return "textOnBrand";
}

function variantStyle(variant: ButtonVariant, brand: string): ViewStyle {
  switch (variant) {
    case "primary":
      return { backgroundColor: colors.accent };
    case "brand":
      return { backgroundColor: brand };
    case "secondary":
      return { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border };
    case "destructive":
      return { backgroundColor: colors.danger };
    case "ghost":
      return { backgroundColor: "transparent" };
  }
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  compact: { height: layout.minTouchTarget },
  disabled: { opacity: 0.4 },
});
