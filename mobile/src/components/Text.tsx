import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import {
  colors,
  type as typeScale,
  tabularNums,
  MAX_FONT_SCALE,
  type ColorToken,
  type TypeVariant,
} from "@/constants/theme";

type TextProps = RNTextProps & {
  variant?: TypeVariant;
  color?: ColorToken;
  center?: boolean;
  /** Force tabular figures (auto-on for numeral variants). */
  tabular?: boolean;
};

/**
 * The single text primitive. Resolves a type variant + color token to styles,
 * clamps Dynamic Type to 1.4×, and turns on tabular figures for numerals so
 * scores/countdowns don't jitter (MOBILE_DESIGN_SPEC.md §2.2).
 */
export function Text({
  variant = "body",
  color = "textPrimary",
  center,
  tabular,
  style,
  maxFontSizeMultiplier = MAX_FONT_SCALE,
  ...rest
}: TextProps) {
  const isNumeral = variant === "numeral" || variant === "numeralLg";
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        typeScale[variant],
        { color: colors[color] },
        center && { textAlign: "center" },
        (tabular ?? isNumeral) && tabularNums,
        style,
      ]}
      {...rest}
    />
  );
}
