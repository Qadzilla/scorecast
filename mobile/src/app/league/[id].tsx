import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Text } from "@/components/Text";
import { colors, layout, spacing } from "@/constants/theme";

// Placeholder — Fixtures / Predictions / Table panes land in MS13.
export default function LeagueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="League" />
      <View style={styles.pad}>
        <Text variant="body" color="textSecondary">
          League detail (fixtures, predictions, table) arrives in MS13.
        </Text>
        <Text variant="caption" color="textTertiary">
          id: {id}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: layout.gutter, gap: spacing.sm },
});
