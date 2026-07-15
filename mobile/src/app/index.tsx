import { Redirect } from "expo-router";

// Entry point. The real session gate (session -> tabs, none -> auth) lands in
// MS9; for the scaffold we route straight to the placeholder auth stack.
export default function Index() {
  return <Redirect href="/(auth)/login" />;
}
