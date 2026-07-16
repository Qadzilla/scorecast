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
import { ScreenHeader } from "@/components/ScreenHeader";
import { signupSchema, type SignupValues } from "@/lib/validation";
import { signUpWithDetails, AuthError, type AuthErrorCode } from "@/lib/auth";
import { setPendingCredentials } from "@/lib/pendingCredentials";
import { haptics } from "@/utils/haptics";
import { colors, spacing, layout } from "@/constants/theme";

const ERROR_COPY: Partial<Record<AuthErrorCode, string>> = {
  RATE_LIMITED: "Too many attempts. Please wait 15 minutes and try again.",
  USER_EXISTS: "That email or username is already taken.",
  NETWORK: "Can't reach ScoreCast. Check your connection.",
  UNKNOWN: "Couldn't create your account. Please try again.",
};

export default function SignupScreen() {
  const router = useRouter();
  const [serverError, setServerError] = useState<AuthErrorCode | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { firstName: "", lastName: "", username: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: SignupValues) => {
    setServerError(null);
    try {
      await signUpWithDetails(values);
      // Hold credentials for auto sign-in after verification. The verify screen
      // sends the code on mount (single source, avoids a double email).
      setPendingCredentials(values.email, values.password);
      haptics.success();
      router.replace({ pathname: "/(auth)/verify", params: { email: values.email.toLowerCase() } });
    } catch (e) {
      setServerError(e instanceof AuthError ? e.code : "UNKNOWN");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Create account" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {serverError ? (
            <Banner kind={serverError === "NETWORK" ? "offline" : "error"} message={ERROR_COPY[serverError] ?? ERROR_COPY.UNKNOWN!} />
          ) : null}

          <View style={styles.nameRow}>
            <View style={styles.grow}>
              <Controller
                control={control}
                name="firstName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextField label="First name" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.firstName?.message} autoCapitalize="words" />
                )}
              />
            </View>
            <View style={styles.grow}>
              <Controller
                control={control}
                name="lastName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextField label="Last name" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.lastName?.message} autoCapitalize="words" />
                )}
              />
            </View>
          </View>

          <Controller
            control={control}
            name="username"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField label="Username" placeholder="letters, numbers, _" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.username?.message} autoCapitalize="none" autoCorrect={false} />
            )}
          />
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField label="Email" placeholder="you@example.com" keyboardType="email-address" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.email?.message} autoCapitalize="none" autoCorrect={false} autoComplete="email" />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField label="Password" placeholder="At least 8 characters" secureTextEntry secureToggle value={value} onChangeText={onChange} onBlur={onBlur} error={errors.password?.message} autoCapitalize="none" />
            )}
          />
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField label="Confirm password" secureTextEntry secureToggle value={value} onChangeText={onChange} onBlur={onBlur} error={errors.confirmPassword?.message} autoCapitalize="none" returnKeyType="go" onSubmitEditing={handleSubmit(onSubmit)} />
            )}
          />

          <Button label="Create account" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />

          <View style={styles.footer}>
            <Text variant="body" color="textSecondary">Already have an account? </Text>
            <Link href="/(auth)/login">
              <Text variant="bodyMedium" color="accent">Log in</Text>
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
  scroll: { paddingHorizontal: layout.gutter, gap: spacing.lg, paddingVertical: spacing.lg, paddingBottom: spacing.xxxl },
  nameRow: { flexDirection: "row", gap: spacing.md },
  grow: { flex: 1 },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: spacing.sm },
});
