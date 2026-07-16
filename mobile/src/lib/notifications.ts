import { useEffect, useRef } from "react";
import { Alert, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { apiFetch } from "./api";

// NS4 — client push (PUSH_SPEC.md §5). Register the device's Expo push token
// with the backend, prompt for permission contextually (after the first
// prediction), and route notification taps to the relevant league.

// Foreground presentation: show banners while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// The token we registered, kept so we can unregister on sign-out.
let registeredToken: string | null = null;

function projectId(): string | undefined {
  return (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;
}

async function registerToken(): Promise<void> {
  try {
    const pid = projectId();
    const tokenData = pid
      ? await Notifications.getExpoPushTokenAsync({ projectId: pid })
      : await Notifications.getExpoPushTokenAsync();
    registeredToken = tokenData.data;
    const platform = Platform.OS === "android" ? "android" : "ios";
    await apiFetch("/api/push/register", {
      method: "POST",
      body: JSON.stringify({ token: registeredToken, platform }),
    });
  } catch (err) {
    console.warn("[push] token registration failed:", err);
  }
}

// On app start: register only if permission is already granted (tokens rotate).
export async function registerIfGranted(): Promise<void> {
  if (!Device.isDevice) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") await registerToken();
}

// Contextual ask (after the first prediction). Soft pre-prompt first, then the
// OS dialog — but only when permission is still undetermined, so we never nag.
export async function maybePromptForPush(): Promise<void> {
  if (!Device.isDevice) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") {
    await registerToken();
    return;
  }
  if (status !== "undetermined") return; // previously denied — don't nag

  Alert.alert(
    "Get deadline reminders?",
    "We'll nudge you before prediction deadlines and when your results are in.",
    [
      { text: "Not now", style: "cancel" },
      {
        text: "Enable",
        onPress: async () => {
          const req = await Notifications.requestPermissionsAsync();
          if (req.status === "granted") await registerToken();
        },
      },
    ]
  );
}

// On sign-out: remove this device's token server-side (needs the still-valid
// session, so call BEFORE signOut()).
export async function unregisterPush(): Promise<void> {
  if (!registeredToken) return;
  try {
    await apiFetch("/api/push/register", {
      method: "DELETE",
      body: JSON.stringify({ token: registeredToken }),
    });
  } catch {
    // best-effort
  }
  registeredToken = null;
}

// Route notification taps (and cold-start opens) to the relevant league.
// `ready` = the navigator is mounted and the auth gate has settled; the
// cold-start route must wait for it or the push is dropped / overridden by the
// gate's redirect onto the tabs.
export function usePushObserver(ready: boolean): void {
  const router = useRouter();
  const coldHandled = useRef(false);

  const routeTo = (data: unknown) => {
    const leagueId = (data as { leagueId?: string } | undefined)?.leagueId;
    if (leagueId) router.push({ pathname: "/league/[id]", params: { id: String(leagueId) } });
  };

  // Taps while the app is running/backgrounded — navigator already mounted.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      routeTo(response.notification.request.content.data);
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Cold start: the app was launched by tapping a notification. Run once, after
  // `ready`, and after a tick so the initial index→tabs redirect completes —
  // then push the league on top.
  useEffect(() => {
    if (!ready || coldHandled.current) return;
    coldHandled.current = true;
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data;
      setTimeout(() => routeTo(data), 400);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, router]);
}
