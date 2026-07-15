import { useState } from "react";
import { View, TextInput, StyleSheet, Pressable, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { colors, radius, spacing, fontFamily, type as typeScale, layout } from "@/constants/theme";

type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string;
  /** Focus-ring color; defaults to accent, pass a competition color when scoped. */
  accentColor?: string;
  secureToggle?: boolean;
};

// TextField — filled surfaceAlt, focus ring, error line (spec §3). RHF wires
// via <Controller> passing value/onChangeText/onBlur.
export function TextField({
  label,
  error,
  accentColor = colors.accent,
  secureToggle,
  secureTextEntry,
  style,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);

  const borderColor = error ? colors.danger : focused ? accentColor : colors.border;
  const borderWidth = error || focused ? 2 : 1;

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="caption" color="textSecondary" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <View style={[styles.field, { borderColor, borderWidth }]}>
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={colors.textTertiary}
          secureTextEntry={secureToggle ? hidden : secureTextEntry}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {secureToggle ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={layout.hitSlop}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
          >
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={20} color={colors.textTertiary} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" color="danger" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { marginLeft: 2, fontFamily: fontFamily.semibold },
  field: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    ...typeScale.body,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
  },
  error: { marginLeft: 2 },
});
