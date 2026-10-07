import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/**
 * One haptic per kind of event (DESIGN.md §3.8). iOS turns these off when the
 * user disables System Haptics; failures are ignored (simulators, web).
 */
const run = (fn: () => Promise<void>) => {
  if (Platform.OS === "web") return;
  fn().catch(() => undefined);
};

export const haptics = {
  /** Tab, chip, segment or picker selection. */
  selection: () => run(() => Haptics.selectionAsync()),
  /** Primary button press, the Add tab. */
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Saved, goal reached, transfer done. */
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Before a destructive confirmation. */
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** A save that failed validation. */
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
