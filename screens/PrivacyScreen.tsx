import React from "react";
import { ScrollView, Text, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { CONTACT_EMAIL } from "@/constants/app";

const SECTIONS = ["data", "storage", "backups", "sharing", "suggestions", "rights", "children", "changes"] as const;

/** In-app privacy policy (R-2). The same text is in PRIVACY.md for the store listing URL. */
export default function PrivacyScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
    >
      <Text style={[styles.intro, { color: colors.text }]}>{t("privacy.intro")}</Text>
      {SECTIONS.map((key) => (
        <View key={key} style={styles.section}>
          <Text style={[styles.heading, { color: colors.text }]} accessibilityRole="header">
            {t(`privacy.sections.${key}.title`)}
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>{t(`privacy.sections.${key}.body`)}</Text>
        </View>
      ))}
      {CONTACT_EMAIL ? (
        <View style={styles.section}>
          <Text style={[styles.heading, { color: colors.text }]} accessibilityRole="header">
            {t("privacy.contactTitle")}
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]} selectable>
            {CONTACT_EMAIL}
          </Text>
        </View>
      ) : null}
      <Text style={[styles.updated, { color: colors.textSecondary }]}>{t("privacy.updated")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 20 },
  intro: { fontSize: 16, lineHeight: 23 },
  section: { gap: 6 },
  heading: { fontSize: 17, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 22 },
  updated: { fontSize: 13 },
});
