import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  SectionList,
  TextInput,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Pressable,
} from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppStore } from "../store/useAppStore";
import { findCategory, findSubcategory, transactionMonth } from "../store/selectors";
import { INCOME_TYPES, Transaction, TransactionKind, TransactionSource, categoryLabel, dateKey, dayFromKey, isIncomeType } from "../models";
import { HistoryFilter, NO_FILTER, activeFilterCount, filterTransactions, totalsOf } from "../services/historyFilter";
import { formatMoney } from "../utils/money";
import { formatDate, formatMonthWide, monthStart } from "../utils/dates";
import { haptics } from "../utils/haptics";
import { useTheme } from "@/hooks/useTheme";
import { amountKeyboard, useCurrency } from "@/hooks/useCurrency";
import { useAmountField } from "@/hooks/useAmountField";
import { ModalHeader } from "@/components/ModalHeader";
import { DateField } from "@/components/DateField";
import { ChipRow } from "@/components/ChipRow";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Icon } from "@/components/Icon";
import { PressableRow } from "@/components/ui/Pressables";
import { Section, Separator } from "@/components/ui/Section";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { FilterSheet } from "@/components/history/FilterSheet";
import {
  KIND_KEYS,
  activeFilterChips,
  amountFilterLabel,
  categoryFilterLabel,
  periodFilterLabel,
} from "@/components/history/filterText";
import { dataColor } from "@/constants/palette";
import { GUTTER, ROW_MIN, SECTION_GAP, corners, inputType, money, radius, space, tint, type } from "@/constants/design";

// Stored source values are Macedonian; show them translated (I-4).
const SOURCE_KEY: Record<TransactionSource, string> = {
  "Рачно": "history.source.manual",
  "QR": "history.source.qr",
  "Банка": "history.source.bank",
};

const NONE = "__none__";
const TILE = 36;

