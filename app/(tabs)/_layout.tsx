import { useEffect } from "react";
import { Platform } from "react-native";
import { router, type Href } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { AndroidSymbol, SFSymbol } from "expo-symbols";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import { useAppStore } from "@/store/useAppStore";
import { useSession } from "@/store/session";
import { dateKey, isDue } from "@/models";
import { tint } from "@/constants/design";

type MdcIcon = keyof typeof MaterialCommunityIcons.glyphMap;

const isAndroid = Platform.OS === "android";

/**
 * A tab's icon: SF Symbols on iOS (unchanged), and on Android the Material 3
 * pattern of an outlined icon that fills in when its tab is selected.
 */
const tabIcon = (sf: { default: SFSymbol; selected: SFSymbol }, md: AndroidSymbol, android: { default: MdcIcon; selected: MdcIcon }) =>
  isAndroid ? (
    <NativeTabs.Trigger.Icon
      src={{
        default: <NativeTabs.Trigger.VectorIcon family={MaterialCommunityIcons} name={android.default} />,
        selected: <NativeTabs.Trigger.VectorIcon family={MaterialCommunityIcons} name={android.selected} />,
      }}
    />
  ) : (
    <NativeTabs.Trigger.Icon sf={sf} md={md} />
  );

/**
 * The system tab bar (DESIGN.md §4.1): Liquid Glass on iOS 26, Material 3
 * navigation bar on Android. Five tabs (Android's maximum); Settings lives in
 * the Overview stack.
 */
export default function TabLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  // Onboarding ends by asking for a tab ("Add your first expense"): go there once mounted.
  const pendingRoute = useSession((s) => s.pendingRoute);
  useEffect(() => {
    if (!pendingRoute) return;
    useSession.getState().setPendingRoute(null);
    router.navigate(pendingRoute as Href);
  }, [pendingRoute]);

  // Repeating transactions waiting to be added: a badge on Overview, where they are.
  const dueCount = useAppStore((s) => {
    const today = dateKey(new Date());
    return s.recurring.filter((r) => isDue(r, today)).length;
  });

  // Material 3 navigation bar, in the app's own colours (light and dark):
  // labels on every tab so items never shift, a tinted pill behind the
  // selected icon, quiet unselected items, an error-red badge. iOS gets none
  // of these and keeps the system look.
  const androidBar = isAndroid
    ? {
        backgroundColor: colors.card,
        labelVisibilityMode: "labeled" as const,
        indicatorColor: tint(colors.accent, "soft"),
        rippleColor: tint(colors.accent, "subtle"),
        iconColor: { default: colors.textSecondary, selected: colors.accent },
        labelStyle: {
          default: { fontSize: 12, fontWeight: "500" as const, color: colors.textSecondary },
          selected: { fontSize: 12, fontWeight: "700" as const, color: colors.text },
        },
        badgeBackgroundColor: colors.destructive,
        badgeTextColor: colors.onAccent,
      }
    : {};

  return (
    <NativeTabs minimizeBehavior="onScrollDown" tintColor={colors.accent} {...androidBar}>
      <NativeTabs.Trigger name="(overview)">
        <NativeTabs.Trigger.Label>{t("tabs.overview")}</NativeTabs.Trigger.Label>
        {tabIcon({ default: "chart.pie", selected: "chart.pie.fill" }, "pie_chart", { default: "chart-pie-outline", selected: "chart-pie" })}
        {/* Any text shows the badge, even "0"; only an empty, hidden badge is removed. */}
        <NativeTabs.Trigger.Badge hidden={dueCount === 0}>{dueCount > 0 ? String(dueCount) : undefined}</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Label>{t("tabs.history")}</NativeTabs.Trigger.Label>
        {tabIcon({ default: "clock", selected: "clock.fill" }, "history", { default: "clock-outline", selected: "clock" })}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="add">
        <NativeTabs.Trigger.Label>{t("tabs.add")}</NativeTabs.Trigger.Label>
        {tabIcon({ default: "plus.circle", selected: "plus.circle.fill" }, "add_circle", { default: "plus-circle-outline", selected: "plus-circle" })}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="savings">
        <NativeTabs.Trigger.Label>{t("tabs.savings")}</NativeTabs.Trigger.Label>
        {tabIcon({ default: "banknote", selected: "banknote.fill" }, "savings", { default: "piggy-bank-outline", selected: "piggy-bank" })}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="budget">
        <NativeTabs.Trigger.Label>{t("tabs.budget")}</NativeTabs.Trigger.Label>
        {tabIcon({ default: "wallet.pass", selected: "wallet.pass.fill" }, "account_balance_wallet", { default: "wallet-outline", selected: "wallet" })}
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
