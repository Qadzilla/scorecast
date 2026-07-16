import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "./Text";
import { colors, radius, spacing } from "@/constants/theme";

// The ScoreCast wordmark: "Score" in ink + "Cast" on a purple→navy chip.
// The brand's dark identity lives here as an accent, not a background.
export function BrandLockup({ subtitle }: { subtitle?: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.lockup}>
        <Text variant="display">Score</Text>
        <LinearGradient
          colors={[colors.plPurpleLight, colors.uclNavy]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.castWrap}
        >
          <Text variant="display" color="textOnBrand" style={styles.castText}>
            Cast
          </Text>
        </LinearGradient>
      </View>
      {subtitle ? (
        <Text variant="caption" color="textSecondary" center>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: spacing.sm },
  lockup: { flexDirection: "row", alignItems: "center" },
  castWrap: { borderRadius: radius.sm, paddingHorizontal: 6, marginLeft: 2 },
  castText: { paddingHorizontal: 2 },
});