export default function HistoryScreen() {
  const { t, i18n } = useTranslation();
  const { colors, isDark } = useTheme();
  const currency = useCurrency();

  const transactions      = useAppStore((s) => s.transactions);
  const categories        = useAppStore((s) => s.categories);
  const savingsGoals      = useAppStore((s) => s.savingsGoals);
  const deleteTransaction = useAppStore((s) => s.deleteTransaction);
  const updateTransaction = useAppStore((s) => s.updateTransaction);

  const [search, setSearch]   = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [filter, setFilter]   = useState<HistoryFilter>(NO_FILTER);
  const [filtering, setFiltering] = useState(false);
  // Through a selector so it is fresh on every render (React Compiler caches plain values).
  const todayKey = useAppStore(() => dateKey(new Date()));
  const today = dayFromKey(todayKey);

  const rowTitle = (tx: Transaction) => {
    // An unnamed repeating income (the salary) is called by its source.
    if (tx.kind !== TransactionKind.SAVINGS) return tx.merchant || (isIncomeType(tx.incomeType) ? t(`incomeTypes.${tx.incomeType}`) : "");
    const goal = savingsGoals.find((g) => g.id === tx.goalId);
    return goal ? t("history.savedToGoal", { name: goal.name }) : t("history.savedToVault");
  };

  const query = search.trim().toLowerCase();

  // Income shows its source; everything else its category and subcategory.
  const tagsOf = (tx: Transaction) => {
    if (tx.kind === TransactionKind.INCOME) return isIncomeType(tx.incomeType) ? t(`incomeTypes.${tx.incomeType}`) : "";
    const cat = findCategory(categories, tx.categoryId);
    const sub = findSubcategory(categories, tx.categoryId, tx.subcategoryId);
    return [cat && categoryLabel(cat, t), sub && categoryLabel(sub, t)].filter(Boolean).join(" · ");
  };

  // Newest first, narrowed by the search field...
  const searched = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
    return query
      ? sorted.filter((tx) => [rowTitle(tx), tx.note ?? "", tagsOf(tx)].some((f) => f.toLowerCase().includes(query)))
      : sorted;
    // rowTitle and t depend on goals and language, both listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, categories, savingsGoals, query, i18n.language]);

  // ...then by the filters, and grouped by month.
  const categoryIds = useMemo(() => new Set(categories.map((c) => c.id)), [categories]);
  const shown = useMemo(
    () => filterTransactions(searched, filter, { categoryIds, today }),
    // today is rebuilt every render; the day it stands for is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searched, filter, categoryIds, todayKey]
  );
  const filterCount = activeFilterCount(filter);
  const narrowed = filterCount > 0 || query.length > 0;

  const sections = useMemo(() => {
    const byMonth = new Map<string, Transaction[]>();
    for (const tx of shown) {
      const key = transactionMonth(tx);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(tx);
    }
    return [...byMonth.entries()].map(([key, data]) => ({
      key,
      title: formatMonthWide(monthStart(key), i18n.language),
      data,
    }));
  }, [shown, i18n.language]);

  // What is being looked at, in words, and the active filters as removable chips.
  const labels = {
    kind: filter.kind !== "all" ? t(KIND_KEYS[filter.kind]) : undefined,
    category: categoryFilterLabel(filter, categories, t),
    period: periodFilterLabel(filter, today, i18n.language, t),
    amount: amountFilterLabel(filter, currency, t),
  };
  const chips = activeFilterChips(filter, labels);
  const totals = totalsOf(shown);
  const summaryTitle =
    [labels.category ?? labels.kind, labels.period].filter(Boolean).join(" · ") ||
    (query ? t("historyFilter.searchTitle", { query: search.trim() }) : t("historyFilter.results"));

  const confirmDeleteSavings = (tx: Transaction) => {
    haptics.warning();
    Alert.alert(t("history.delete"), t("history.confirmDeleteSavings"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: () => deleteTransaction(tx.id) },
    ]);
  };

  const renderItem = ({ item: tx, index, section }: { item: Transaction; index: number; section: { data: Transaction[] } }) => {
    const isSavings = tx.kind === TransactionKind.SAVINGS;
    const isIncome = tx.kind === TransactionKind.INCOME;
    const cat = isIncome ? undefined : findCategory(categories, tx.categoryId);
    const amountText = `${isIncome ? "+" : "−"}${formatMoney(tx.amount, currency)}`;
    const dateText = formatDate(tx.date, i18n.language);
    const tags = tagsOf(tx);
    const catColor = cat ? dataColor(cat.colorHex, isDark) : colors.textSecondary;
    const first = index === 0;
    const last = index === section.data.length - 1;

    return (
      <View style={[styles.rowWrap, { backgroundColor: colors.card }, first && styles.rowFirst, last && styles.rowLast]}>
        <PressableRow
          style={styles.row}
          onPress={() => (isSavings ? confirmDeleteSavings(tx) : setEditing(tx))}
          accessibilityRole="button"
          accessibilityLabel={[rowTitle(tx), tags, dateText, amountText, tx.recurringId && t("repeating.title")].filter(Boolean).join(", ")}
          accessibilityHint={isSavings ? t("a11y.deleteHint") : t("a11y.editHint")}
        >
          <View style={[styles.tile, { backgroundColor: isSavings ? colors.vaultBg : isIncome ? colors.successBg : cat ? tint(catColor, "soft") : colors.fill }]}>
            {isSavings ? (
              <Icon name="vault" size={16} color={colors.vault} />
            ) : isIncome ? (
              <Icon name="income" size={16} color={colors.success} />
            ) : (
              <CategoryIcon iconName={cat?.iconName ?? "receipt-outline"} size={18} color={catColor} />
            )}
          </View>
          <View style={styles.rowText}>
            <Text style={[type.body, { color: colors.text }]} numberOfLines={1}>{rowTitle(tx)}</Text>
            <View style={styles.subRow}>
              {tx.recurringId && (
                <Icon name="repeat" size={11} color={colors.textSecondary} />
              )}
              <Text style={[type.footnote, styles.subText, { color: colors.textSecondary }]} numberOfLines={1}>
                {[tags, dateText].filter(Boolean).join(" · ")}
              </Text>
            </View>
          </View>
          <View style={styles.rowRight}>
            <Text style={[type.headline, money, { color: isIncome ? colors.success : isSavings ? colors.vault : colors.text }]}>
              {amountText}
            </Text>
            {!isSavings && (
              <Text style={[type.caption, { color: colors.textTertiary }]}>{t(SOURCE_KEY[tx.source] ?? SOURCE_KEY["Рачно"])}</Text>
            )}
          </View>
        </PressableRow>
        {!last && <Separator inset={space[4] + TILE + space[3]} />}
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          // The system search field in the navigation bar (DESIGN.md §4.2).
          headerRight: () => (
            <Pressable
              onPress={() => setFiltering(true)}
              hitSlop={8}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel={
                filterCount ? t("historyFilter.buttonActive", { count: filterCount }) : t("historyFilter.title")
              }
            >
              <Icon name={filterCount ? "filterActive" : "filter"} size={22} color={colors.accent} />
            </Pressable>
          ),
          headerSearchBarOptions: {
            placeholder: t("history.searchPlaceholder"),
            onChangeText: (e) => setSearch(e.nativeEvent.text),
            onCancelButtonPress: () => setSearch(""),
            autoCapitalize: "none",
            hideWhenScrolling: false,
          },
        }}
      />
      {/* The list itself scrolls and is virtualized (P-1). extraData refreshes
          rows when a category or goal is renamed (B-17). */}
      <SectionList
        sections={sections}
        keyExtractor={(tx) => tx.id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <Text style={[type.sectionHeader, styles.sectionHeader, { color: colors.textSecondary }]} accessibilityRole="header">
            {section.title}
          </Text>
        )}
        SectionSeparatorComponent={() => <View style={{ height: space[2] }} />}
        stickySectionHeadersEnabled={false}
        extraData={[categories, savingsGoals, i18n.language]}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.listContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          narrowed ? (
            <View style={styles.listHeader}>
              {chips.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {chips.map((chip) => (
                    <Pressable
                      key={chip.part}
                      onPress={() => { haptics.selection(); setFilter(chip.without); }}
                      style={[styles.chip, { backgroundColor: tint(colors.accent, "subtle") }]}
                      accessibilityRole="button"
                      accessibilityLabel={t("historyFilter.remove", { name: chip.label })}
                    >
                      <Text style={[type.subheadline, { color: colors.accent }]} numberOfLines={1}>{chip.label}</Text>
                      <Icon name="close" size={12} color={colors.accent} />
                    </Pressable>
                  ))}
                </ScrollView>
              )}
              {/* "Food and drinks · September 2026: 8 transactions, spent 12.400 MKD." */}
              {shown.length > 0 && (
                <View style={[styles.summary, { backgroundColor: colors.card }]} accessible>
                  <Text style={[type.headline, { color: colors.text }]} numberOfLines={2}>{summaryTitle}</Text>
                  <Text style={[type.footnote, { color: colors.textSecondary }]}>
                    {t("historyFilter.count", { count: totals.count })}
                  </Text>
                  <View style={styles.totals}>
                    {[
                      { key: "expenses", icon: "expense" as const, color: colors.destructive, value: totals.expenses, label: t("historyFilter.spent") },
                      { key: "income", icon: "income" as const, color: colors.success, value: totals.income, label: t("historyFilter.received") },
                      { key: "savings", icon: "vault" as const, color: colors.vault, value: totals.savings, label: t("historyFilter.saved") },
                    ]
                      .filter((item) => item.value > 0)
                      .map((item) => (
                        <View key={item.key} style={styles.total} accessible accessibilityLabel={`${item.label} ${formatMoney(item.value, currency)}`}>
                          <Icon name={item.icon} size={14} color={item.color} />
                          <Text style={[type.subheadline, money, { color: colors.text }]}>{formatMoney(item.value, currency)}</Text>
                        </View>
                      ))}
                  </View>
                </View>
              )}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name={narrowed ? "search" : "list"} size={48} color={colors.placeholder} />
            <Text style={[type.title3, { color: colors.text }]}>
              {filterCount ? t("historyFilter.noMatch") : query ? t("history.noResults") : t("history.noItems")}
            </Text>
            {filterCount > 0 && (
              <Pressable onPress={() => setFilter(NO_FILTER)} hitSlop={8} accessibilityRole="button">
                <Text style={[type.body, { color: colors.accent }]}>{t("historyFilter.reset")}</Text>
              </Pressable>
            )}
          </View>
        }
      />

      {filtering && (
        <FilterSheet
          filter={filter}
          transactions={searched}
          today={today}
          onApply={(f) => { haptics.selection(); setFilter(f); setFiltering(false); }}
          onClose={() => setFiltering(false)}
        />
      )}

      {editing && (
        <TransactionEditorModal
          transaction={editing}
          onClose={() => setEditing(null)}
          onSave={(tx) => { updateTransaction(tx); setEditing(null); }}
          onDelete={(id) => { deleteTransaction(id); setEditing(null); }}
        />
      )}
    </>
  );
}

