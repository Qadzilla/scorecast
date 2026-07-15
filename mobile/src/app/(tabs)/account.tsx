import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/Text";
import { colors, layout, spacing } from "@/constants/theme";

// Placeholder Account (MS7). Real profile, username edit, delete account: MS16.
export default function AccountScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.pad}>
        <Text variant="display">Account</Text>
        <Text variant="body" color="textSecondary" style={{ marginTop: spacing.sm }}>
          Profile and settings arrive in MS16.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: layout.gutter },
});
