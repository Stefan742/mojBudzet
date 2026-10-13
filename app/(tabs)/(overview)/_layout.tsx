import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useLargeTitleOptions } from "@/hooks/useLargeTitleOptions";
import { useTheme } from "@/hooks/useTheme";

// Deep links to /settings still have Overview underneath.
export const unstable_settings = { initialRouteName: "index" };

export default function OverviewStack() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Stack screenOptions={useLargeTitleOptions()}>
      <Stack.Screen name="index" options={{ title: t("overview.title") }} />
      <Stack.Screen name="settings" options={{ title: t("settings.title") }} />
      <Stack.Screen name="repeating" options={{ title: t("repeating.title") }} />
      <Stack.Screen
        name="leftover"
        options={{
          presentation: "formSheet",
          headerShown: false,
          sheetAllowedDetents: [0.75, 1],
          sheetGrabberVisible: true,
          sheetCornerRadius: 24,
          contentStyle: { backgroundColor: colors.surfaceRaised },
        }}
      />
      <Stack.Screen
        name="due"
        options={{
          presentation: "formSheet",
          headerShown: false,
          sheetAllowedDetents: [0.7, 1],
          sheetGrabberVisible: true,
          sheetCornerRadius: 24,
          contentStyle: { backgroundColor: colors.surfaceRaised },
        }}
      />
    </Stack>
  );
}
