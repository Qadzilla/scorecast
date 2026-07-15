// API base URL. Dev: set EXPO_PUBLIC_API_URL to your machine's LAN IP so the
// simulator/device can reach the local backend (localhost won't work from a
// physical device). Prod: the Railway URL. Falls back to the deployed API.
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") || "https://api.scorecast.club";
