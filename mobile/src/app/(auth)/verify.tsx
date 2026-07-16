import { useEffect, useRef, useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Banner } from "@/components/Banner";
import { OtpInput } from "@/components/OtpInput";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
  sendVerificationCode,
  verifyEmailCode,
  signIn,
  AuthError,
  type AuthErrorCode,
} from "@/lib/auth";
import { takePendingPassword, clearPendingCredentials } from "@/lib/pendingCredentials";
import { haptics } from "@/utils/haptics";
import { colors, spacing, layout } from "@/constants/theme";

const RESEND_COOLDOWN = 60;

const ERROR_COPY: Partial<Record<AuthErrorCode, string>> = {
  INVALID_CODE: "That code isn't right or has expired. Try again or resend.",
  RATE_LIMITED: "Too many attempts. Please wait a bit and try again.",
  NETWORK: "Can't reach ScoreCast. Check your connection.",
  UNKNOWN: "Something went wrong. Please try again.",
};

export default function VerifyScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState("");
  const [error, setError] = useState<AuthErrorCode | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const sentOnce = useRef(false);
  // Ref guard: OtpInput.onComplete and the Verify button can both fire in the
  // same tick when the 6th digit lands. The `verifying` state read is stale in
  // that window, so a ref blocks the duplicate submit (which would consume the
  // now-used OTP and show a spurious INVALID_CODE).
  const submitting = useRef(false);

  // Send the code once on mount (single source for both signup and
  // login-unverified entry paths).
  useEffect(() => {
    if (!email || sentOnce.current) return;
    sentOnce.current = true;
    sendVerificationCode(email).catch((e) => {
      setError(e instanceof AuthError ? e.code : "UNKNOWN");
      setDetail(e instanceof AuthError ? e.detail ?? null : String(e));
    });
  }, [email]);

  // Resend cooldown tick.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const submit = async (value: string) => {
    if (!email || submitting.current) return;
    submitting.current = true;
    setError(null);
    setVerifying(true);
    try {
      await verifyEmailCode(email, value);
      haptics.success();
      // Auto sign-in with the held password; the root gate routes onward.
      const password = takePendingPassword(email);
      if (password) {
        const { error: signInError } = await signIn.email({ email, password });
        if (signInError) {
          router.replace("/(auth)/login");
          return;
        }
        // Session set → gate redirects out of (auth).
      } else {
        clearPendingCredentials();
        router.replace("/(auth)/login");
      }
    } catch (e) {
      setError(e instanceof AuthError ? e.code : "UNKNOWN");
      setDetail(e instanceof AuthError ? e.detail ?? null : String(e));
      setCode("");
    } finally {
      setVerifying(false);
      submitting.current = false;
    }
  };

  const resend = async () => {
    if (cooldown > 0 || !email) return;
    setError(null);
    setCode("");
    setCooldown(RESEND_COOLDOWN);
    try {
      await sendVerificationCode(email);
    } catch (e) {
      setError(e instanceof AuthError ? e.code : "UNKNOWN");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Verify email" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.body}>
          <Text variant="title">Enter your code</Text>
          <Text variant="body" color="textSecondary">
            We sent a 6-digit code to{"\n"}
            <Text variant="bodyMedium">{email ?? "your email"}</Text>.
          </Text>

          {error ? (
            <Banner
              kind={error === "NETWORK" ? "offline" : "error"}
              message={`${ERROR_COPY[error] ?? ERROR_COPY.UNKNOWN!}${detail ? `\n[${detail}]` : ""}`}
            />
          ) : null}

          <OtpInput value={code} onChange={setCode} error={!!error} onComplete={submit} autoFocus />

          <Button
            label="Verify"
            onPress={() => submit(code)}
            loading={verifying}
            disabled={code.length !== 6}
          />

          <View style={styles.resendRow}>
            {cooldown > 0 ? (
              <Text variant="caption" color="textTertiary">
                Resend code in {cooldown}s
              </Text>
            ) : (
              <Text variant="bodyMedium" color="accent" onPress={resend}>
                Resend code
              </Text>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  body: { flex: 1, paddingHorizontal: layout.gutter, paddingTop: spacing.xl, gap: spacing.lg },
  resendRow: { alignItems: "center", marginTop: spacing.sm },
});
