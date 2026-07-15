import { View, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { Text } from "@/components/Text";
import { Skeleton } from "@/components/Skeleton";
import { getHealth } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { colors, layout, spacing, radius } from "@/constants/theme";

// MS7 exit criterion: a screen that fetches /health from the backend and
// renders the response. Proves the API client + Query provider are wired.
export default function DebugScreen() {
  const { data, error, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    staleTime: 0,
  });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pad}>
        <Text variant="title">Backend health</Text>
        <Text variant="caption" color="textSecondary" style={{ marginTop: 4 }}>
          {API_URL}
        </Text>

        <View style={styles.card}>
          {isLoading ? (
            <Skeleton height={20} width="50%" />
          ) : error ? (
            <Text variant="bodyMedium" color="danger">
              {(error as Error).message}
            </Text>
          ) : (
            <Text variant="bodyMedium" color="accent">
              {JSON.stringify(data)}
            </Text>
          )}
        </View>

        <Text
          variant="bodyMedium"
          color="accent"
          onPress={() => refetch()}
          style={styles.action}
        >
          {isRefetching ? "Refreshing…" : "Refetch"}
        </Text>

        <Link href="/gallery" style={styles.action}>
          <Text variant="bodyMedium" color="accent">
            Open design gallery →
          </Text>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: layout.gutter, gap: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: layout.cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
  },
  action: { paddingVertical: spacing.sm },
});
