import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { useSession, signOut } from "@/lib/auth";
import { colors, layout, spacing } from "@/constants/theme";

// Placeholder Account (MS7). Real profile, username edit, delete account: MS16.
// Sign-out is wired now so the MS9 auth loop is testable end to end.
export default function AccountScreen() {
  const { data: session } = useSession();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.pad}>
        <Text variant="display">Account</Text>
        {session?.user ? (
          <Text variant="body" color="textSecondary" style={{ marginTop: spacing.sm }}>
            Signed in as {session.user.name ?? session.user.email}
          </Text>
        ) : null}
        <Text variant="caption" color="textTertiary" style={{ marginTop: spacing.sm }}>
          Profile and settings arrive in MS16.
        </Text>

        <View style={styles.signOut}>
          <Button label="Sign out" variant="secondary" onPress={() => signOut()} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: layout.gutter },
  signOut: { marginTop: spacing.xxl },
});
