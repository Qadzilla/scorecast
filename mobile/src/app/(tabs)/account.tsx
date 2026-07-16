import { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Alert, Switch, useWindowDimensions } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Text } from "@/components/Text";
import { Card } from "@/components/Card";
import { Field } from "@/components/Field";
import { Button } from "@/components/Button";
import { SectionTitle } from "@/components/SectionTitle";
import { Sheet } from "@/components/Sheet";
import { TeamCrest } from "@/components/TeamCrest";
import { Skeleton } from "@/components/Skeleton";
import { signOut } from "@/lib/auth";
import {
  useMe,
  useFavoriteTeam,
  useTeams,
  useSetFavoriteTeam,
  useUpdateUsername,
  useDeleteAccount,
  useLeagues,
  useNotificationPrefs,
  useUpdateNotificationPrefs,
  type NotificationPrefs,
} from "@/lib/queries";
import { ApiError } from "@/lib/api";
import { unregisterPush } from "@/lib/notifications";
import { haptics } from "@/utils/haptics";
import { brand } from "@/constants/brand";
import { colors, spacing, layout, radius, competition, fontFamily } from "@/constants/theme";

const DIM = "#8ba0b6";

export default function AccountScreen() {
  const qc = useQueryClient();
  const me = useMe();
  const fav = useFavoriteTeam();
  const leagues = useLeagues();
  const updateUsername = useUpdateUsername();
  const deleteAccount = useDeleteAccount();

  const [username, setUsername] = useState("");
  useEffect(() => {
    if (me.data?.username) setUsername(me.data.username);
  }, [me.data?.username]);

  const [teamSheet, setTeamSheet] = useState(false);

  const prefs = useNotificationPrefs();
  const updatePrefs = useUpdateNotificationPrefs();
  const notif: NotificationPrefs = prefs.data ?? { deadlines: true, results: true, updates: true };
  const setNotif = (key: keyof NotificationPrefs, value: boolean) => {
    if (!prefs.data) return;
    updatePrefs.mutate({ ...prefs.data, [key]: value });
  };

  const usernameChanged =
    !!me.data && username.trim().length >= 3 && username.trim().toLowerCase() !== me.data.username;
  const usernameError =
    updateUsername.error instanceof ApiError && updateUsername.error.status === 409
      ? "That username is taken."
      : updateUsername.error
        ? "Couldn't update username."
        : undefined;

  const saveUsername = () => {
    if (!usernameChanged) return;
    updateUsername.mutate(username, { onSuccess: () => haptics.success() });
  };

  const handleSignOut = async () => {
    await unregisterPush();
    await signOut();
  };

  const confirmDelete = () => {
    haptics.warn();
    Alert.alert(
      "Delete account?",
      "This permanently removes your account, predictions, and league memberships. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deleteAccount.mutate(undefined, {
              onSuccess: async () => {
                try {
                  await signOut();
                } catch {
                  // account is gone; local session clears regardless
                }
                qc.clear();
              },
              onError: () => Alert.alert("Couldn't delete account", "Please try again."),
            }),
        },
      ]
    );
  };

  const team = fav.data?.team;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Navy profile hero */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.hero}>
          {team ? (
            <TeamCrest name={team.name} code={team.code} logo={team.logo} size={52} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(me.data?.firstName ?? me.data?.name ?? "?").slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.heroText}>
            {me.isLoading ? (
              <Skeleton width={130} height={20} />
            ) : (
              <Text style={styles.heroName} numberOfLines={1}>{me.data?.name ?? "You"}</Text>
            )}
            {me.data?.username ? <Text style={styles.heroHandle}>@{me.data.username}</Text> : null}
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatNum} tabular>{leagues.data?.length ?? 0}</Text>
            <Text style={styles.heroStatLabel}>Leagues</Text>
          </View>
        </Animated.View>

        {/* Username */}
        <Animated.View entering={FadeInDown.duration(300).delay(70)} style={styles.section}>
          <SectionTitle label="Username" />
          <Field
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            error={usernameError}
          />
          {usernameChanged ? (
            <Button label="Save username" onPress={saveUsername} loading={updateUsername.isPending} />
          ) : null}
        </Animated.View>

        {/* Favorite team */}
        <Animated.View entering={FadeInDown.duration(300).delay(120)} style={styles.section}>
          <SectionTitle label="Favorite team" />
          <Card onPress={() => setTeamSheet(true)}>
            <View style={styles.rowBetween}>
              <View style={styles.teamRow}>
                {team ? <TeamCrest name={team.name} code={team.code} logo={team.logo} size={28} /> : null}
                <Text variant="bodyMedium">{team?.name ?? "Choose a team"}</Text>
              </View>
              <View style={styles.changeRow}>
                <Text variant="bodyMedium" style={{ color: colors.accent }}>Change</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.accent} />
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* Account info */}
        <Animated.View entering={FadeInDown.duration(300).delay(170)} style={styles.section}>
          <SectionTitle label="Account" />
          <Card>
            <InfoRow label="Name" value={`${me.data?.firstName ?? ""} ${me.data?.lastName ?? ""}`.trim() || "—"} />
            <InfoRow label="Email" value={me.data?.email ?? "—"} />
            <InfoRow label="Verified" value={me.data?.emailVerified ? "Yes" : "No"} last />
          </Card>
        </Animated.View>

        {/* Notifications */}
        <Animated.View entering={FadeInDown.duration(300).delay(220)} style={styles.section}>
          <SectionTitle label="Notifications" />
          <Card>
            <NotifRow label="Deadline reminders" value={notif.deadlines} disabled={!prefs.data} onChange={(v) => setNotif("deadlines", v)} />
            <NotifRow label="Results & points" value={notif.results} disabled={!prefs.data} onChange={(v) => setNotif("results", v)} />
            <NotifRow label="League updates" value={notif.updates} disabled={!prefs.data} onChange={(v) => setNotif("updates", v)} last />
          </Card>
        </Animated.View>

        {/* Actions */}
        <Animated.View entering={FadeInDown.duration(300).delay(270)} style={styles.actions}>
          <Button label="Sign out" variant="secondary" onPress={handleSignOut} />
          <Button label="Delete account" variant="destructive" onPress={confirmDelete} loading={deleteAccount.isPending} />
        </Animated.View>
      </ScrollView>

      <Sheet visible={teamSheet} onClose={() => setTeamSheet(false)} title="Choose your team">
        <TeamPickerGrid onClose={() => setTeamSheet(false)} />
      </Sheet>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text variant="body" color="textSecondary">{label}</Text>
      <Text variant="bodyMedium" numberOfLines={1} style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function NotifRow({ label, value, onChange, last, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; last?: boolean; disabled?: boolean }) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text variant="body" color={disabled ? "textTertiary" : "textPrimary"}>{label}</Text>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.accent }} />
    </View>
  );
}

