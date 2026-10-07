import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useLargeTitleOptions } from "@/hooks/useLargeTitleOptions";
import { useTheme } from "@/hooks/useTheme";

export default function SavingsStack() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Stack screenOptions={useLargeTitleOptions()}>
      <Stack.Screen name="index" options={{ title: t("savings.title") }} />
      <Stack.Screen
        name="transfer"
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
