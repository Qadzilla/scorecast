import { useEffect, useRef, useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text } from "@/components/Text";
import { SolidButton } from "@/components/SolidButton";
import { FormErrorStrip } from "@/components/FormErrorStrip";
import { OtpInput } from "@/components/OtpInput";
import {
  sendVerificationCode,
  verifyEmailCode,
  signIn,
  AuthError,
  type AuthErrorCode,
} from "@/lib/auth";
import { takePendingPassword, clearPendingCredentials } from "@/lib/pendingCredentials";
import { haptics } from "@/utils/haptics";
import { brand } from "@/constants/brand";
import { spacing, layout, fontFamily } from "@/constants/theme";

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
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.body}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={layout.hitSlop}
              style={styles.back}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={26} color={brand.ink} />
            </Pressable>

            <Text style={styles.headline}>Check your email.</Text>
            <Text style={styles.subhead}>
              Enter the 6-digit code we sent to{" "}
              <Text style={styles.email}>{email ?? "your email"}</Text>.
            </Text>

            {error ? (
              <View style={styles.errorWrap}>
                <FormErrorStrip
                  kind={error === "NETWORK" ? "offline" : "error"}
                  message={`${ERROR_COPY[error] ?? ERROR_COPY.UNKNOWN!}${detail ? `\n[${detail}]` : ""}`}
                />
              </View>
            ) : null}

            <View style={styles.otpWrap}>
              <OtpInput value={code} onChange={setCode} error={!!error} onComplete={submit} autoFocus />
            </View>

            <SolidButton
              label="Verify"
              onPress={() => submit(code)}
              loading={verifying}
              disabled={code.length !== 6}
              style={styles.cta}
            />

            <View style={styles.resendRow}>
              {cooldown > 0 ? (
                <Text style={styles.resendMuted}>Resend code in {cooldown}s</Text>
              ) : (
                <Text style={styles.resendLink} onPress={resend}>
                  Resend code
                </Text>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.paper },
  safe: { flex: 1 },
  flex: { flex: 1 },
  body: { flex: 1, paddingHorizontal: layout.gutter, paddingTop: spacing.sm },
  back: { width: 40, height: 40, justifyContent: "center", marginLeft: -8, marginBottom: spacing.md },
  headline: { fontFamily: fontFamily.extrabold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, color: brand.ink },
  subhead: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22, color: brand.muted, marginTop: spacing.sm },
  email: { fontFamily: fontFamily.semibold, color: brand.ink },
  errorWrap: { marginTop: spacing.lg },
  otpWrap: { marginTop: spacing.xxl },
  cta: { marginTop: spacing.xxl },
  resendRow: { alignItems: "center", marginTop: spacing.lg },
  resendMuted: { fontFamily: fontFamily.regular, fontSize: 13, color: brand.faint },
  resendLink: { fontFamily: fontFamily.semibold, fontSize: 15, color: brand.line },
});
