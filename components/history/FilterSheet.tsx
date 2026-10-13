import React, { useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { INCOME_TYPES, IncomeType, Transaction, categoryLabel, dateKey, dayFromKey } from "../../models";
import { useAppStore } from "../../store/useAppStore";
import {
  HistoryFilter,
  KindFilter,
  NO_FILTER,
  PeriodFilter,
  UNCATEGORIZED,
  filterTransactions,
} from "../../services/historyFilter";
import { formatAmount, validateAmount } from "../../utils/money";
import { monthKey } from "../../utils/dates";
import { haptics } from "../../utils/haptics";
import { useTheme } from "@/hooks/useTheme";
import { amountKeyboard, useCurrency } from "@/hooks/useCurrency";
import { ModalHeader } from "@/components/ModalHeader";
import { ChipRow } from "@/components/ChipRow";
import { DateField } from "@/components/DateField";
import { PressableRow } from "@/components/ui/Pressables";
import { Section, Separator } from "@/components/ui/Section";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { GUTTER, ROW_MIN, SECTION_GAP, inputType, money, space, type } from "@/constants/design";
import { KIND_KEYS, PERIOD_KEYS } from "./filterText";

const ANY = "__any__";
const PERIODS: PeriodFilter[] = ["all", "thisMonth", "lastMonth", "last3Months", "thisYear", "custom"];

/**
 * Page sheet with the History filters. Changes are a draft until "Show N",
 * which also tells how many transactions the draft finds.
 */
export function FilterSheet({
  filter,
  transactions,
  today,
  onApply,
  onClose,
}: {
  filter: HistoryFilter;
  /** What the search field already narrowed down, so the count is honest. */
  transactions: Transaction[];
  today: Date;
  onApply: (f: HistoryFilter) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const currency = useCurrency();
  const categories = useAppStore((s) => s.categories);

  const [draft, setDraft] = useState<HistoryFilter>(filter);
  // Amounts are typed as text and read on the fly; an unreadable one is ignored.
  const [minText, setMinText] = useState(filter.minAmount !== undefined ? formatAmount(filter.minAmount, currency, { trimZeroCents: true }) : "");
  const [maxText, setMaxText] = useState(filter.maxAmount !== undefined ? formatAmount(filter.maxAmount, currency, { trimZeroCents: true }) : "");

  const readAmount = (text: string) => {
    if (!text.trim()) return undefined;
    const r = validateAmount(text, currency, { allowZero: true });
    return "amount" in r ? r.amount : undefined;
  };
  const applied: HistoryFilter = { ...draft, minAmount: readAmount(minText), maxAmount: readAmount(maxText) };
  const badMin = minText.trim() !== "" && applied.minAmount === undefined;
  const badMax = maxText.trim() !== "" && applied.maxAmount === undefined;

  const categoryIds = useMemo(() => new Set(categories.map((c) => c.id)), [categories]);
  const count = filterTransactions(transactions, applied, { categoryIds, today }).length;

  const update = (patch: Partial<HistoryFilter>) => setDraft((d) => ({ ...d, ...patch }));

  const setKind = (kind: KindFilter) =>
    // Categories belong to expenses, sources to income: drop what no longer applies.
    update({
      kind,
      ...(kind === "income" || kind === "savings" ? { categoryId: undefined, subcategoryId: undefined } : {}),
      ...(kind !== "income" ? { incomeType: undefined } : {}),
    });

  const setPeriod = (period: PeriodFilter) =>
    update(
      period === "custom"
        ? { period, from: draft.from ?? `${monthKey(today)}-01`, to: draft.to ?? dateKey(today) }
        : { period, from: undefined, to: undefined }
    );

  const reset = () => {
    haptics.selection();
    setDraft(NO_FILTER);
    setMinText("");
    setMaxText("");
  };

  const selectedCat = categories.find((c) => c.id === draft.categoryId);

  const amountRow = (label: string, text: string, onChange: (v: string) => void, bad: boolean) => (
    <View style={styles.amountRow}>
      <Text style={[type.body, styles.flex, { color: colors.text }]}>{label}</Text>
      <TextInput
        style={[inputType(type.body), money, styles.amountInput, { color: bad ? colors.destructive : colors.text }]}
        value={text}
        onChangeText={onChange}
        placeholder="0"
        placeholderTextColor={colors.placeholder}
        keyboardType={amountKeyboard(currency)}
        accessibilityLabel={label}
      />
      <Text style={[type.body, { color: colors.textSecondary }]}>{currency.label}</Text>
    </View>
  );

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]} behavior="padding">
        <ModalHeader
          title={t("historyFilter.title")}
          cancelLabel={t("common.cancel")}
          saveLabel={t("historyFilter.done")}
          onCancel={onClose}
          onSave={() => onApply(applied)}
        />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[10] }]}
        >
          <Section title={t("historyFilter.type")}>
            <SegmentedControl
              style={styles.segmented}
              options={(Object.keys(KIND_KEYS) as KindFilter[]).map((k) => ({ value: k, label: t(KIND_KEYS[k]) }))}
              value={draft.kind}
              onChange={(k) => setKind(k as KindFilter)}
            />
          </Section>

          {draft.kind === "income" ? (
            <Section title={t("historyFilter.source")}>
              <View style={styles.chips}>
                <ChipRow
                  accessibilityLabel={t("historyFilter.source")}
                  chips={[
                    { key: ANY, label: t("historyFilter.any") },
                    ...INCOME_TYPES.map((key) => ({ key, label: t(`incomeTypes.${key}`) })),
                  ]}
                  selectedKey={draft.incomeType ?? ANY}
                  onSelect={(key) => update({ incomeType: key === ANY ? undefined : (key as IncomeType) })}
                />
              </View>
            </Section>
          ) : draft.kind !== "savings" ? (
            <Section title={t("historyFilter.category")}>
              <View style={styles.chips}>
                <ChipRow
                  accessibilityLabel={t("historyFilter.category")}
                  chips={[
                    { key: ANY, label: t("historyFilter.any") },
                    ...categories.map((c) => ({ key: c.id, label: categoryLabel(c, t), color: c.colorHex })),
                    { key: UNCATEGORIZED, label: t("overview.uncategorized") },
                  ]}
                  selectedKey={draft.categoryId ?? ANY}
                  onSelect={(key) => update({ categoryId: key === ANY ? undefined : key, subcategoryId: undefined })}
                />
              </View>
              {selectedCat && selectedCat.subcategories.length > 0 && (
                <>
                  <Separator />
                  <View style={styles.chips}>
                    <ChipRow
                      accessibilityLabel={t("history.subcategory")}
                      chips={[
                        { key: ANY, label: t("historyFilter.any") },
                        ...selectedCat.subcategories.map((s) => ({ key: s.id, label: categoryLabel(s, t) })),
                      ]}
                      selectedKey={draft.subcategoryId ?? ANY}
                      onSelect={(key) => update({ subcategoryId: key === ANY ? undefined : key })}
                    />
                  </View>
                </>
              )}
            </Section>
          ) : null}

          <Section title={t("historyFilter.period")}>
            <View style={styles.chips}>
              <ChipRow
                accessibilityLabel={t("historyFilter.period")}
                chips={PERIODS.map((p) => ({ key: p, label: t(PERIOD_KEYS[p]) }))}
                selectedKey={draft.period}
                onSelect={(p) => setPeriod(p as PeriodFilter)}
              />
            </View>
            {draft.period === "custom" && (
              <>
                <Separator />
                <DateField
                  label={t("historyFilter.from")}
                  value={dayFromKey(draft.from ?? dateKey(today))}
                  onChange={(d) => update({ from: dateKey(d) })}
                />
                <Separator />
                <DateField
                  label={t("historyFilter.to")}
                  value={dayFromKey(draft.to ?? dateKey(today))}
                  onChange={(d) => update({ to: dateKey(d) })}
                />
              </>
            )}
          </Section>

          <Section
            title={t("historyFilter.amount")}
            footer={badMin || badMax ? t("historyFilter.amountInvalid") : null}
            footerColor={colors.destructive}
          >
            {amountRow(t("historyFilter.min"), minText, setMinText, badMin)}
            <Separator />
            {amountRow(t("historyFilter.max"), maxText, setMaxText, badMax)}
          </Section>

          <Section>
            <PressableRow style={styles.centerRow} onPress={reset} accessibilityRole="button">
              <Text style={[type.body, { color: colors.accent }]}>{t("historyFilter.reset")}</Text>
            </PressableRow>
          </Section>

          <Text style={[type.footnote, styles.count, { color: colors.textSecondary }]} accessibilityLiveRegion="polite">
            {t("historyFilter.matches", { count })}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex:        { flex: 1 },
  content:     { paddingHorizontal: GUTTER, paddingTop: space[4], gap: SECTION_GAP },
  segmented:   { margin: space[3] },
  chips:       { paddingTop: space[3] },
  amountRow:   { flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[4], minHeight: ROW_MIN + 4 },
  amountInput: { minWidth: 100, textAlign: "right", paddingVertical: space[3] },
  centerRow:   { alignItems: "center", justifyContent: "center", minHeight: ROW_MIN + 4 },
  count:       { textAlign: "center" },
});
