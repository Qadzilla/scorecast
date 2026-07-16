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

// A stable, human-facing reason for a failed auth attempt. Screens map these
// to copy; keeping them as a union avoids leaking raw server strings.
export type AuthErrorCode =
  | "RATE_LIMITED"
  | "INVALID_CREDENTIALS"
  | "EMAIL_NOT_VERIFIED"
  | "NETWORK"
  | "UNKNOWN";

export class AuthError extends Error {
  code: AuthErrorCode;
  /** Present when the server told us the email is unverified — carry it to the verify screen. */
  email?: string;
  constructor(code: AuthErrorCode, email?: string) {
    super(code);
    this.name = "AuthError";
    this.code = code;
    this.email = email;
  }
}

/**
 * Log in with a username OR email (MOBILE_PLAN.md §5.4). Two steps, matching
 * the web app: resolve the identifier to an email via the custom lookup route,
 * then better-auth signIn.email. Errors are normalized to AuthError.
 */
export async function loginWithIdentifier(identifier: string, password: string): Promise<void> {
  const id = identifier.trim().toLowerCase();

  // Step 1 — resolve identifier → email.
  let email: string;
  try {
    const res = await fetch(`${API_URL}/api/auth/lookup-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: id }),
    });
    if (res.status === 429) throw new AuthError("RATE_LIMITED");
    if (!res.ok) throw new AuthError("INVALID_CREDENTIALS");
    const data = (await res.json()) as { email?: string };
    if (!data.email) throw new AuthError("INVALID_CREDENTIALS");
    email = data.email;
  } catch (e) {
    if (e instanceof AuthError) throw e;
    throw new AuthError("NETWORK");
  }

  // Step 2 — password sign-in.
  const { error } = await signIn.email({ email, password });
  if (error) {
    const status = error.status;
    const msg = (error.message || "").toLowerCase();
    if (status === 429 || msg.includes("too many")) throw new AuthError("RATE_LIMITED");
    if (status === 403 || error.code === "EMAIL_NOT_VERIFIED" || msg.includes("not verified")) {
      throw new AuthError("EMAIL_NOT_VERIFIED", email);
    }
    throw new AuthError("INVALID_CREDENTIALS");
  }
}
