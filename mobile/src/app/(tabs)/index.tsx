import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/Text";
import { colors, layout, spacing } from "@/constants/theme";

// Placeholder Leagues home (MS7). Real countdowns + league list: MS12 / DS6.
export default function LeaguesScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.pad}>
        <Text variant="display">Leagues</Text>
        <Text variant="body" color="textSecondary" style={{ marginTop: spacing.sm }}>
          Countdowns and your leagues arrive in MS12.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: layout.gutter },
});
