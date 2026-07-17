import { View, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Text } from "@/components/Text";
import { Card } from "@/components/Card";
import { Banner } from "@/components/Banner";
import { useMe } from "@/lib/queries";
import { colors, spacing, layout } from "@/constants/theme";

// Admin dashboard hub (AD4). Reached from Account → Admin.
export default function AdminHome() {
  const router = useRouter();
  const me = useMe();

  if (me.data && !me.data.isAdmin) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Admin" />
        <View style={styles.pad}>
          <Banner kind="info" message="Admins only." />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Admin" />
      <ScrollView contentContainerStyle={styles.content}>
        <NavRow
          icon="key-outline"
          title="League creators"
          subtitle="Grant one-time league creation"
          onPress={() => router.push("/admin/grants")}
        />
        <NavRow
          icon="trophy-outline"
          title="Leagues"
          subtitle="View and manage every league"
          onPress={() => router.push("/admin/leagues")}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function NavRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress}>
      <View style={styles.row}>
        <Ionicons name={icon} size={22} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyMedium">{title}</Text>
          <Text variant="caption" color="textSecondary">{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: layout.gutter },
  content: { padding: layout.gutter, gap: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
});
