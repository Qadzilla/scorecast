import { API_URL } from "./config";
import { authHeaders } from "./auth";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Core fetch wrapper (ported from the web app's lib/api.ts). Differences for
 * React Native: base URL from EXPO_PUBLIC_API_URL (not import.meta), and the
 * session travels as a header from the better-auth Expo client rather than a
 * browser cookie jar. Per-endpoint clients (fixtures/predictions/leaderboard/
 * leagues) are added with their Query hooks in the Stage D data slices.
 */
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new ApiError(body.error || "Request failed", res.status);
  }

  // 204 / empty body tolerance
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Liveness check used by the debug screen (MS7 exit criterion). */
export function getHealth() {
  return apiFetch<{ status: string }>("/health");
}
