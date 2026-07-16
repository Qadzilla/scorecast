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

  // Ready once fonts + session resolve, and (for signed-in users) once the
  // favorite-team status is known — so onboarding routing settles under the
  // splash instead of flashing the wrong screen.
  const ready = fontsReady && !isPending && (!hasSession || !fav.isLoading);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Auth + onboarding gate. Signed-out users can't sit in tabs/team-select;
  // signed-in users without a favorite team are forced through team-select
  // exactly once; everyone else lands in tabs. Dev gallery/debug are untouched.
  // On a favorite-team fetch error we don't trap the user (needsTeam = false).
  useEffect(() => {
    if (!ready) return;
    const root = segments[0];
    const inAuth = root === "(auth)";
    const onTeamSelect = root === "team-select";

    if (!session) {
      if (root === "(tabs)" || onTeamSelect) router.replace("/(auth)/login");
      return;
    }

    const needsTeam = fav.data ? fav.data.favoriteTeamId == null : false;
    if (needsTeam && !onTeamSelect) {
      router.replace("/team-select");
    } else if (!needsTeam && (inAuth || onTeamSelect)) {
      router.replace("/(tabs)");
    }
  }, [ready, session, fav.data, segments, router]);

  if (!ready) return null;

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
