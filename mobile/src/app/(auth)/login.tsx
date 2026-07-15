import { View, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { Text } from "@/components/Text";
import { colors, spacing, layout, radius, type } from "@/constants/theme";

// Placeholder login (MS7). The real form — identifier + password, lookup-email
// then signIn.email, error mapping — is DS5/MS9. This exists to prove the app
// boots in the brand font and to reach the gallery + health screens.
export default function LoginScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
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
        <Text variant="caption" color="textSecondary" center>
          Premier League &amp; UCL predictions
        </Text>
        <Text variant="caption" color="textTertiary" center style={{ marginTop: spacing.sm }}>
          Scaffold build — auth lands in MS9
        </Text>
      </View>

      <View style={styles.actions}>
        <Link href="/(tabs)" asChild>
          <Pressable style={styles.primary}>
            <Text variant="bodyMedium" color="textOnBrand" center>
              Enter app (placeholder)
            </Text>
          </Pressable>
        </Link>
        <View style={styles.row}>
          <Link href="/gallery" asChild>
            <Pressable style={styles.secondary}>
              <Text variant="bodyMedium" color="accent" center>
                Design gallery
              </Text>
            </Pressable>
          </Link>
          <Link href="/debug" asChild>
            <Pressable style={styles.secondary}>
              <Text variant="bodyMedium" color="accent" center>
                Health check
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: layout.gutter },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  lockup: { flexDirection: "row", alignItems: "center" },
  castWrap: { borderRadius: radius.sm, paddingHorizontal: 6, marginLeft: 2 },
  castText: { paddingHorizontal: 2 },
  actions: { paddingBottom: spacing.xxl, gap: spacing.md },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
  },
  row: { flexDirection: "row", gap: spacing.md },
  secondary: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
});
