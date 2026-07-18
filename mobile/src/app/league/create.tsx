import { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, Switch, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Text } from "@/components/Text";
import { TextField } from "@/components/TextField";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Button } from "@/components/Button";
import { Banner } from "@/components/Banner";
import { PrizePoolEditor, defaultPrizePoolForm, validatePrizePoolForm } from "@/components/PrizePoolEditor";
import { PRIZE_POOL_ENABLED } from "@/constants/flags";
import { useMe, useCreateLeague, useSetPrizePool } from "@/lib/queries";
import { haptics } from "@/utils/haptics";
import type { CompetitionType } from "@/types/fixtures";
import { colors, layout, spacing, competition } from "@/constants/theme";

export default function CreateLeagueScreen() {
  const router = useRouter();
  const me = useMe();
  const create = useCreateLeague();
  const setPool = useSetPrizePool();
  const [name, setName] = useState("");
  const [type, setType] = useState<CompetitionType>("premier_league");
  const [poolEnabled, setPoolEnabled] = useState(false);
  const [poolForm, setPoolForm] = useState(defaultPrizePoolForm());

  const poolValidation = poolEnabled ? validatePrizePoolForm(poolForm) : null;
  const poolError = poolValidation && "error" in poolValidation ? poolValidation.error : null;

  // Server enforces this too; this just hides the UI from users who reach the
  // route without permission (not the global admin and no unused grant).
  if (me.data && !me.data.canCreateLeague) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Create league" />
        <View style={styles.body}>
          <Banner kind="info" message="You don't have permission to create a league." />
        </View>
      </SafeAreaView>
    );
  }

  const onCreate = () => {
    if (name.trim().length < 3) return;
    let poolInput = null;
    if (poolEnabled) {
      const v = validatePrizePoolForm(poolForm);
      if ("error" in v) return;
      poolInput = v.input;
    }
    create.mutate(
      { name, type },
      {
        onSuccess: (league) => {
          const go = () => {
            haptics.success();
            router.replace({ pathname: "/league/[id]", params: { id: league.id } });
          };
          // Set the pool for the new league, then go in. If the pool write fails
          // the league still exists — the admin can retry from Manage.
          if (poolInput) {
            setPool.mutate({ leagueId: league.id, ...poolInput }, { onSuccess: go, onError: go });
          } else {
            go();
          }
        },
      }
    );
  };

  const disabled = name.trim().length < 3 || (poolEnabled && !!poolError);

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Create league" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <TextField
            label="League name"
            placeholder="Kickoff Kings"
            value={name}
            onChangeText={setName}
            maxLength={40}
            autoFocus
          />
          <View style={{ gap: spacing.sm }}>
            <Text variant="caption" color="textSecondary">Competition</Text>
            <SegmentedControl
              segments={[
                { key: "premier_league", label: "Premier League" },
                { key: "champions_league", label: "Champions League" },
              ]}
              value={type}
              onChange={setType}
              activeColor={competition[type].main}
            />
          </View>

          {PRIZE_POOL_ENABLED ? (
            <>
              <View style={styles.poolHead}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium">Prize pool</Text>
                  <Text variant="caption" color="textSecondary">Optional — a per-player entry fee and payouts.</Text>
                </View>
                <Switch value={poolEnabled} onValueChange={setPoolEnabled} trackColor={{ true: colors.accent }} />
              </View>
              {poolEnabled ? <PrizePoolEditor value={poolForm} onChange={setPoolForm} /> : null}
              {poolEnabled && poolError ? <Text variant="caption" color="danger">{poolError}</Text> : null}
            </>
          ) : null}

          {create.isError ? <Banner kind="error" message="Couldn't create the league. Try again." /> : null}
        </ScrollView>
        <View style={styles.footer}>
          <Button
            label="Create league"
            variant="brand"
            competitionKey={type}
            onPress={onCreate}
            loading={create.isPending || setPool.isPending}
            disabled={disabled}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  body: { padding: layout.gutter, gap: spacing.lg, paddingBottom: spacing.xxl },
  poolHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  footer: { padding: layout.gutter },
});