// ─── Editor Modal ──────────────────────────────────────────────────────────────
interface EditorProps {
  transaction: Transaction;
  onClose: () => void;
  onSave: (t: Transaction) => void;
  onDelete: (id: string) => void;
}

function TransactionEditorModal({ transaction, onClose, onSave, onDelete }: EditorProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const categories = useAppStore((s) => s.categories);
  const currency = useCurrency();

  const [tx, setTx] = useState<Transaction>(transaction);
  const [merchantError, setMerchantError] = useState(false);
  const amount = useAmountField(transaction.amount);
  const selectedCat = findCategory(categories, tx.categoryId);
  const date = useMemo(() => new Date(tx.date), [tx.date]);

  const handleSave = () => {
    const value = amount.parse();
    const hasMerchant = tx.merchant.trim().length > 0;
    setMerchantError(!hasMerchant);
    if (value === null || !hasMerchant) {
      haptics.error();
      return;
    }
    haptics.success();
    onSave({ ...tx, merchant: tx.merchant.trim(), amount: value });
  };

  // Confirm while the sheet is still open, then close: presenting an alert
  // during the sheet's dismissal can drop it on iOS (B-8).
  const handleDelete = () => {
    haptics.warning();
    Alert.alert(t("history.delete"), t("history.confirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: () => onDelete(tx.id) },
    ]);
  };

  const handleDateChange = (picked: Date) => {
    // Keep the original time of day; only the day changes.
    const next = new Date(date);
    next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
    setTx({ ...tx, date: next.toISOString() });
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior="padding">
        <ModalHeader
          title={t("history.edit")}
          cancelLabel={t("history.cancel")}
          saveLabel={t("history.save")}
          onCancel={onClose}
          onSave={handleSave}
        />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={[styles.editorContent, { paddingBottom: insets.bottom + space[6] }]}
        >
          <Section
            title={t("history.sections.basic")}
            footer={merchantError ? t("history.merchantRequired") : amount.errorText}
            footerColor={colors.destructive}
          >
            <TextInput
              style={[inputType(type.body), styles.input, { color: colors.text }]}
              placeholder={t("history.merchant")}
              placeholderTextColor={colors.placeholder}
              value={tx.merchant}
              onChangeText={(v) => { setTx({ ...tx, merchant: v }); setMerchantError(false); }}
              returnKeyType="next"
              accessibilityLabel={t("history.merchant")}
            />
            <Separator />
            <View style={styles.editRow}>
              <Text style={[type.body, { color: colors.text }]}>{t("history.amount")}</Text>
              <TextInput
                style={[inputType(type.body), money, styles.amountInput, { color: colors.text }]}
                value={amount.text}
                onChangeText={amount.onChangeText}
                placeholder="0"
                placeholderTextColor={colors.placeholder}
                keyboardType={amountKeyboard(currency)}
                accessibilityLabel={t("history.amount")}
              />
              <Text style={[type.body, { color: colors.textSecondary }]}>{currency.label}</Text>
            </View>
            <Separator />
            <DateField label={t("history.date")} value={date} onChange={handleDateChange} />
            <Separator />
            <SegmentedControl
              style={styles.segmented}
              options={[
                { value: TransactionKind.EXPENSE, label: t("history.expense") },
                { value: TransactionKind.INCOME, label: t("history.income") },
              ]}
              value={tx.kind}
              onChange={(kind) => setTx({ ...tx, kind })}
            />
          </Section>

          {tx.kind === TransactionKind.INCOME ? (
            <Section title={t("history.sections.source")}>
              <View style={styles.sourceChips}>
                <ChipRow
                  accessibilityLabel={t("add.source")}
                  chips={[
                    { key: NONE, label: t("history.without") },
                    ...INCOME_TYPES.map((key) => ({ key, label: t(`incomeTypes.${key}`) })),
                  ]}
                  selectedKey={isIncomeType(tx.incomeType) ? tx.incomeType : NONE}
                  onSelect={(key) => setTx({ ...tx, incomeType: isIncomeType(key) ? key : undefined })}
                />
              </View>
            </Section>
          ) : (
            <Section title={t("history.sections.category")}>
              <Text style={[type.footnote, styles.pickerLabel, { color: colors.textSecondary }]}>{t("history.category")}</Text>
              <ChipRow
                accessibilityLabel={t("history.category")}
                chips={[
                  { key: NONE, label: t("history.without") },
                  ...categories.map((c) => ({ key: c.id, label: categoryLabel(c, t), color: c.colorHex })),
                ]}
                selectedKey={tx.categoryId ?? NONE}
                onSelect={(key) => setTx({ ...tx, categoryId: key === NONE ? undefined : key, subcategoryId: undefined })}
              />
              {selectedCat && selectedCat.subcategories.length > 0 && (
                <>
                  <Separator />
                  <Text style={[type.footnote, styles.pickerLabel, { color: colors.textSecondary }]}>{t("history.subcategory")}</Text>
                  <ChipRow
                    accessibilityLabel={t("history.subcategory")}
                    chips={[
                      { key: NONE, label: t("history.without") },
                      ...selectedCat.subcategories.map((s) => ({ key: s.id, label: categoryLabel(s, t) })),
                    ]}
                    selectedKey={tx.subcategoryId ?? NONE}
                    onSelect={(key) => setTx({ ...tx, subcategoryId: key === NONE ? undefined : key })}
                  />
                </>
              )}
            </Section>
          )}

          <Section title={t("history.sections.note")}>
            <TextInput
              style={[inputType(type.body), styles.input, styles.note, { color: colors.text }]}
              placeholder={t("history.optional")}
              placeholderTextColor={colors.placeholder}
              value={tx.note}
              onChangeText={(v) => setTx({ ...tx, note: v })}
              multiline
              accessibilityLabel={t("history.sections.note")}
            />
          </Section>

          <Section>
            <PressableRow style={styles.deleteRow} onPress={handleDelete} accessibilityRole="button">
              <Text style={[type.body, { color: colors.destructive }]}>{t("history.delete")}</Text>
            </PressableRow>
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerButton:  { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  listHeader:    { gap: space[3], paddingTop: space[2] },
  chipRow:       { gap: space[2] },
  chip:          { flexDirection: "row", alignItems: "center", gap: space[1] + 2, paddingHorizontal: space[3], minHeight: 32, ...corners(radius.pill) },
  summary:       { padding: space[4], gap: space[1], ...corners(radius.lg) },
  totals:        { flexDirection: "row", flexWrap: "wrap", columnGap: space[4], rowGap: space[1], marginTop: space[1] },
  total:         { flexDirection: "row", alignItems: "center", gap: space[1] + 2 },
  listContent:   { paddingHorizontal: GUTTER, paddingBottom: space[8], flexGrow: 1 },
  sectionHeader: { paddingHorizontal: space[4], paddingTop: SECTION_GAP, paddingBottom: space[2] },
  rowWrap:       { overflow: "hidden" },
  rowFirst:      { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderCurve: "continuous" },
  rowLast:       { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, borderCurve: "continuous" },
  row:           { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[2] + 2, minHeight: ROW_MIN + 16 },
  tile:          { width: TILE, height: TILE, alignItems: "center", justifyContent: "center", ...corners(radius.sm) },
  rowText:       { flex: 1, gap: 2 },
  subRow:        { flexDirection: "row", alignItems: "center", gap: 4 },
  subText:       { flexShrink: 1 },
  rowRight:      { alignItems: "flex-end", gap: 2 },
  empty:         { alignItems: "center", justifyContent: "center", gap: space[3], paddingTop: space[10] * 2 },
  editorContent: { paddingHorizontal: GUTTER, paddingTop: space[4], gap: SECTION_GAP },
  input:         { paddingHorizontal: space[4], paddingVertical: space[3], minHeight: ROW_MIN },
  note:          { minHeight: 88, textAlignVertical: "top" },
  editRow:       { flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[4], minHeight: ROW_MIN + 4 },
  amountInput:   { flex: 1, minWidth: 0, textAlign: "right", paddingVertical: space[3] },
  segmented:     { margin: space[3] },
  pickerLabel:   { paddingHorizontal: space[4], paddingTop: space[3], paddingBottom: space[1] },
  sourceChips:   { paddingTop: space[2] },
  deleteRow:     { alignItems: "center", justifyContent: "center", minHeight: ROW_MIN + 4 },
});
