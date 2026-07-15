import { forwardRef } from "react";
import { TextInput, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { colors, radius, type as typeScale } from "@/constants/theme";

type ScoreInputProps = {
  value: string;
  onChangeText: (v: string) => void;
  /** Deadline passed → non-editable locked display. */
  locked?: boolean;
  /** Finished match: show the actual score, muted. */
  finalDisplay?: string;
  accentColor?: string;
  onSubmitEditing?: () => void;
  autoFocus?: boolean;
};

// ScoreInput — single-digit score box (spec §3). Regex-gated to 0–9, auto-
// advance is orchestrated by the parent via refs + onSubmitEditing/onChangeText.
// Locked state shows a muted digit; empty-at-deadline shows "–".
export const ScoreInput = forwardRef<TextInput, ScoreInputProps>(function ScoreInput(
  { value, onChangeText, locked, finalDisplay, accentColor = colors.accent, onSubmitEditing, autoFocus },
  ref
) {
  if (locked || finalDisplay != null) {
    return (
      <View style={[styles.box, styles.lockedBox]}>
        <Text variant="numeral" color="textTertiary">
          {finalDisplay ?? (value === "" ? "–" : value)}
        </Text>
        {locked && finalDisplay == null ? (
          <Ionicons name="lock-closed" size={10} color={colors.textTertiary} style={styles.lock} />
        ) : null}
      </View>
    );
  }

  return (
    <TextInput
      ref={ref}
      value={value}
      onChangeText={(t) => {
        const digit = t.replace(/[^\d]/g, "").slice(-1); // keep last typed digit
        if (digit === "" || /^\d$/.test(digit)) onChangeText(digit);
      }}
      keyboardType="number-pad"
      inputMode="numeric"
      maxLength={1}
      returnKeyType="next"
      onSubmitEditing={onSubmitEditing}
      autoFocus={autoFocus}
      selectTextOnFocus
      style={[styles.box, styles.input, { borderColor: value ? accentColor : colors.border }]}
    />
  );
});

const styles = StyleSheet.create({
  box: {
    width: 48,
    height: 56,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    ...typeScale.numeral,
    textAlign: "center",
    color: colors.textPrimary,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
  },
  lockedBox: { backgroundColor: colors.surfaceAlt },
  lock: { position: "absolute", bottom: 4, right: 4 },
});
