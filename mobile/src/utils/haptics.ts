import * as Haptics from "expo-haptics";

// Haptics are punctuation, not narration (MOBILE_DESIGN_SPEC.md §2.3).
// Use these named intents rather than calling expo-haptics directly so the
// mapping stays in one place. All are best-effort — failures are swallowed.
export const haptics = {
  /** Segment / team pick. */
  select: () => void Haptics.selectionAsync().catch(() => {}),
  /** A score digit entered. */
  tap: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  /** Predictions submitted, league joined. */
  success: () =>
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  /** A destructive confirm is shown. */
  warn: () =>
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
};
