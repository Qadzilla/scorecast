import { useRef, useState } from "react";
import { View, TextInput, Pressable, StyleSheet } from "react-native";
import { Text } from "./Text";
import { brand } from "@/constants/brand";
import { radius, spacing, fontFamily } from "@/constants/theme";

type OtpInputProps = {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  error?: boolean;
  onComplete?: (code: string) => void;
  autoFocus?: boolean;
};

// 6-box OTP entry backed by ONE hidden TextInput (spec §4). A single field is
// what makes iOS one-time-code autofill and paste work; the boxes are a visual
// overlay reflecting each digit. Tapping anywhere refocuses the field.
export function OtpInput({ value, onChange, length = 6, error, onComplete, autoFocus }: OtpInputProps) {
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const handleChange = (raw: string) => {
    const digits = raw.replace(/[^\d]/g, "").slice(0, length);
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
  };

  return (
    <Pressable style={styles.wrap} onPress={() => ref.current?.focus()}>
      {Array.from({ length }).map((_, i) => {
        const char = value[i] ?? "";
        const active = focused && i === value.length;
        return (
          <View
            key={i}
            style={[
              styles.box,
              char ? styles.filled : null,
              active ? styles.active : null,
              error ? styles.error : null,
            ]}
          >
            <Text style={styles.digit}>{char}</Text>
          </View>
        );
      })}

      <TextInput
        ref={ref}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        autoFocus={autoFocus}
        caretHidden
        style={styles.hidden}
      />
    </Pressable>
  );
}

const BOX = 48;
const styles = StyleSheet.create({
  wrap: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  box: {
    flex: 1,
    height: 56,
    maxWidth: BOX + 8,
    borderRadius: radius.sm,
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: brand.faint,
    alignItems: "center",
    justifyContent: "center",
  },
  filled: { borderColor: brand.line },
  active: { borderColor: brand.line },
  error: { borderColor: brand.danger },
  digit: { fontFamily: fontFamily.bold, fontSize: 24, color: brand.ink },
  hidden: { position: "absolute", width: 1, height: 1, opacity: 0 },
});
