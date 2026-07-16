import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import { emailOTPClient, inferAdditionalFields } from "better-auth/client/plugins";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "./config";

// better-auth Expo client (MOBILE_PLAN.md §4.1). The expoClient plugin stores
// the session in SecureStore and replays it as a header on each request, so
// there is no cookie jar to manage. Server side registers the matching expo()
// plugin and trusts the scorecast:// scheme.
//
// - emailOTPClient exposes emailOtp.{sendVerificationOtp,verifyEmail} for MS10.
// - inferAdditionalFields types the custom signup fields (matches the server's
//   user.additionalFields + the web client).
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      scheme: "scorecast",
      storagePrefix: "scorecast",
      // MUST match the server's advanced.cookiePrefix ("pl-predictions").
      // Otherwise the client's hasBetterAuthCookies() check fails and it
      // silently drops the session cookie after sign-in (getCookie() stays
      // empty → no session → no redirect).
      cookiePrefix: "pl-predictions",
      storage: SecureStore,
    }),
    emailOTPClient(),
    inferAdditionalFields({
      user: {
        username: { type: "string", required: true },
        firstName: { type: "string", required: true },
        lastName: { type: "string", required: true },
      },
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
  | "USER_EXISTS"
  | "INVALID_CODE"
  | "NETWORK"
  | "UNKNOWN";

export class AuthError extends Error {
  code: AuthErrorCode;
  /** Present when the server told us the email is unverified — carry it to the verify screen. */
  email?: string;
  /** Raw server code/status/message, surfaced in dev so failures aren't opaque. */
  detail?: string;
  constructor(code: AuthErrorCode, email?: string, detail?: string) {
    super(code);
    this.name = "AuthError";
    this.code = code;
    this.email = email;
    this.detail = detail;
  }
}

// Turn a better-auth error object into a readable "CODE / status / message"
// string for diagnostics (shown in dev builds).
function describe(error: { status?: number; code?: string; message?: string } | null | undefined): string {
  if (!error) return "";
  return [error.code, error.status, error.message].filter(Boolean).join(" · ");
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
    if (status === 429 || msg.includes("too many")) throw new AuthError("RATE_LIMITED", undefined, describe(error));
    // Only treat as unverified when the server actually says so — NOT every 403
    // (an origin/CSRF 403 is a different failure and must not look like this).
    if (error.code === "EMAIL_NOT_VERIFIED" || msg.includes("not verified") || msg.includes("verify")) {
      throw new AuthError("EMAIL_NOT_VERIFIED", email, describe(error));
    }
    if (status === 401 || error.code === "INVALID_EMAIL_OR_PASSWORD" || msg.includes("invalid")) {
      throw new AuthError("INVALID_CREDENTIALS", undefined, describe(error));
    }
    // Anything else (e.g. a 403 origin rejection) surfaces as UNKNOWN + detail.
    throw new AuthError("UNKNOWN", undefined, describe(error));
  }
}

/** Create an account (MOBILE_PLAN.md §5.4 signup). Does not sign in — signup
 * requires email verification; the verify screen signs in on success. */
export async function signUpWithDetails(input: {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
}): Promise<void> {
  const { error } = await signUp.email({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    name: `${input.firstName.trim()} ${input.lastName.trim()}`,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    username: input.username.trim().toLowerCase(),
  });
  if (error) {
    const status = error.status;
    const msg = (error.message || "").toLowerCase();
    if (status === 429 || msg.includes("too many")) throw new AuthError("RATE_LIMITED");
    if (msg.includes("already") || msg.includes("exists") || msg.includes("taken") || status === 422) {
      throw new AuthError("USER_EXISTS");
    }
    throw new AuthError("UNKNOWN");
  }
}

/** Send (or resend) the 6-digit email-verification code. */
export async function sendVerificationCode(email: string): Promise<void> {
  let result: Awaited<ReturnType<typeof authClient.emailOtp.sendVerificationOtp>>;
  try {
    result = await authClient.emailOtp.sendVerificationOtp({
      email: email.trim().toLowerCase(),
      type: "email-verification",
    });
  } catch (e) {
    // Only a thrown exception is a genuine transport failure.
    throw new AuthError("NETWORK", undefined, String((e as Error)?.message ?? e));
  }
  if (result.error) {
    if (result.error.status === 429) throw new AuthError("RATE_LIMITED", undefined, describe(result.error));
    throw new AuthError("UNKNOWN", undefined, describe(result.error));
  }
}

/** Verify the code. Returns true if a follow-up sign-in succeeded (when the
 * password was held from signup), false if the caller should route to login. */
export async function verifyEmailCode(email: string, otp: string): Promise<void> {
  const { error } = await authClient.emailOtp.verifyEmail({
    email: email.trim().toLowerCase(),
    otp,
  });
  if (error) {
    const status = error.status;
    if (status === 429) throw new AuthError("RATE_LIMITED");
    throw new AuthError("INVALID_CODE");
  }
}
