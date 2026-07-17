import { View, StyleSheet } from "react-native";
import { Text } from "./Text";
import { Card } from "./Card";
import { formatMoney } from "@/utils/money";
import { medalColors, type Medal } from "@/constants/medals";
import type { PrizePool, PrizePayout } from "@/lib/queries";
import { colors, spacing, fontFamily } from "@/constants/theme";

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
        <PayoutRow medal="gold" label="1st" payout={pool.payouts.first} currency={pool.currency} />
        <PayoutRow medal="silver" label="2nd" payout={pool.payouts.second} currency={pool.currency} />
        <PayoutRow medal="bronze" label="3rd" payout={pool.payouts.third} currency={pool.currency} />
        <PayoutRow
          medal="yellow"
          label="2nd last"
          payout={pool.payouts.secondLast}
          currency={pool.currency}
          lockedNote="Unlocks at 5 players"
        />
      </View>
    </Card>
  );
}

function PayoutRow({
  medal,
  label,
  payout,
  currency,
  lockedNote,
}: {
  medal: Medal;
  label: string;
  payout: PrizePayout | null;
  currency: PrizePool["currency"];
  lockedNote?: string;
}) {
  return (
    <View style={styles.payoutRow}>
      <View style={[styles.medalDot, { backgroundColor: medalColors[medal] }]} />
      <Text style={styles.payoutLabel}>{label}</Text>
      <Text style={[styles.payoutAmount, !payout && styles.payoutMuted]} tabular>
        {payout ? formatMoney(payout.amountMinor, currency) : lockedNote ?? "—"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  total: { fontFamily: fontFamily.extrabold, fontSize: 28, lineHeight: 32, color: colors.textPrimary },
  payouts: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  payoutRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  medalDot: { width: 10, height: 10, borderRadius: 5 },
  payoutLabel: { fontFamily: fontFamily.semibold, fontSize: 14, color: colors.textPrimary },
  payoutAmount: { marginLeft: "auto", fontFamily: fontFamily.bold, fontSize: 15, color: colors.textPrimary },
  payoutMuted: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textTertiary },
});
