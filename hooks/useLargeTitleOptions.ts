import { Platform } from "react-native";
import { useTheme } from "./useTheme";

const isIOS = Platform.OS === "ios";
/** iOS 26 draws its own scroll-edge effect; an extra blur would overlap it. */
const hasScrollEdgeEffect = isIOS && parseInt(String(Platform.Version), 10) >= 26;

/**
 * Native-stack header options for every tab (DESIGN.md §4.2): a large title
 * that collapses into the inline bar on scroll, over a translucent header on
 * iOS; a plain header on the grouped background on Android. Scroll views on
 * these screens must set contentInsetAdjustmentBehavior="automatic".
 */
export function useLargeTitleOptions() {
  const { colors } = useTheme();
  return {
    headerLargeTitleEnabled: true,
    headerTransparent: isIOS,
    ...(isIOS && !hasScrollEdgeEffect ? { headerBlurEffect: "systemChromeMaterial" as const } : {}),
    headerShadowVisible: false,
    headerLargeTitleShadowVisible: false,
    ...(isIOS ? {} : { headerStyle: { backgroundColor: colors.background } }),
    headerTitleStyle: { color: colors.text },
    headerLargeTitleStyle: { color: colors.text },
    headerTintColor: colors.accent,
    headerBackButtonDisplayMode: "minimal" as const,
    contentStyle: { backgroundColor: colors.background },
  };
}
