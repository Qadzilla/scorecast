import { useEffect } from "react";
import { StyleSheet, Pressable, Image, Text } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Animated, {
  FadeIn,
  ReduceMotion,
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSession } from "@/lib/auth";
import { fontFamily } from "@/constants/theme";

// Welcome gate — the real S:C mark (same asset as the native splash) settling
// onto the pitch center circle. Tap anywhere to continue: dashboard if signed
// in, login if not. The root layout's gate skips this screen so it never
// auto-redirects before the tap.
//
// Entrances force `reduceMotion: Never` so the screen animates in even with the
// OS "Reduce Motion" setting on (otherwise it just hard-cuts from the splash).
const NAVY = "#1d2d3d";
const ON = "#eef6ff"; // off-white
const LINE = "rgba(238,246,255,0.28)"; // blueprint pitch line

export default function Welcome() {
  const router = useRouter();
  const { data: session } = useSession();

  const scale = useSharedValue(0.82);
  const opacity = useSharedValue(0);
  const hint = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 500, reduceMotion: ReduceMotion.Never });
    scale.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.back(1.4)), reduceMotion: ReduceMotion.Never });
    hint.value = withRepeat(withTiming(1, { duration: 1100, reduceMotion: ReduceMotion.Never }), -1, true);
  }, [opacity, scale, hint]);

  const badgeStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  const hintStyle = useAnimatedStyle(() => ({ opacity: hint.value }));

  const onContinue = () => router.replace(session ? "/(tabs)" : "/(auth)/login");

  return (
    <Pressable style={styles.root} onPress={onContinue} accessibilityRole="button" accessibilityLabel="Continue">
      <StatusBar style="light" />
      <Animated.View
        entering={FadeIn.duration(500).reduceMotion(ReduceMotion.Never)}
        style={styles.halfLine}
        pointerEvents="none"
      />
      <Animated.View style={[styles.circle, badgeStyle]}>
        <Image source={require("../../assets/images/sc-mark.png")} style={styles.mark} resizeMode="contain" />
      </Animated.View>
      <Animated.View
        entering={FadeIn.duration(500).delay(400).reduceMotion(ReduceMotion.Never)}
        style={styles.footer}
        pointerEvents="none"
      >
        <Text style={styles.wordmark}>ScoreCast</Text>
        <Animated.Text style={[styles.hint, hintStyle]}>Tap to continue</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NAVY, alignItems: "center", justifyContent: "center" },
  halfLine: { position: "absolute", left: 0, right: 0, top: "50%", marginTop: -1, height: 2, backgroundColor: LINE },
  circle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: LINE,
    alignItems: "center",
    justifyContent: "center",
  },
  mark: { width: 160, height: 120 },
  footer: { position: "absolute", bottom: 56, left: 0, right: 0, alignItems: "center", gap: 8 },
  wordmark: { fontFamily: fontFamily.extrabold, fontSize: 24, lineHeight: 30, letterSpacing: 0.3, color: ON },
  hint: { fontFamily: fontFamily.mono, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: ON },
});
