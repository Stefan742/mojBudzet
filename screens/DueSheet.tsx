import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { TransactionKind, dayFromKey } from "../models";
import { useAppStore } from "../store/useAppStore";
import { showToast } from "../store/session";
import { formatMoney } from "../utils/money";
import { haptics } from "../utils/haptics";
import { useTheme } from "@/hooks/useTheme";
import { useCurrency } from "@/hooks/useCurrency";
import { useAmountField } from "@/hooks/useAmountField";
import { DateField } from "@/components/DateField";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { periodLabel, ruleName } from "@/components/recurring/text";
import { GUTTER, ROW_MIN, inputType, money, space, type } from "@/constants/design";

/**
 * Adding one occurrence of a repeating transaction, as a native form sheet:
 * confirm or change the amount (always asked for changing bills) and the
 * date, or skip it this time.
 */
export default function DueSheet() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const currency = useCurrency();
  const { id } = useLocalSearchParams<{ id: string }>();
  const rule = useAppStore((s) => s.recurring.find((r) => r.id === id));

  // A changing amount starts empty (the last one is shown as a hint); a fixed one is prefilled.
  const amount = useAmountField(rule && !rule.variable ? rule.amount : 0);
  const [date, setDate] = useState(() => (rule ? dayFromKey(rule.nextDate) : new Date()));

  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  if (!rule) return null;
  const name = ruleName(rule, t);
  const income = rule.kind === TransactionKind.INCOME;
  const typed = amount.peek();

  const undoAction = (undo: ReturnType<ReturnType<typeof useAppStore.getState>["addRecurringOccurrence"]>) =>
    undo ? { label: t("repeating.undo"), onPress: () => useAppStore.getState().undoRecurring(undo) } : undefined;

  const handleAdd = () => {
    const value = amount.parse();
    if (value === null) {
      haptics.error();
      return;
    }
    const undo = useAppStore.getState().addRecurringOccurrence(rule.id, { amount: value, date });
    haptics.success();
    showToast(t("repeating.added", { name }), "checkCircle", undefined, undoAction(undo));
    close();
  };

  const handleSkip = () => {
    const undo = useAppStore.getState().skipRecurringOccurrence(rule.id);
    haptics.selection();
    showToast(t("repeating.skipped", { name }), "repeat", colors.textSecondary, undoAction(undo));
    close();
  };

  const handleEdit = () => {
    close();
    router.push({ pathname: "/repeating", params: { edit: rule.id } });
  };

  const addTitle = typed
    ? t(income ? "repeating.receivedAmount" : "repeating.addAmount", { amount: formatMoney(typed, currency) })
    : income ? t("repeating.received") : t("repeating.add");

  return (
    <ScrollView
      style={{ backgroundColor: colors.surfaceRaised }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Text style={[type.title2, styles.center, { color: colors.text }]} accessibilityRole="header">
        {t("repeating.sheetTitle", { name, period: periodLabel(rule, i18n.language) })}
      </Text>

      <Section
        cardStyle={{ backgroundColor: colors.background }}
        footer={amount.errorText ?? (rule.variable && rule.amount > 0 ? t("repeating.lastTime", { amount: formatMoney(rule.amount, currency) }) : null)}
        footerColor={amount.errorText ? colors.destructive : undefined}
      >
        <View style={styles.amountRow}>
          <TextInput
            style={[inputType(type.title1), money, styles.amountInput, { color: colors.text }]}
            value={amount.text}
            onChangeText={amount.onChangeText}
            placeholder={rule.variable ? t("repeating.enterAmount") : "0"}
            placeholderTextColor={colors.placeholder}
            keyboardType={amount.keyboardType}
            autoFocus={rule.variable}
            accessibilityLabel={t("history.amount")}
          />
          <Text style={[type.title3, { color: colors.textSecondary }]}>{currency.label}</Text>
        </View>
      </Section>

      <Section cardStyle={{ backgroundColor: colors.background }}>
        <DateField label={t("history.date")} value={date} onChange={setDate} />
      </Section>

      <View style={styles.actions}>
        <Button title={addTitle} icon="check" onPress={handleAdd} />
        <Button title={t("repeating.skip")} variant="plain" onPress={handleSkip} />
        <Button title={t("repeating.edit")} variant="plain" onPress={handleEdit} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content:     { padding: GUTTER, paddingTop: space[8], gap: space[4] },
  center:      { textAlign: "center" },
  amountRow:   { flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[4], minHeight: ROW_MIN + 20 },
  amountInput: { flex: 1, minWidth: 0, paddingVertical: space[2] },
  actions:     { gap: space[1], marginTop: space[2] },
});
