import { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Text } from "@/components/Text";
import { TextField } from "@/components/TextField";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Button } from "@/components/Button";
import { Banner } from "@/components/Banner";
import { useMe, useCreateLeague } from "@/lib/queries";
import { haptics } from "@/utils/haptics";
import type { CompetitionType } from "@/types/fixtures";
import { colors, layout, spacing, competition } from "@/constants/theme";

export default function CreateLeagueScreen() {
  const router = useRouter();
  const me = useMe();
  const create = useCreateLeague();
  const [name, setName] = useState("");
  const [type, setType] = useState<CompetitionType>("premier_league");

  // Server enforces admin too; this just hides the UI from non-admins who
  // reach the route directly.
  if (me.data && !me.data.isAdmin) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Create league" />
        <View style={styles.body}>
          <Banner kind="info" message="Only league admins can create leagues." />
        </View>
      </SafeAreaView>
    );
  }

  const onCreate = () => {
    if (name.trim().length < 3) return;
    create.mutate(
      { name, type },
      {
        onSuccess: (league) => {
          haptics.success();
          router.replace({ pathname: "/league/[id]", params: { id: league.id } });
        },
      }
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Create league" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <View style={styles.body}>
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
          {create.isError ? <Banner kind="error" message="Couldn't create the league. Try again." /> : null}
        </View>
        <View style={styles.footer}>
          <Button
            label="Create league"
            variant="brand"
            competitionKey={type}
            onPress={onCreate}
            loading={create.isPending}
            disabled={name.trim().length < 3}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  body: { flex: 1, padding: layout.gutter, gap: spacing.lg },
  footer: { padding: layout.gutter },
});
