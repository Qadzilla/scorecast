import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Text } from "@/components/Text";
import { colors, layout, spacing } from "@/constants/theme";

// Placeholder — the real 6-digit OTP entry lands in MS10.
export default function VerifyScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Verify email" />
      <View style={styles.pad}>
        <Text variant="body" color="textSecondary">
          OTP entry arrives in MS10.{email ? `\nCode was sent to ${email}.` : ""}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: layout.gutter, gap: spacing.md },
});
