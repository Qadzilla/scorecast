import { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useRouter } from "expo-router";
import { Text } from "@/components/Text";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { Banner } from "@/components/Banner";
import { BrandLockup } from "@/components/BrandLockup";
import { loginSchema, type LoginValues } from "@/lib/validation";
import { loginWithIdentifier, authClient, AuthError, type AuthErrorCode } from "@/lib/auth";
import { setPendingCredentials } from "@/lib/pendingCredentials";
import { haptics } from "@/utils/haptics";
import { colors, spacing, layout } from "@/constants/theme";

const ERROR_COPY: Partial<Record<AuthErrorCode, string>> = {
  RATE_LIMITED: "Too many attempts. Please wait 15 minutes and try again.",
  INVALID_CREDENTIALS: "Wrong username/email or password.",
  EMAIL_NOT_VERIFIED: "Your email isn't verified yet — enter the code we sent you.",
  NETWORK: "Can't reach ScoreCast. Check your connection.",
  UNKNOWN: "Something went wrong. Please try again.",
};

export default function LoginScreen() {
  const router = useRouter();
  const [serverError, setServerError] = useState<AuthErrorCode | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const onSubmit = async (values: LoginValues) => {
    setServerError(null);
    setDetail(null);
    try {
      await loginWithIdentifier(values.identifier, values.password);
      haptics.success();
      if (__DEV__) console.log("[login] signIn OK, cookie?", !!authClient.getCookie());
      // The root auth gate redirects to (tabs) once the session lands.
    } catch (e) {
      const code = e instanceof AuthError ? e.code : "UNKNOWN";
      setServerError(code);
      setDetail(e instanceof AuthError ? e.detail ?? null : String(e));
      if (code === "EMAIL_NOT_VERIFIED" && e instanceof AuthError && e.email) {
        // Hold the entered password so verify can auto sign-in on success.
        setPendingCredentials(e.email, values.password);
        router.push({ pathname: "/(auth)/verify", params: { email: e.email } });
      }
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <BrandLockup subtitle="Premier League & UCL predictions" />
          </View>

          {serverError ? (
            <Banner
              kind={serverError === "NETWORK" ? "offline" : "error"}
              message={`${ERROR_COPY[serverError] ?? ERROR_COPY.UNKNOWN!}${detail ? `\n[${detail}]` : ""}`}
            />
          ) : null}

          <Controller
            control={control}
            name="identifier"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label="Username or email"
                placeholder="you or you@example.com"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.identifier?.message}
                returnKeyType="next"
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label="Password"
                placeholder="••••••••"
                secureTextEntry
                secureToggle
                autoCapitalize="none"
                autoComplete="password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message}
                returnKeyType="go"
                onSubmitEditing={handleSubmit(onSubmit)}
              />
            )}
          />

          <Button label="Log in" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />

          <View style={styles.footer}>
            <Text variant="body" color="textSecondary">New here? </Text>
            <Link href="/(auth)/signup">
              <Text variant="bodyMedium" color="accent">Create an account</Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: layout.gutter,
    gap: spacing.lg,
    paddingVertical: spacing.xxxl,
  },
  header: { marginBottom: spacing.md },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
});
