import React from "react";
import { ScrollView, Text, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import { GUTTER, space, type } from "@/constants/design";
import { CONTACT_EMAIL } from "@/constants/app";

const SECTIONS = ["data", "storage", "backups", "sharing", "suggestions", "rights", "children", "changes"] as const;

/** In-app privacy policy (R-2). The same text is in PRIVACY.md for the store listing URL. */
export default function PrivacyScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[type.body, { color: colors.text }]}>{t("privacy.intro")}</Text>
      {SECTIONS.map((key) => (
        <View key={key} style={styles.section}>
          <Text style={[type.headline, { color: colors.text }]} accessibilityRole="header">
            {t(`privacy.sections.${key}.title`)}
          </Text>
          <Text style={[type.callout, { color: colors.textSecondary }]}>{t(`privacy.sections.${key}.body`)}</Text>
        </View>
      ))}
      {CONTACT_EMAIL ? (
        <View style={styles.section}>
          <Text style={[type.headline, { color: colors.text }]} accessibilityRole="header">
            {t("privacy.contactTitle")}
          </Text>
          <Text style={[type.callout, { color: colors.accent }]} selectable>
            {CONTACT_EMAIL}
          </Text>
        </View>
      ) : null}
      <Text style={[type.footnote, { color: colors.textSecondary }]}>{t("privacy.updated")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingTop: space[4], paddingBottom: space[10], gap: space[6] },
  section: { gap: space[2] },
});
