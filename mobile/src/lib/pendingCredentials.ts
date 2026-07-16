// Ephemeral, in-memory holder for the just-entered credentials so the app can
// auto sign-in immediately after OTP verification (MOBILE_PLAN.md §4.2). Never
// persisted, never put in navigation params. Set at signup (or at a login that
// hits EMAIL_NOT_VERIFIED), consumed once on the verify screen, then cleared.
let pending: { email: string; password: string } | null = null;

export function setPendingCredentials(email: string, password: string) {
  pending = { email: email.toLowerCase(), password };
}

export function takePendingPassword(email: string): string | null {
  if (pending && pending.email === email.toLowerCase()) {
    const pw = pending.password;
    pending = null;
    return pw;
  }
  return null;
}

export function clearPendingCredentials() {
  pending = null;
}
