import { useState } from "react";
import { View, TextInput, StyleSheet, Pressable, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { brand } from "@/constants/brand";
import { spacing, layout, fontFamily } from "@/constants/theme";

type FieldProps = TextInputProps & {
  label: string;
  error?: string;
  secureToggle?: boolean;
};

// The auth underline field: uppercase micro-label, navy value on a hairline
// rule that brightens to blue on focus (red on error). Signature input of the
// blueprint design language.
export function Field({ label, error, secureToggle, secureTextEntry, ...rest }: FieldProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);
  const ruleColor = error ? brand.danger : focused ? brand.line : brand.faint;

  return (
    <View style={styles.field}>
      <Text style={styles.microLabel}>{label}</Text>
      <View
        style={[
          styles.rule,
          { borderBottomColor: ruleColor, borderBottomWidth: focused || error ? 2 : 1.5 },
        ]}
      >
        <TextInput
          style={styles.input}
          placeholderTextColor={brand.faint}
          secureTextEntry={secureToggle ? hidden : secureTextEntry}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
        {secureToggle ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={layout.hitSlop}>
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={20} color={brand.muted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  microLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: brand.faint,
  },
  rule: { flexDirection: "row", alignItems: "center", paddingBottom: 8 },
  input: { flex: 1, fontFamily: fontFamily.medium, fontSize: 18, color: brand.ink, padding: 0 },
  error: { fontFamily: fontFamily.regular, fontSize: 12, color: brand.danger, marginTop: 2 },
});
