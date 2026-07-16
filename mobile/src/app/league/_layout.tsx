import { Stack } from "expo-router";
import { colors } from "@/constants/theme";

// Nested stack for league screens (detail + join). Join is presented modally.
export default function LeagueLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="predict" />
      <Stack.Screen name="join" options={{ presentation: "modal" }} />
    </Stack>
  );
}
