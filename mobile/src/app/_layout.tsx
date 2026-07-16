import { useEffect, useState } from "react";
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
import { useFavoriteTeam } from "@/lib/queries";
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
  const hasSession = !!session;
  const fav = useFavoriteTeam(hasSession);
  const segments = useSegments();
  const router = useRouter();

  // First-boot readiness = fonts + the initial session read. The favorite-team
  // query is deliberately NOT part of this: gating the render on it would
  // unmount the whole navigator every time the session changes (e.g. right
  // after login/verify), tearing down navigation state and bouncing the user
  // back to the first screen. Once booted, the navigator stays mounted and the
  // gate only ever redirects.
  // Latch first-boot readiness: once fonts + the initial session read complete,
  // stay booted. better-auth's useSession can briefly flip isPending back to
  // true on later refreshes; without the latch that unmounts the whole
  // navigator (returns null) and churns navigation ("random bugging").
  const [booted, setBooted] = useState(false);
  useEffect(() => {
    if (fontsReady && !isPending) setBooted(true);
  }, [fontsReady, isPending]);

  // TEMP diagnostic (dev only) — remove once the login redirect is confirmed.
  if (__DEV__) {
    console.log("[gate]", {
      booted,
      hasSession,
      isPending,
      favStatus: fav.status,
      favIsLoading: fav.isLoading,
      favTeamId: fav.data?.favoriteTeamId ?? null,
      seg: segments[0] ?? "(index)",
    });
  }

  useEffect(() => {
    if (booted) SplashScreen.hideAsync();
  }, [booted]);

  // Auth + onboarding gate. Signed-out users can't sit in tabs/team-select;
  // signed-in users without a favorite team are forced through team-select
  // exactly once; everyone else lands in tabs. Dev gallery/debug are untouched.
  // While the team status is still loading we just wait (no redirect, no
  // unmount). On a favorite-team fetch error we don't trap the user.
  useEffect(() => {
    if (!booted) return;
    const root = segments[0];
    const inAuth = root === "(auth)";
    const onTeamSelect = root === "team-select";

    if (!session) {
      if (root === "(tabs)" || onTeamSelect) {
        if (__DEV__) console.log("[gate] no session on protected route -> login");
        router.replace("/(auth)/login");
      }
      return;
    }

    if (fav.isLoading) {
      if (__DEV__) console.log("[gate] session present, waiting on team status…");
      return; // wait for team status before onboarding routing
    }

    const needsTeam = fav.data ? fav.data.favoriteTeamId == null : false;
    if (needsTeam && !onTeamSelect) {
      if (__DEV__) console.log("[gate] -> team-select");
      router.replace("/team-select");
    } else if (!needsTeam && (inAuth || onTeamSelect)) {
      if (__DEV__) console.log("[gate] -> tabs");
      router.replace("/(tabs)");
    }
  }, [booted, session, fav.isLoading, fav.data, segments, router]);

  if (!booted) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="team-select" />
      <Stack.Screen name="gallery" options={{ presentation: "modal" }} />
      <Stack.Screen name="debug" options={{ presentation: "modal" }} />
    </Stack>
  );
}
