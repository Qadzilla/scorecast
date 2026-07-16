import { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useRouter } from "expo-router";
import { Text } from "@/components/Text";
import { Field } from "@/components/Field";
import { SolidButton } from "@/components/SolidButton";
import { FormErrorStrip } from "@/components/FormErrorStrip";
import { signupSchema, type SignupValues } from "@/lib/validation";
import { signUpWithDetails, AuthError, type AuthErrorCode } from "@/lib/auth";
import { setPendingCredentials } from "@/lib/pendingCredentials";
import { haptics } from "@/utils/haptics";
import { brand } from "@/constants/brand";
import { spacing, layout, fontFamily } from "@/constants/theme";

const MARK = require("../../../assets/images/sc-mark-ink.png");

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
      setPendingCredentials(values.email, values.password);
      haptics.success();
      router.replace({ pathname: "/(auth)/verify", params: { email: values.email.toLowerCase() } });
    } catch (e) {
      setServerError(e instanceof AuthError ? e.code : "UNKNOWN");
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Pressable
              onPress={() => router.back()}
              hitSlop={layout.hitSlop}
              style={styles.back}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={26} color={brand.ink} />
            </Pressable>

            <Image source={MARK} style={styles.mark} contentFit="contain" />
            <Text style={styles.headline}>Create your account.</Text>
            <Text style={styles.subhead}>Free, and takes a minute.</Text>

            {serverError ? (
              <View style={styles.errorWrap}>
                <FormErrorStrip
                  kind={serverError === "NETWORK" ? "offline" : "error"}
                  message={ERROR_COPY[serverError] ?? ERROR_COPY.UNKNOWN!}
                />
              </View>
            ) : null}

            <View style={styles.form}>
              <View style={styles.nameRow}>
                <View style={styles.grow}>
                  <Controller
                    control={control}
                    name="firstName"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Field label="First name" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.firstName?.message} autoCapitalize="words" />
                    )}
                  />
                </View>
                <View style={styles.grow}>
                  <Controller
                    control={control}
                    name="lastName"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Field label="Last name" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.lastName?.message} autoCapitalize="words" />
                    )}
                  />
                </View>
              </View>

              <Controller
                control={control}
                name="username"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field label="Username" placeholder="letters, numbers, _" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.username?.message} autoCapitalize="none" autoCorrect={false} />
                )}
              />
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field label="Email" placeholder="you@example.com" keyboardType="email-address" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.email?.message} autoCapitalize="none" autoCorrect={false} autoComplete="email" />
                )}
              />
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field label="Password" placeholder="At least 8 characters" secureTextEntry secureToggle value={value} onChangeText={onChange} onBlur={onBlur} error={errors.password?.message} autoCapitalize="none" />
                )}
              />
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field label="Confirm password" secureTextEntry secureToggle value={value} onChangeText={onChange} onBlur={onBlur} error={errors.confirmPassword?.message} autoCapitalize="none" returnKeyType="go" onSubmitEditing={handleSubmit(onSubmit)} />
                )}
              />
            </View>

            <SolidButton label="Create account" onPress={handleSubmit(onSubmit)} loading={isSubmitting} style={styles.cta} />

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Link href="/(auth)/login">
                <Text style={styles.footerLink}>Log in</Text>
              </Link>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.paper },
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  back: { width: 40, height: 40, justifyContent: "center", marginLeft: -8, marginBottom: spacing.sm },
  mark: { width: 108, height: 76, marginBottom: spacing.lg, marginLeft: -3 },
  headline: { fontFamily: fontFamily.extrabold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, color: brand.ink },
  subhead: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22, color: brand.muted, marginTop: spacing.sm },
  errorWrap: { marginTop: spacing.lg },
  form: { marginTop: spacing.xl, gap: spacing.xl },
  nameRow: { flexDirection: "row", gap: spacing.md },
  grow: { flex: 1 },
  cta: { marginTop: spacing.xxl },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: spacing.xl },
  footerText: { fontFamily: fontFamily.regular, fontSize: 15, color: brand.muted },
  footerLink: { fontFamily: fontFamily.semibold, fontSize: 15, color: brand.line },
});
