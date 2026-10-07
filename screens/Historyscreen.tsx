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
} from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppStore } from "../store/useAppStore";
import { findCategory, findSubcategory, transactionMonth } from "../store/selectors";
import { Transaction, TransactionKind, TransactionSource, categoryLabel } from "../models";
import { formatMoney } from "../utils/money";
import { formatDate, formatMonthWide, monthStart } from "../utils/dates";
import { haptics } from "../utils/haptics";
import { useTheme } from "@/hooks/useTheme";
import { useAmountField } from "@/hooks/useAmountField";
import { ModalHeader } from "@/components/ModalHeader";
import { DateField } from "@/components/DateField";
import { ChipRow } from "@/components/ChipRow";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Icon } from "@/components/Icon";
import { PressableRow } from "@/components/ui/Pressables";
import { Section, Separator } from "@/components/ui/Section";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
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
  const currency = t("common.currency");

  const transactions      = useAppStore((s) => s.transactions);
  const categories        = useAppStore((s) => s.categories);
  const savingsGoals      = useAppStore((s) => s.savingsGoals);
  const deleteTransaction = useAppStore((s) => s.deleteTransaction);
  const updateTransaction = useAppStore((s) => s.updateTransaction);

  const [search, setSearch]   = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);

  const rowTitle = (tx: Transaction) => {
    if (tx.kind !== TransactionKind.SAVINGS) return tx.merchant;
    const goal = savingsGoals.find((g) => g.id === tx.goalId);
    return goal ? t("history.savedToGoal", { name: goal.name }) : t("history.savedToVault");
  };

  const query = search.trim().toLowerCase();

  // Newest first, grouped by month, filtered by the search field.
  const sections = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
    const matches = query
      ? sorted.filter((tx) => {
          const cat = findCategory(categories, tx.categoryId);
          return [rowTitle(tx), tx.note ?? "", cat ? categoryLabel(cat, t) : ""].some((f) => f.toLowerCase().includes(query));
        })
      : sorted;
    const byMonth = new Map<string, Transaction[]>();
    for (const tx of matches) {
      const key = transactionMonth(tx);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(tx);
    }
    return [...byMonth.entries()].map(([key, data]) => ({
      key,
      title: formatMonthWide(monthStart(key), i18n.language),
      data,
    }));
    // rowTitle and t depend on goals and language, both listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, categories, savingsGoals, query, i18n.language]);

  const confirmDeleteSavings = (tx: Transaction) => {
    haptics.warning();
    Alert.alert(t("history.delete"), t("history.confirmDeleteSavings"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: () => deleteTransaction(tx.id) },
    ]);
  };

  const renderItem = ({ item: tx, index, section }: { item: Transaction; index: number; section: { data: Transaction[] } }) => {
    const cat = findCategory(categories, tx.categoryId);
    const sub = findSubcategory(categories, tx.categoryId, tx.subcategoryId);
    const isSavings = tx.kind === TransactionKind.SAVINGS;
    const isIncome = tx.kind === TransactionKind.INCOME;
    const amountText = `${isIncome ? "+" : "−"}${formatMoney(tx.amount, currency)}`;
    const dateText = formatDate(tx.date, i18n.language);
    const tags = [cat && categoryLabel(cat, t), sub && categoryLabel(sub, t)].filter(Boolean).join(" · ");
    const catColor = cat ? dataColor(cat.colorHex, isDark) : colors.textSecondary;
    const first = index === 0;
    const last = index === section.data.length - 1;

    return (
      <View style={[styles.rowWrap, { backgroundColor: colors.card }, first && styles.rowFirst, last && styles.rowLast]}>
        <PressableRow
          style={styles.row}
          onPress={() => (isSavings ? confirmDeleteSavings(tx) : setEditing(tx))}
          accessibilityRole="button"
          accessibilityLabel={[rowTitle(tx), tags, dateText, amountText].filter(Boolean).join(", ")}
          accessibilityHint={isSavings ? t("a11y.deleteHint") : t("a11y.editHint")}
        >
          <View style={[styles.tile, { backgroundColor: isSavings ? colors.vaultBg : cat ? tint(catColor, "soft") : colors.fill }]}>
            {isSavings ? (
              <Icon name="vault" size={16} color={colors.vault} />
            ) : (
              <CategoryIcon iconName={cat?.iconName ?? "receipt-outline"} size={18} color={catColor} />
            )}
          </View>
          <View style={styles.rowText}>
            <Text style={[type.body, { color: colors.text }]} numberOfLines={1}>{rowTitle(tx)}</Text>
            <Text style={[type.footnote, { color: colors.textSecondary }]} numberOfLines={1}>
              {[tags, dateText].filter(Boolean).join(" · ")}
            </Text>
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
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name={query ? "search" : "list"} size={48} color={colors.placeholder} />
            <Text style={[type.title3, { color: colors.text }]}>{query ? t("history.noResults") : t("history.noItems")}</Text>
          </View>
        }
      />

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
  const currency = t("common.currency");

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
                keyboardType="number-pad"
                accessibilityLabel={t("history.amount")}
              />
              <Text style={[type.body, { color: colors.textSecondary }]}>{currency}</Text>
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
  listContent:   { paddingHorizontal: GUTTER, paddingBottom: space[8], flexGrow: 1 },
  sectionHeader: { paddingHorizontal: space[4], paddingTop: SECTION_GAP, paddingBottom: space[2] },
  rowWrap:       { overflow: "hidden" },
  rowFirst:      { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderCurve: "continuous" },
  rowLast:       { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, borderCurve: "continuous" },
  row:           { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[2] + 2, minHeight: ROW_MIN + 16 },
  tile:          { width: TILE, height: TILE, alignItems: "center", justifyContent: "center", ...corners(radius.sm) },
  rowText:       { flex: 1, gap: 2 },
  rowRight:      { alignItems: "flex-end", gap: 2 },
  empty:         { alignItems: "center", justifyContent: "center", gap: space[3], paddingTop: space[10] * 2 },
  editorContent: { paddingHorizontal: GUTTER, paddingTop: space[4], gap: SECTION_GAP },
  input:         { paddingHorizontal: space[4], paddingVertical: space[3], minHeight: ROW_MIN },
  note:          { minHeight: 88, textAlignVertical: "top" },
  editRow:       { flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[4], minHeight: ROW_MIN + 4 },
  amountInput:   { flex: 1, textAlign: "right", paddingVertical: space[3] },
  segmented:     { margin: space[3] },
  pickerLabel:   { paddingHorizontal: space[4], paddingTop: space[3], paddingBottom: space[1] },
  deleteRow:     { alignItems: "center", justifyContent: "center", minHeight: ROW_MIN + 4 },
});
