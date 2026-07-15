import { View, StyleSheet } from "react-native";
import { Text } from "./Text";
import { Skeleton } from "./Skeleton";
import { colors, radius, spacing } from "@/constants/theme";

type StatTileProps = {
  value: string | number;
  label: string;
  loading?: boolean;
};

// StatTile — surfaceAlt tile, numeralLg value + caption label (spec §3).
export function StatTile({ value, label, loading }: StatTileProps) {
  return (
    <View style={styles.tile}>
      {loading ? (
        <Skeleton width={40} height={30} />
      ) : (
        <Text variant="numeralLg">{value}</Text>
      )}
      <Text variant="caption" color="textSecondary" center>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    gap: spacing.xs,
  },
});
