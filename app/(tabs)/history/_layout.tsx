import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useLargeTitleOptions } from "@/hooks/useLargeTitleOptions";

export default function HistoryStack() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={useLargeTitleOptions()}>
      <Stack.Screen name="index" options={{ title: t("history.title") }} />
    </Stack>
  );
}
