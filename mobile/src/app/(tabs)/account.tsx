import { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Alert, Switch, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { Text } from "@/components/Text";
import { Card } from "@/components/Card";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { Banner } from "@/components/Banner";
import { Sheet } from "@/components/Sheet";
import { TeamCrest } from "@/components/TeamCrest";
import { StatTile } from "@/components/StatTile";
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
import type { Team } from "@/types/fixtures";
import { colors, spacing, layout, radius, competition } from "@/constants/theme";

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
  // Guard against toggling before the real prefs load: without prefs.data, `notif`
  // is the all-on default, and a PUT would clobber the user's other saved keys.
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
        : null;

  const saveUsername = () => {
    if (!usernameChanged) return;
    updateUsername.mutate(username, { onSuccess: () => haptics.success() });
  };

  const handleSignOut = async () => {
    await unregisterPush(); // remove this device's token while the session is still valid
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
                // Sign out first (clears the SecureStore session) so the gate
                // redirects cleanly; then clear the cache. Tolerate a failed
                // sign-out request against the now-deleted account.
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
        {/* Profile header */}
        <View style={styles.profile}>
          {team ? (
            <TeamCrest name={team.name} code={team.code} logo={team.logo} size={64} />
          ) : (
            <View style={styles.avatar}>
              <Text variant="title" color="textOnBrand">
                {(me.data?.firstName ?? me.data?.name ?? "?").slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.profileText}>
            {me.isLoading ? (
              <Skeleton width={140} height={22} />
            ) : (
              <Text variant="title">{me.data?.name ?? "You"}</Text>
            )}
            {me.data?.username ? <Text variant="body" color="textSecondary">@{me.data.username}</Text> : null}
          </View>
        </View>

        <View style={styles.stats}>
          <StatTile value={leagues.data?.length ?? 0} label="Leagues" loading={leagues.isLoading} />
          <StatTile value={team?.shortName ?? "—"} label="Team" loading={fav.isLoading} />
        </View>

        {/* Username */}
        <Text variant="label" color="textSecondary" style={styles.sectionLabel}>Username</Text>
        <TextField
          value={username}
          onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
        />
        {usernameError ? <Banner kind="error" message={usernameError} /> : null}
        <Button label="Save username" onPress={saveUsername} loading={updateUsername.isPending} disabled={!usernameChanged} />

        {/* Favorite team */}
        <Text variant="label" color="textSecondary" style={styles.sectionLabel}>Favorite team</Text>
        <Card onPress={() => setTeamSheet(true)}>
          <View style={styles.rowBetween}>
            <View style={styles.teamRow}>
              {team ? <TeamCrest name={team.name} code={team.code} logo={team.logo} size={28} /> : null}
              <Text variant="bodyMedium">{team?.name ?? "Choose a team"}</Text>
            </View>
            <Text variant="body" color="accent">Change</Text>
          </View>
        </Card>

        {/* Account info */}
        <Text variant="label" color="textSecondary" style={styles.sectionLabel}>Account</Text>
        <Card>
          <InfoRow label="Name" value={`${me.data?.firstName ?? ""} ${me.data?.lastName ?? ""}`.trim() || "—"} />
          <InfoRow label="Email" value={me.data?.email ?? "—"} />
          <InfoRow label="Verified" value={me.data?.emailVerified ? "Yes" : "No"} last />
        </Card>

        {/* Notifications */}
        <Text variant="label" color="textSecondary" style={styles.sectionLabel}>Notifications</Text>
        <Card>
          <NotifRow label="Deadline reminders" value={notif.deadlines} disabled={!prefs.data} onChange={(v) => setNotif("deadlines", v)} />
          <NotifRow label="Results & points" value={notif.results} disabled={!prefs.data} onChange={(v) => setNotif("results", v)} />
          <NotifRow label="League updates" value={notif.updates} disabled={!prefs.data} onChange={(v) => setNotif("updates", v)} last />
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          <Button label="Sign out" variant="secondary" onPress={handleSignOut} />
          <Button label="Delete account" variant="destructive" onPress={confirmDelete} loading={deleteAccount.isPending} />
        </View>
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

// The team-picker grid used by the change sheet.
function TeamPickerGrid({ onClose }: { onClose: () => void }) {
  const teams = useTeams();
  const setFav = useSetFavoriteTeam();
  const sorted = teams.data ? [...teams.data].sort((a, b) => a.name.localeCompare(b.name)) : [];

  return (
    <FlatList
      data={sorted}
      numColumns={3}
      keyExtractor={(t) => t.id}
      columnWrapperStyle={{ gap: spacing.md }}
      contentContainerStyle={{ gap: spacing.md }}
      style={{ maxHeight: 380 }}
      renderItem={({ item }) => (
        <Pressable
          style={styles.pickCell}
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
      )}
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: layout.gutter, paddingBottom: spacing.xxxl, gap: spacing.md },
  profile: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.plPurple, alignItems: "center", justifyContent: "center" },
  profileText: { gap: 2 },
  stats: { flexDirection: "row", gap: spacing.md },
  sectionLabel: { marginTop: spacing.md },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  teamRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
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
  actions: { marginTop: spacing.xl, gap: spacing.md },
  pickCell: { flex: 1 / 3, alignItems: "center", gap: spacing.xs, paddingVertical: spacing.sm },
});
