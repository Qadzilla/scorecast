import { View, StyleSheet } from "react-native";
import { Text } from "./Text";
import { Card } from "./Card";
import { formatMoney } from "@/utils/money";
import type { PrizePool, PrizePayout } from "@/lib/queries";
import { colors, spacing, radius, fontFamily } from "@/constants/theme";

// Prize pool summary, shown above the Table (PP1c). Total pot, entry × players,
// and the four position payouts. Provisional until the pool freezes at GW1.
export function PrizePoolCard({ pool }: { pool: PrizePool }) {
  return (
    <Card>
      <View style={styles.head}>
        <Text variant="label" color="textSecondary">Prize pool</Text>
        <Text variant="caption" color={pool.frozen ? "textTertiary" : "accent"}>
          {pool.frozen ? "Final" : "Provisional · locks at GW1"}
        </Text>
      </View>

      <Text style={styles.total} tabular>{formatMoney(pool.poolMinor, pool.currency)}</Text>
      <Text variant="caption" color="textTertiary">
        {formatMoney(pool.entryFeeMinor, pool.currency)} × {pool.memberCount}{" "}
        {pool.memberCount === 1 ? "player" : "players"}
      </Text>

      <View style={styles.payouts}>
        <PayoutChip label="1st" payout={pool.payouts.first} currency={pool.currency} />
        <PayoutChip label="2nd" payout={pool.payouts.second} currency={pool.currency} />
        <PayoutChip label="3rd" payout={pool.payouts.third} currency={pool.currency} />
        {pool.payouts.secondLast ? (
          <PayoutChip label="2nd last" payout={pool.payouts.secondLast} currency={pool.currency} />
        ) : (
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>2nd last</Text>
            <Text style={styles.chipMuted}>at 5+</Text>
          </View>
        )}
      </View>
    </Card>
  );
}

function PayoutChip({
  label,
  payout,
  currency,
}: {
  label: string;
  payout: PrizePayout | null;
  currency: PrizePool["currency"];
}) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipAmount} tabular>
        {payout ? formatMoney(payout.amountMinor, currency) : "—"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  total: { fontFamily: fontFamily.extrabold, fontSize: 28, lineHeight: 32, color: colors.textPrimary },
  payouts: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  chip: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
  },
  chipLabel: { fontFamily: fontFamily.mono, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase", color: colors.textTertiary },
  chipAmount: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.textPrimary },
  chipMuted: { fontFamily: fontFamily.regular, fontSize: 11, color: colors.textTertiary },
});
