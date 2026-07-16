import { useEffect } from "react";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { fontMap } from "@/constants/fonts";
import { queryClient } from "@/lib/queryClient";
import { useSession } from "@/lib/auth";
import { colors } from "@/constants/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontMap);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <RootNavigator fontsReady={fontsLoaded || !!fontError} />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { data: session, isPending } = useSession();
  const segments = useSegments();
  const router = useRouter();

  // Ready once fonts are loaded AND the session has resolved from SecureStore.
  const ready = fontsReady && !isPending;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Auth gate: signed-out users can't sit in the tab stack; signed-in users
  // are bounced out of the auth stack. Dev-only gallery/debug are untouched.
  useEffect(() => {
    if (!ready) return;
    const root = segments[0];
    if (!session && root === "(tabs)") {
      router.replace("/(auth)/login");
    } else if (session && root === "(auth)") {
      router.replace("/(tabs)");
    }
  }, [ready, session, segments, router]);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="gallery" options={{ presentation: "modal" }} />
      <Stack.Screen name="debug" options={{ presentation: "modal" }} />
    </Stack>
  );
}
