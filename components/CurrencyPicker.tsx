import React from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { CURRENCY_CODES, type CurrencyCode } from "@/constants/currencies";
import { GUTTER, ROW_MIN, space, type } from "@/constants/design";
import { useTheme } from "@/hooks/useTheme";
import { haptics } from "@/utils/haptics";
import { ModalHeader } from "@/components/ModalHeader";
import { Icon } from "@/components/Icon";
import { PressableRow } from "@/components/ui/Pressables";
import { Section, Separator } from "@/components/ui/Section";

/** Page sheet listing the app's currencies; picking one closes it. */
export function CurrencyPicker({
  selected,
  onSelect,
  onClose,
}: {
  selected: CurrencyCode;
  onSelect: (code: CurrencyCode) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <ModalHeader title={t("settings.currency")} cancelLabel={t("common.cancel")} onCancel={onClose} />
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[6] }]}>
          <Section>
            <View accessibilityRole="radiogroup">
              {CURRENCY_CODES.map((code, i) => {
                const isSelected = code === selected;
                return (
                  <View key={code}>
                    <PressableRow
                      style={styles.row}
                      onPress={() => {
                        if (!isSelected) haptics.selection();
                        onSelect(code);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`${t(`currency.name.${code}`)}, ${code}`}
                    >
                      <Text style={[type.body, styles.name, { color: colors.text }]} numberOfLines={1}>
                        {t(`currency.name.${code}`)}
                      </Text>
                      <Text style={[type.body, { color: colors.textSecondary }]}>{code}</Text>
                      <View style={styles.check}>
                        {isSelected && <Icon name="check" size={18} color={colors.accent} />}
                      </View>
                    </PressableRow>
                    {i < CURRENCY_CODES.length - 1 && <Separator />}
                  </View>
                );
              })}
            </View>
          </Section>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex:    { flex: 1 },
  content: { paddingHorizontal: GUTTER, paddingTop: space[2] },
  row:     { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], minHeight: ROW_MIN + 4 },
  name:    { flex: 1 },
  check:   { width: 18, alignItems: "center" },
});
