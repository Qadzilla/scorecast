import { View, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Text } from "@/components/Text";
import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { useAdminLeagues, useDeleteLeagueAdmin, type AdminLeague } from "@/lib/queries";
import { ApiError } from "@/lib/api";
import { haptics } from "@/utils/haptics";
import { colors, spacing, layout } from "@/constants/theme";

// AD6 — every league; delete one (cascades members/predictions/prize pool).
export default function AdminLeagues() {
  const leagues = useAdminLeagues();
  const del = useDeleteLeagueAdmin();

  const confirmDelete = (l: AdminLeague) => {
    haptics.warn();
    Alert.alert(
      "Delete league",
      `Permanently delete "${l.name}" and its ${l.memberCount} member${l.memberCount === 1 ? "" : "s"}, predictions, and prize pool? This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            del.mutate(l.id, {
              onSuccess: () => haptics.success(),
              onError: (e) => Alert.alert("Couldn't delete", e instanceof ApiError ? e.message : "Please try again."),
            }),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Leagues" />
      <ScrollView contentContainerStyle={styles.content}>
        {leagues.isLoading ? (
          <Card>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ paddingVertical: spacing.sm }}>
                <Skeleton width="70%" height={16} />
              </View>
            ))}
          </Card>
        ) : !leagues.data || leagues.data.length === 0 ? (
          <EmptyState icon="trophy-outline" title="No leagues" subtitle="No leagues exist yet." />
        ) : (
          <Card padded={false}>
            {leagues.data.map((l, i) => (
              <View key={l.id} style={[styles.row, i > 0 && styles.divider]}>
                <View style={styles.info}>
                  <Text variant="bodyMedium" numberOfLines={1}>{l.name}</Text>
                  <Text variant="caption" color="textTertiary" numberOfLines={1}>
                    {l.type === "champions_league" ? "Champions League" : "Premier League"} · {l.memberCount} member{l.memberCount === 1 ? "" : "s"}
                    {l.creatorUsername ? ` · @${l.creatorUsername}` : ""}
                  </Text>
                </View>
                <Pressable onPress={() => confirmDelete(l)} hitSlop={layout.hitSlop} accessibilityLabel={`Delete ${l.name}`}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: layout.gutter, paddingBottom: spacing.xxxl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: layout.cardPadding,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  info: { flex: 1, gap: 2 },
});
