import { useEffect } from "react";
import { router, type Href } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import { useAppStore } from "@/store/useAppStore";
import { useSession } from "@/store/session";
import { dateKey, isDue } from "@/models";

/**
 * The system tab bar (DESIGN.md §4.1): Liquid Glass on iOS 26, Material
 * bottom navigation on Android, SF Symbols / Material Symbols as icons.
 * Five tabs (Android's maximum); Settings lives in the Overview stack.
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

  return (
    <NativeTabs minimizeBehavior="onScrollDown" tintColor={colors.accent}>
      <NativeTabs.Trigger name="(overview)">
        <NativeTabs.Trigger.Label>{t("tabs.overview")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "chart.pie", selected: "chart.pie.fill" }} md="pie_chart" />
        {/* Any text shows the badge, even "0"; only an empty, hidden badge is removed. */}
        <NativeTabs.Trigger.Badge hidden={dueCount === 0}>{dueCount > 0 ? String(dueCount) : undefined}</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Label>{t("tabs.history")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "clock", selected: "clock.fill" }} md="history" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="add">
        <NativeTabs.Trigger.Label>{t("tabs.add")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "plus.circle", selected: "plus.circle.fill" }} md="add_circle" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="savings">
        <NativeTabs.Trigger.Label>{t("tabs.savings")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "banknote", selected: "banknote.fill" }} md="savings" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="budget">
        <NativeTabs.Trigger.Label>{t("tabs.budget")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "wallet.pass", selected: "wallet.pass.fill" }} md="account_balance_wallet" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
