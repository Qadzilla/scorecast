import { Redirect } from "expo-router";
import { useSession } from "@/lib/auth";

// Entry point: route on session. The root layout's gate keeps it correct
// afterwards (e.g. sign-out while in tabs).
export default function Index() {
  const { data: session, isPending } = useSession();
  if (isPending) return null;
  return <Redirect href={session ? "/(tabs)" : "/(auth)/login"} />;
}
