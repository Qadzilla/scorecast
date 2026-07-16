import { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Text } from "@/components/Text";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Banner } from "@/components/Banner";
import { Skeleton } from "@/components/Skeleton";
import { useSession } from "@/lib/auth";
import { useLeagues, useUpdateLeague, useLeagueMembers, useKickMember, type LeagueMember } from "@/lib/queries";
import { haptics } from "@/utils/haptics";
import { colors, layout, spacing, radius } from "@/constants/theme";

export default function ManageLeagueScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const { data: session } = useSession();
  const league = useLeagues().data?.find((l) => l.id === leagueId);
  const update = useUpdateLeague(leagueId);
  const members = useLeagueMembers(leagueId);
  const kick = useKickMember(leagueId);

  const [name, setName] = useState("");
  useEffect(() => {
    if (league) setName(league.name);
  }, [league]);

  const nameChanged = league && name.trim().length >= 3 && name.trim() !== league.name;

  const confirmKick = (m: LeagueMember) => {
    const label = m.username || `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim() || m.email;
    haptics.warn();
    Alert.alert("Remove member", `Remove ${label} from the league? Their predictions stay but they leave the table.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => kick.mutate(m.userId) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Manage league" />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Rename */}
        <View style={{ gap: spacing.sm }}>
          <TextField label="League name" value={name} onChangeText={setName} maxLength={40} />
          <Button
            label="Save name"
            onPress={() => nameChanged && update.mutate(name)}
            loading={update.isPending}
            disabled={!nameChanged}
          />
          {update.isSuccess && !nameChanged ? <Banner kind="success" message="League name updated." /> : null}
          {update.isError ? <Banner kind="error" message="Couldn't rename the league." /> : null}
        </View>

        {/* Members */}
        <Text variant="label" color="textSecondary" style={{ marginTop: spacing.md }}>
          Members
        </Text>
        {members.isLoading ? (
          <Card>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ paddingVertical: spacing.sm }}>
                <Skeleton width="60%" height={16} />
              </View>
            ))}
          </Card>
        ) : members.isError ? (
          <Banner kind="error" message="Couldn't load members." />
        ) : (
          <Card padded={false} style={{ paddingVertical: spacing.xs }}>
            {members.data?.map((m) => {
              const isSelf = m.userId === session?.user?.id;
              const label = m.username || `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim() || m.email;
              return (
                <View key={m.id} style={styles.memberRow}>
                  <View style={styles.memberInfo}>
                    <Text variant="bodyMedium" numberOfLines={1}>{label}</Text>
                    <Text variant="caption" color="textTertiary">{m.role === "admin" ? "Admin" : "Member"}</Text>
                  </View>
                  {isSelf || m.role === "admin" ? null : (
                    <Pressable
                      onPress={() => confirmKick(m)}
                      hitSlop={layout.hitSlop}
                      accessibilityLabel={`Remove ${label}`}
                      style={styles.kickBtn}
                    >
                      <Ionicons name="person-remove-outline" size={18} color={colors.danger} />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: layout.gutter, gap: spacing.md, paddingBottom: spacing.xxxl },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: layout.cardPadding,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  memberInfo: { flex: 1, gap: 2 },
  kickBtn: { padding: spacing.xs, borderRadius: radius.sm },
});
