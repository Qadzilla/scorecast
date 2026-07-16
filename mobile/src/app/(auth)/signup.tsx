import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Text } from "@/components/Text";
import { colors, layout, spacing } from "@/constants/theme";

// Placeholder — the real signup form (RHF+Zod) lands in MS10.
export default function SignupScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Create account" />
      <View style={styles.pad}>
        <Text variant="body" color="textSecondary">
          Signup form arrives in MS10.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: layout.gutter, gap: spacing.md },
});