function TeamPickerGrid({ onClose }: { onClose: () => void }) {
  const teams = useTeams();
  const setFav = useSetFavoriteTeam();
  const { width } = useWindowDimensions();
  const cellW = (width - layout.gutter * 2 - spacing.md * 2) / 3;
  const sorted = teams.data ? [...teams.data].sort((a, b) => a.name.localeCompare(b.name)) : [];

  return (
    <View style={styles.pickGrid}>
      {sorted.map((item) => (
        <Pressable
          key={item.id}
          style={[styles.pickCell, { width: cellW }]}
          onPress={() => {
            haptics.select();
            setFav.mutate(item.id, { onSuccess: () => { haptics.success(); onClose(); } });
          }}
        >
          <TeamCrest
            name={item.name}
            code={item.code}
            logo={item.logo}
            size={40}
            fallbackColor={item.competition === "champions_league" ? competition.champions_league.main : competition.premier_league.main}
          />
          <Text variant="caption" center numberOfLines={1}>{item.shortName || item.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: layout.gutter, paddingBottom: spacing.xxxl, gap: spacing.xl },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    backgroundColor: brand.navy,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#2c4056",
    padding: layout.cardPadding,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fontFamily.bold, fontSize: 20, color: colors.textOnBrand },
  heroText: { flex: 1, gap: 2 },
  heroName: { fontFamily: fontFamily.bold, fontSize: 19, color: colors.textOnBrand },
  heroHandle: { fontFamily: fontFamily.regular, fontSize: 14, color: DIM },
  heroStat: { alignItems: "flex-end" },
  heroStatNum: { fontFamily: fontFamily.extrabold, fontSize: 22, color: colors.textOnBrand },
  heroStatLabel: { fontFamily: fontFamily.semibold, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: DIM },
  section: { gap: spacing.md },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  teamRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  changeRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: 40,
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoValue: { flexShrink: 1, marginLeft: spacing.md },
  actions: { marginTop: spacing.sm, gap: spacing.md },
  pickGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  pickCell: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.sm },
});
