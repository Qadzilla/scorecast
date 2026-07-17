import { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Text } from "@/components/Text";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { SectionTitle } from "@/components/SectionTitle";
import { Skeleton } from "@/components/Skeleton";
import {
  useAdminUsers,
  useAdminGrants,
  useGrantLeagueCreation,
  useRevokeGrant,
  type AdminUser,
  type AdminGrant,
} from "@/lib/queries";
import { ApiError } from "@/lib/api";
import { haptics } from "@/utils/haptics";
import { colors, spacing, layout, radius, fontFamily } from "@/constants/theme";

const label = (x: { username: string | null; email: string }) => (x.username ? `@${x.username}` : x.email);

// AD5 — search a user and grant them a one-time league creation; manage grants.
export default function AdminGrants() {
  const [q, setQ] = useState("");
  const users = useAdminUsers(q);
  const grants = useAdminGrants();
  const grant = useGrantLeagueCreation();
  const revoke = useRevokeGrant();
  const [grantingId, setGrantingId] = useState<string | null>(null);

  const onGrant = (u: AdminUser) => {
    setGrantingId(u.id);
    haptics.select();
    grant.mutate(u.id, {
      onSuccess: () => haptics.success(),
      onError: (e) => Alert.alert("Couldn't grant", e instanceof ApiError ? e.message : "Please try again."),
      onSettled: () => setGrantingId(null),
    });
  };

  const confirmRevoke = (g: AdminGrant) => {
    haptics.warn();
    Alert.alert("Revoke grant", `Remove ${label(g)}'s pending league creation?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Revoke", style: "destructive", onPress: () => revoke.mutate(g.id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="League creators" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Grant a user */}
        <View style={styles.section}>
          <SectionTitle label="Grant a user" />
          <TextField
            placeholder="Search by username or email"
            value={q}
            onChangeText={setQ}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {q.trim().length < 2 ? (
            <Text variant="caption" color="textTertiary">Type at least 2 characters to search.</Text>
          ) : users.isLoading ? (
            <Card><Skeleton width="70%" height={16} /></Card>
          ) : !users.data || users.data.length === 0 ? (
            <Text variant="caption" color="textTertiary">No users found.</Text>
          ) : (
            <Card padded={false}>
              {users.data.map((u, i) => (
                <View key={u.id} style={[styles.row, i > 0 && styles.divider]}>
                  <View style={styles.info}>
                    <Text variant="bodyMedium" numberOfLines={1}>{label(u)}</Text>
                    {u.username ? <Text variant="caption" color="textTertiary" numberOfLines={1}>{u.email}</Text> : null}
                  </View>
                  {u.hasPendingGrant ? (
                    <View style={styles.pill}><Text style={styles.pillText}>Pending</Text></View>
                  ) : (
                    <Button label="Allow 1" compact onPress={() => onGrant(u)} loading={grantingId === u.id} />
                  )}
                </View>
              ))}
            </Card>
          )}
        </View>

        {/* Existing grants */}
        <View style={styles.section}>
          <SectionTitle label="Grants" />
          {grants.isLoading ? (
            <Card><Skeleton width="60%" height={16} /></Card>
          ) : !grants.data || grants.data.length === 0 ? (
            <Text variant="caption" color="textTertiary">No grants yet.</Text>
          ) : (
            <Card padded={false}>
              {grants.data.map((g, i) => (
                <View key={g.id} style={[styles.row, i > 0 && styles.divider]}>
                  <View style={styles.info}>
                    <Text variant="bodyMedium" numberOfLines={1}>{label(g)}</Text>
                    <Text variant="caption" color={g.used ? "textTertiary" : "accent"}>
                      {g.used ? `Used${g.leagueName ? ` · ${g.leagueName}` : ""}` : "Pending"}
                    </Text>
                  </View>
                  {g.used ? null : (
                    <Pressable onPress={() => confirmRevoke(g)} hitSlop={layout.hitSlop} accessibilityLabel="Revoke grant">
                      <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
                    </Pressable>
                  )}
                </View>
              ))}
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: layout.gutter, gap: spacing.xl, paddingBottom: spacing.xxxl },
  section: { gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: layout.cardPadding,
    paddingVertical: spacing.sm,
    minHeight: 52,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  info: { flex: 1, gap: 2 },
  pill: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  pillText: { fontFamily: fontFamily.semibold, fontSize: 11, letterSpacing: 0.3, textTransform: "uppercase", color: colors.textSecondary },
});
