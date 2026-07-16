import { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Text } from "@/components/Text";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { Banner } from "@/components/Banner";
import { useJoinLeague } from "@/lib/queries";
import { ApiError } from "@/lib/api";
import { haptics } from "@/utils/haptics";
import { colors, layout, spacing } from "@/constants/theme";

export default function JoinLeagueScreen() {
  const router = useRouter();
  const join = useJoinLeague();
  const [code, setCode] = useState("");

  const errorText =
    join.error instanceof ApiError
      ? join.error.status === 404
        ? "That invite code doesn't match any league."
        : join.error.message
      : join.error
        ? "Couldn't join. Check your connection and try again."
        : null;

  const onJoin = () => {
    if (code.trim().length < 6) return;
    join.mutate(code, {
      onSuccess: (league) => {
        haptics.success();
        router.replace({ pathname: "/league/[id]", params: { id: league.id } });
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Join a league" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.body}>
          <Text variant="body" color="textSecondary">
            Enter the invite code your league admin shared with you.
          </Text>
          <TextField
            label="Invite code"
            placeholder="ABCD1234"
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            returnKeyType="go"
            onSubmitEditing={onJoin}
            autoFocus
          />
          {errorText ? <Banner kind="error" message={errorText} /> : null}
        </View>
        <View style={styles.footer}>
          <Button
            label="Join league"
            onPress={onJoin}
            loading={join.isPending}
            disabled={code.trim().length < 6}
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
