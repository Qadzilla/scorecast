import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Text } from "@/components/Text";
import { colors, layout, spacing } from "@/constants/theme";

// Placeholder — the prediction entry flow (score inputs, submit) lands in MS15.
export default function PredictScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string; gameweekId: string }>();
  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Make predictions" />
      <View style={styles.pad}>
        <Text variant="body" color="textSecondary">
          The prediction entry flow arrives in MS15.
        </Text>
        <Text variant="caption" color="textTertiary">league: {leagueId}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: layout.gutter, gap: spacing.sm },
});
