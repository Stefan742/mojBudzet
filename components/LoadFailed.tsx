import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { retryLoad, startOver, storedDataCopy } from "@/store/useAppStore";
import { shareTextFile } from "@/services/shareFile";
import { haptics } from "@/utils/haptics";
import { useTheme } from "@/hooks/useTheme";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/Button";
import { CONTACT_EMAIL } from "@/constants/app";
import { space, type } from "@/constants/design";

/**
 * Shown when the saved data cannot be opened (damaged, or an update could
 * not convert it), instead of an endless loading screen. Nothing is deleted
 * unless the user asks; a copy can be saved first.
 */
export function LoadFailed() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const run = (action: () => Promise<void>) => async () => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const saveCopy = run(async () => {
    try {
      const day = new Date().toISOString().slice(0, 10);
      await shareTextFile(await storedDataCopy(), `mojbudzet-data-${day}.json`, {
        mimeType: "application/json",
        uti: "public.json",
        dialogTitle: t("loadError.copyTitle"),
      });
    } catch {
      haptics.error();
      Alert.alert(t("loadError.copyFailed"));
    }
  });

  const confirmStartOver = () => {
    haptics.warning();
    Alert.alert(t("settings.deleteAllTitle"), t("loadError.resetBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("settings.deleteAllConfirm"), style: "destructive", onPress: run(startOver) },
    ]);
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space[10], paddingBottom: insets.bottom + space[6] }]}
    >
      <Icon name="warning" size={44} color={colors.warning} />
      <Text style={[type.title2, styles.center, { color: colors.text }]} accessibilityRole="header">
        {t("loadError.title")}
      </Text>
      <Text style={[type.body, styles.center, { color: colors.textSecondary }]}>
        {t("loadError.body", { email: CONTACT_EMAIL })}
      </Text>
      {/* Full width: Button styles only its inner view, so the group sets the width. */}
      <View style={styles.actions}>
        <Button title={t("loadError.retry")} onPress={run(retryLoad)} disabled={busy} />
        <Button title={t("loadError.copy")} variant="tinted" icon="share" onPress={saveCopy} disabled={busy} />
        <Button title={t("loadError.reset")} variant="plain" destructive onPress={confirmStartOver} disabled={busy} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space[8], gap: space[3] },
  center: { textAlign: "center" },
  actions: { alignSelf: "stretch", gap: space[2], marginTop: space[3] },
});
