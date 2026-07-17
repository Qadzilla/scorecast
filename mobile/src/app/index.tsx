import { useEffect } from "react";
import { StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Text } from "@/components/Text";
import { useSession } from "@/lib/auth";
import { fontFamily } from "@/constants/theme";

// Welcome gate — the S:C monogram on the pitch center circle (the app icon
// dropped in full-screen). Tap anywhere to continue: dashboard if signed in,
// login if not. The root layout's gate skips this screen so it never
// auto-redirects before the tap.
const NAVY = "#1d2d3d";
const ON = "#eef6ff"; // off-white
const LINE = "rgba(238,246,255,0.28)"; // blueprint pitch line

export default function Welcome() {
  const router = useRouter();
  const { data: session } = useSession();

  const hint = useSharedValue(0.4);
  useEffect(() => {
    hint.value = withRepeat(withTiming(1, { duration: 1100 }), -1, true);
  }, [hint]);
  const hintStyle = useAnimatedStyle(() => ({ opacity: hint.value }));

  const onContinue = () => router.replace(session ? "/(tabs)" : "/(auth)/login");

  return (
    <Pressable style={styles.root} onPress={onContinue} accessibilityRole="button" accessibilityLabel="Continue">
      <StatusBar style="light" />
      {/* halfway line running through the center circle */}
      <Animated.View style={styles.halfLine} pointerEvents="none" />
      <Animated.View entering={FadeIn.duration(600)} style={styles.circle}>
        <Text style={styles.monogram}>S:C</Text>
      </Animated.View>
      <Animated.Text style={[styles.hint, hintStyle]}>Tap to continue</Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NAVY, alignItems: "center", justifyContent: "center" },
  halfLine: { position: "absolute", top: 0, bottom: 0, left: "50%", marginLeft: -1, width: 2, backgroundColor: LINE },
  circle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: LINE,
    alignItems: "center",
    justifyContent: "center",
  },
  monogram: { fontFamily: fontFamily.extrabold, fontSize: 60, letterSpacing: -1, color: ON },
  hint: {
    position: "absolute",
    bottom: 64,
    fontFamily: fontFamily.mono,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: ON,
  },
});
