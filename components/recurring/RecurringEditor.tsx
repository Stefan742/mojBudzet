import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  INCOME_TYPES,
  IncomeType,
  RecurringRule,
  RepeatFrequency,
  TransactionKind,
  categoryLabel,
  dateKey,
  dayFromKey,
} from "../../models";
import { useAppStore } from "../../store/useAppStore";
import { findCategory } from "../../store/selectors";
import { haptics } from "../../utils/haptics";
import { requestReminderPermission } from "../../services/reminders";
import { useTheme } from "@/hooks/useTheme";
import { useCurrency } from "@/hooks/useCurrency";
import { useAmountField } from "@/hooks/useAmountField";
import { ModalHeader } from "@/components/ModalHeader";
import { ChipRow } from "@/components/ChipRow";
import { DateField } from "@/components/DateField";
import { PressableRow } from "@/components/ui/Pressables";
import { Section, Separator } from "@/components/ui/Section";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { GUTTER, ROW_MIN, SECTION_GAP, inputType, money, space, type } from "@/constants/design";

const NONE = "__none__";

/** Page sheet to create or edit a repeating transaction. */
export function RecurringEditor({ rule, isNew, onClose }: { rule: RecurringRule; isNew: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const currency = useCurrency();
  const categories      = useAppStore((s) => s.categories);
  const saveRecurring   = useAppStore((s) => s.saveRecurring);
  const deleteRecurring = useAppStore((s) => s.deleteRecurring);
  const remindersOn     = useAppStore((s) => s.remindersEnabled);

  const [kind, setKind]               = useState(rule.kind);
  const [merchant, setMerchant]       = useState(rule.merchant);
  const [variable, setVariable]       = useState(rule.variable);
  const amount                        = useAmountField(rule.amount, { allowZero: variable });
  const [frequency, setFrequency]     = useState<RepeatFrequency>(rule.frequency);
  const [next, setNext]               = useState(() => dayFromKey(rule.nextDate));
  const [ask, setAsk]                 = useState(rule.ask);
  const [paused, setPaused]           = useState(rule.paused);
  const [categoryId, setCategoryId]   = useState(rule.categoryId);
  const [subcategoryId, setSubId]     = useState(rule.subcategoryId);
  const [incomeType, setIncomeType]   = useState<IncomeType | undefined>(rule.incomeType);
  const [nameError, setNameError]     = useState(false);

  const income = kind === TransactionKind.INCOME;
  const selectedCat = findCategory(categories, categoryId);

  const handleSave = () => {
    // A changing amount is only a hint, so it may stay empty (onboarding saves 0 for it).
    const value = variable && !amount.text.trim() ? 0 : amount.parse();
    const name = merchant.trim() || (income && incomeType ? t(`incomeTypes.${incomeType}`) : "");
    if (!name) setNameError(true);
    if (value === null || !name) {
      haptics.error();
      return;
    }
    saveRecurring({
      ...rule,
      kind,
      merchant: name,
      amount: value,
      variable,
      categoryId: income ? undefined : categoryId,
      subcategoryId: income ? undefined : subcategoryId,
      incomeType: income ? incomeType : undefined,
      frequency,
      day: next.getDate(),
      month: frequency === "yearly" ? next.getMonth() : undefined,
      // A changing amount can only be added by someone who knows it.
      ask: variable ? true : ask,
      paused,
      nextDate: dateKey(next),
    });
    haptics.success();
    if (isNew && remindersOn) void requestReminderPermission();
    onClose();
  };

  const handleDelete = () => {
    haptics.warning();
    Alert.alert(t("repeating.delete"), t("repeating.deleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => {
          deleteRecurring(rule.id);
          onClose();
        },
      },
    ]);
  };

  const switchRow = (label: string, value: boolean, onChange: (v: boolean) => void, disabled = false) => (
    <View style={styles.switchRow}>
      <Text style={[type.body, styles.flex, { color: disabled ? colors.textSecondary : colors.text }]}>{label}</Text>
      <View style={styles.switchSlot}>
        <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.success }} accessibilityLabel={label} />
      </View>
    </View>
  );

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]} behavior="padding">
        <ModalHeader
          title={isNew ? t("repeating.newTitle") : t("repeating.editTitle")}
          cancelLabel={t("common.cancel")}
          saveLabel={t("history.save")}
          onCancel={onClose}
          onSave={handleSave}
        />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[10] }]}
        >
          <SegmentedControl
            options={[
              { value: TransactionKind.EXPENSE, label: t("add.expense") },
              { value: TransactionKind.INCOME, label: t("add.income") },
            ]}
            value={kind}
            onChange={(k) => setKind(k as RecurringRule["kind"])}
          />

          <Section
            footer={nameError ? t("history.merchantRequired") : amount.errorText ?? (variable ? t("repeating.variableFooter") : null)}
            footerColor={nameError || amount.errorText ? colors.destructive : undefined}
          >
            <TextInput
              style={[inputType(type.body), styles.input, { color: colors.text }]}
              placeholder={t("repeating.namePlaceholder")}
              placeholderTextColor={colors.placeholder}
              value={merchant}
              onChangeText={(v) => { setMerchant(v); setNameError(false); }}
              accessibilityLabel={t("repeating.name")}
            />
            <Separator />
            <View style={styles.amountRow}>
              <TextInput
                style={[inputType(type.title3), money, styles.amountInput, { color: colors.text }]}
                placeholder={variable ? t("repeating.lastAmountPlaceholder") : t("add.amount")}
                placeholderTextColor={colors.placeholder}
                value={amount.text}
                onChangeText={amount.onChangeText}
                keyboardType={amount.keyboardType}
                accessibilityLabel={t("add.amount")}
              />
              <Text style={[type.body, { color: colors.textSecondary }]}>{currency.label}</Text>
            </View>
            <Separator />
            {switchRow(t("repeating.variable"), variable, setVariable)}
          </Section>

          <Section title={t("add.sections.repeat")}>
            <SegmentedControl
              style={styles.segmented}
              options={[
                { value: "monthly", label: t("repeating.everyMonth") },
                { value: "yearly", label: t("repeating.everyYear") },
              ]}
              value={frequency}
              onChange={(f) => setFrequency(f as RepeatFrequency)}
            />
            <Separator />
            <DateField label={t("repeating.nextDate")} value={next} onChange={setNext} />
            <Separator />
            {switchRow(t("repeating.ask"), variable ? true : ask, setAsk, variable)}
            {!isNew && (
              <>
                <Separator />
                {switchRow(t("repeating.pause"), paused, setPaused)}
              </>
            )}
          </Section>

          {income ? (
            <Section title={t("add.sections.source")}>
              <View style={styles.chips}>
                <ChipRow
                  accessibilityLabel={t("add.source")}
                  chips={[
                    { key: NONE, label: t("history.without") },
                    ...INCOME_TYPES.map((key) => ({ key, label: t(`incomeTypes.${key}`) })),
                  ]}
                  selectedKey={incomeType ?? NONE}
                  onSelect={(key) => setIncomeType(key === NONE ? undefined : (key as IncomeType))}
                />
              </View>
            </Section>
          ) : (
            <Section title={t("history.sections.category")}>
              <View style={styles.chips}>
                <ChipRow
                  accessibilityLabel={t("history.category")}
                  chips={[
                    { key: NONE, label: t("history.without") },
                    ...categories.map((c) => ({ key: c.id, label: categoryLabel(c, t), color: c.colorHex })),
                  ]}
                  selectedKey={categoryId ?? NONE}
                  onSelect={(key) => { setCategoryId(key === NONE ? undefined : key); setSubId(undefined); }}
                />
              </View>
              {selectedCat && selectedCat.subcategories.length > 0 && (
                <>
                  <Separator />
                  <View style={styles.chips}>
                    <ChipRow
                      accessibilityLabel={t("history.subcategory")}
                      chips={[
                        { key: NONE, label: t("add.withoutSub") },
                        ...selectedCat.subcategories.map((s) => ({ key: s.id, label: categoryLabel(s, t) })),
                      ]}
                      selectedKey={subcategoryId ?? NONE}
                      onSelect={(key) => setSubId(key === NONE ? undefined : key)}
                    />
                  </View>
                </>
              )}
            </Section>
          )}

          {!isNew && (
            <Section footer={t("repeating.deleteBody")}>
              <PressableRow style={styles.centerRow} onPress={handleDelete} accessibilityRole="button">
                <Text style={[type.body, { color: colors.destructive }]}>{t("repeating.delete")}</Text>
              </PressableRow>
            </Section>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex:        { flex: 1 },
  content:     { paddingHorizontal: GUTTER, paddingTop: space[4], gap: SECTION_GAP },
  input:       { paddingHorizontal: space[4], paddingVertical: space[3], minHeight: ROW_MIN },
  amountRow:   { flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[4], minHeight: ROW_MIN + 8 },
  amountInput: { flex: 1, minWidth: 0, paddingVertical: space[2] },
  segmented:   { margin: space[3] },
  switchRow:   { flexDirection: "row", alignItems: "center", gap: space[3], paddingLeft: space[4], paddingRight: space[3], minHeight: ROW_MIN + 8 },
  switchSlot:  { width: 64, height: 40, alignItems: "center", justifyContent: "center" },
  chips:       { paddingTop: space[3] },
  centerRow:   { alignItems: "center", justifyContent: "center", minHeight: ROW_MIN + 4 },
});
