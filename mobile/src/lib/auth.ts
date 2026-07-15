import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "./config";

// better-auth Expo client (MOBILE_PLAN.md §4.1). The expoClient plugin stores
// the session in SecureStore and replays it as a header on each request, so
// there is no cookie jar to manage. Server side registers the matching expo()
// plugin and trusts the scorecast:// scheme.
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      scheme: "scorecast",
      storagePrefix: "scorecast",
      storage: SecureStore,
    }),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;

// The Cookie header the Expo client persists — attach to plain fetch() calls
// (our TanStack Query layer) so they carry the session too.
export function authHeaders(): Record<string, string> {
  const cookie = authClient.getCookie();
  return cookie ? { Cookie: cookie } : {};
}
