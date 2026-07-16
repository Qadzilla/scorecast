import { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useRouter } from "expo-router";
import { Text } from "@/components/Text";
import { Field } from "@/components/Field";
import { SolidButton } from "@/components/SolidButton";
import { FormErrorStrip } from "@/components/FormErrorStrip";
import { loginSchema, type LoginValues } from "@/lib/validation";
import { loginWithIdentifier, AuthError, type AuthErrorCode } from "@/lib/auth";
import { setPendingCredentials } from "@/lib/pendingCredentials";
import { haptics } from "@/utils/haptics";
import { brand } from "@/constants/brand";
import { spacing, layout, fontFamily } from "@/constants/theme";

const MARK = require("../../../assets/images/sc-mark-ink.png");

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
    } catch (e) {
      const code = e instanceof AuthError ? e.code : "UNKNOWN";
      setServerError(code);
      setDetail(e instanceof AuthError ? e.detail ?? null : String(e));
      if (code === "EMAIL_NOT_VERIFIED" && e instanceof AuthError && e.email) {
        setPendingCredentials(e.email, values.password);
        router.push({ pathname: "/(auth)/verify", params: { email: e.email } });
      }
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Animated.View entering={FadeInDown.duration(420)}>
              <Image source={MARK} style={styles.mark} contentFit="contain" />
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(420).delay(90)}>
              <Text style={styles.headline}>Welcome back.</Text>
              <Text style={styles.subhead}>Log in to make your picks.</Text>
            </Animated.View>

            {serverError ? (
              <View style={styles.errorWrap}>
                <FormErrorStrip
                  kind={serverError === "NETWORK" ? "offline" : "error"}
                  message={`${ERROR_COPY[serverError] ?? ERROR_COPY.UNKNOWN!}${detail ? `\n[${detail}]` : ""}`}
                />
              </View>
            ) : null}

            <Animated.View style={styles.form} entering={FadeInDown.duration(420).delay(170)}>
              <Controller
                control={control}
                name="identifier"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field
                    label="Username or email"
                    placeholder="you@example.com"
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
                  <Field
                    label="Password"
                    placeholder="Your password"
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
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(420).delay(250)}>
              <SolidButton label="Log in" onPress={handleSubmit(onSubmit)} loading={isSubmitting} style={styles.cta} />

              <View style={styles.footer}>
                <Text style={styles.footerText}>New here? </Text>
                <Link href="/(auth)/signup">
                  <Text style={styles.footerLink}>Create an account</Text>
                </Link>
              </View>
            </Animated.View>
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
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: layout.gutter,
    paddingVertical: spacing.xxxl,
  },
  mark: { width: 132, height: 93, marginBottom: spacing.xl, marginLeft: -4 },
  headline: { fontFamily: fontFamily.extrabold, fontSize: 32, lineHeight: 38, letterSpacing: -0.6, color: brand.ink },
  subhead: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22, color: brand.muted, marginTop: spacing.sm },
  errorWrap: { marginTop: spacing.xl },
  form: { marginTop: spacing.xxl, gap: spacing.xl },
  cta: { marginTop: spacing.xxl },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: spacing.xl },
  footerText: { fontFamily: fontFamily.regular, fontSize: 15, color: brand.muted },
  footerLink: { fontFamily: fontFamily.semibold, fontSize: 15, color: brand.line },
});
