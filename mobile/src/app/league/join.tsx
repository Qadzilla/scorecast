import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Text } from "@/components/Text";
import { colors, layout, spacing } from "@/constants/theme";

// Placeholder — invite-code entry lands in MS14.
export default function JoinLeagueScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Join a league" />
      <View style={styles.pad}>
        <Text variant="body" color="textSecondary">
          Invite-code entry arrives in MS14.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: layout.gutter, gap: spacing.sm },
});
