import { useState } from "react";
import { View, StyleSheet, TextInput, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { TextField } from "./TextField";
import { SegmentedControl } from "./SegmentedControl";
import { CURRENCIES, currencySymbol, minorToMajorString, parseMoneyToMinor, type Currency } from "@/utils/money";
import type { PrizePool, PrizePoolInput, PrizePct } from "@/lib/queries";
import { colors, spacing, radius, fontFamily } from "@/constants/theme";

// Editable prize-pool form state (fee kept as a string while typing).
export interface PrizePoolFormState {
  currency: Currency;
  fee: string;
  pct: PrizePct;
}

export function defaultPrizePoolForm(): PrizePoolFormState {
  return { currency: "GBP", fee: "", pct: { first: 50, second: 25, third: 15, secondLast: 10 } };
}

// Seed the form from a saved pool (for the Manage screen).
export function prizePoolToForm(pool: PrizePool): PrizePoolFormState {
  return {
    currency: pool.currency,
    fee: minorToMajorString(pool.entryFeeMinor, pool.currency),
    pct: { ...pool.pct },
  };
}

// Validate → the API input, or a human message. Mirrors the server's rules.
export function validatePrizePoolForm(s: PrizePoolFormState): { input: PrizePoolInput } | { error: string } {
  const entryFeeMinor = parseMoneyToMinor(s.fee, s.currency);
  if (entryFeeMinor === null || entryFeeMinor <= 0) return { error: "Enter a valid entry fee." };
  const { first, second, third, secondLast } = s.pct;
  const sum = first + second + third + secondLast;
  if (sum !== 100) return { error: `Split must total 100% (currently ${sum}%).` };
  if (!(first >= second && second >= third && third >= secondLast)) {
    return { error: "Each place must pay at least as much as the next." };
  }
  return { input: { currency: s.currency, entryFeeMinor, pct: s.pct } };
}

const POSITIONS: { key: keyof PrizePct; label: string }[] = [
  { key: "first", label: "1st" },
  { key: "second", label: "2nd" },
  { key: "third", label: "3rd" },
  { key: "secondLast", label: "2nd last" },
];

export function PrizePoolEditor({
  value,
  onChange,
}: {
  value: PrizePoolFormState;
  onChange: (v: PrizePoolFormState) => void;
}) {
  const [showSplit, setShowSplit] = useState(false);
  const set = (patch: Partial<PrizePoolFormState>) => onChange({ ...value, ...patch });
  const setPct = (key: keyof PrizePct, n: number) => set({ pct: { ...value.pct, [key]: n } });
  const sum = value.pct.first + value.pct.second + value.pct.third + value.pct.secondLast;

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.sm }}>
        <Text variant="caption" color="textSecondary">Currency</Text>
        <SegmentedControl
          segments={CURRENCIES.map((c) => ({ key: c, label: c === "JOD" ? "JOD" : `${currencySymbol(c)} ${c}` }))}
          value={value.currency}
          onChange={(c) => set({ currency: c as Currency })}
        />
      </View>

      <TextField
        label={`Entry fee per player (${currencySymbol(value.currency)})`}
        value={value.fee}
        onChangeText={(t) => set({ fee: t.replace(/[^0-9.]/g, "") })}
        keyboardType="decimal-pad"
        placeholder="5"
      />

      <Pressable onPress={() => setShowSplit((s) => !s)} style={styles.disclosure}>
        <Text variant="bodyMedium" style={{ color: colors.accent }}>Customize split</Text>
        <Ionicons name={showSplit ? "chevron-up" : "chevron-down"} size={16} color={colors.accent} />
      </Pressable>

      {showSplit ? (
        <View style={{ gap: spacing.sm }}>
          <View style={styles.pctRow}>
            {POSITIONS.map((p) => (
              <View key={p.key} style={styles.pctCell}>
                <Text style={styles.pctLabel}>{p.label}</Text>
                <View style={styles.pctInputWrap}>
                  <TextInput
                    style={styles.pctInput}
                    value={String(value.pct[p.key])}
                    onChangeText={(t) => setPct(p.key, Math.min(100, Number(t.replace(/[^0-9]/g, "")) || 0))}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={styles.pctPercent}>%</Text>
                </View>
              </View>
            ))}
          </View>
          <Text variant="caption" color={sum === 100 ? "textTertiary" : "danger"}>
            {sum === 100 ? "Totals 100%" : `Totals ${sum}% — must be 100%`}
          </Text>
        </View>
      ) : (
        <Text variant="caption" color="textTertiary">
          1st {value.pct.first}% · 2nd {value.pct.second}% · 3rd {value.pct.third}% · 2nd-last {value.pct.secondLast}%
        </Text>
      )}

      <Text variant="caption" color="textTertiary">
        Pays 1st, 2nd, 3rd, and 2nd-last (unlocks at 5 players). The pool locks when the first deadline passes.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  disclosure: { flexDirection: "row", alignItems: "center", gap: 4 },
  pctRow: { flexDirection: "row", gap: spacing.sm },
  pctCell: { flex: 1, gap: 4 },
  pctLabel: { fontFamily: fontFamily.mono, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase", color: colors.textTertiary, textAlign: "center" },
  pctInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  pctInput: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.textPrimary, textAlign: "right", minWidth: 26, padding: 0 },
  pctPercent: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.textTertiary },
});
