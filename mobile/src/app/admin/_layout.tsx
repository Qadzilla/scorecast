import { Stack } from "expo-router";
import { colors } from "@/constants/theme";

// Admin dashboard stack (AD4). Admin-only surfaces — every screen also re-checks
// isAdmin, and the endpoints are server-gated by requireAdmin.
export default function AdminLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
