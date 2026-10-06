import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** iOS floating tab bar pill. */
export const TAB_BAR_HEIGHT = 70;
/** Android bottom tab bar, without the system navigation inset. */
export const ANDROID_TAB_BAR_HEIGHT = 64;
/** Minimum touch target (Apple HIG 44 pt, Material 48 dp). */
export const MIN_TOUCH = 44;

/** Gap between the iOS pill and the bottom edge: the home indicator inset, or 12 pt without one. */
export const iosTabBarBottom = (insetBottom: number) => Math.max(insetBottom, 12);

/**
 * Space the tab bar takes at the bottom of a tab screen, so the last item can
 * scroll clear of it on every device (U-9).
 */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return Platform.OS === "ios"
    ? iosTabBarBottom(insets.bottom) + TAB_BAR_HEIGHT + 16
    : ANDROID_TAB_BAR_HEIGHT + Math.max(insets.bottom, 8) + 16;
}
