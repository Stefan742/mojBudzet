import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppStore } from "../store/useAppStore";
import { findCategory, findSubcategory } from "../store/selectors";
import { Transaction, TransactionKind, TransactionSource, categoryLabel } from "../models";
import { formatMoney } from "../utils/money";
import { formatDate } from "../utils/dates";
import { useTheme } from "@/hooks/useTheme";
import { useAmountField } from "@/hooks/useAmountField";
import { ModalHeader } from "@/components/ModalHeader";
import { DateField } from "@/components/DateField";
import { ChipRow } from "@/components/ChipRow";
import { CategoryIcon } from "@/components/CategoryIcon";
import { MIN_TOUCH, useTabBarSpace } from "@/constants/layout";

// Stored source values are Macedonian; show them translated (I-4).
const SOURCE_KEY: Record<TransactionSource, string> = {
  "Рачно": "history.source.manual",
  "QR": "history.source.qr",
  "Банка": "history.source.bank",
};

const NONE = "__none__";

export default function HistoryScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomSpace = useTabBarSpace();
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
  const filtered = query
    ? transactions.filter((tx) => {
        const cat = findCategory(categories, tx.categoryId);
        return [rowTitle(tx), tx.note ?? "", cat ? categoryLabel(cat, t) : ""]
          .some((field) => field.toLowerCase().includes(query));
      })
    : transactions;

  const confirmDeleteSavings = (tx: Transaction) =>
    Alert.alert(t("history.delete"), t("history.confirmDeleteSavings"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: () => deleteTransaction(tx.id) },
    ]);

  const renderItem = ({ item: tx, index }: { item: Transaction; index: number }) => {
    const cat = findCategory(categories, tx.categoryId);
    const sub = findSubcategory(categories, tx.categoryId, tx.subcategoryId);
    const isSavings = tx.kind === TransactionKind.SAVINGS;
    const sign = tx.kind === TransactionKind.INCOME ? "+" : "-";
    const amountColor =
      tx.kind === TransactionKind.INCOME ? colors.success : isSavings ? colors.vault : colors.destructive;
    const amountText = `${sign}${formatMoney(tx.amount, currency)}`;
    const dateText = formatDate(tx.date, i18n.language);
    const tags = [cat && categoryLabel(cat, t), sub && categoryLabel(sub, t)].filter(Boolean).join(" · ");

    return (
      <TouchableOpacity
        style={[
          styles.row,
          { backgroundColor: colors.card },
          index === 0 && styles.rowFirst,
          index === filtered.length - 1 && styles.rowLast,
        ]}
        onPress={() => (isSavings ? confirmDeleteSavings(tx) : setEditing(tx))}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={[rowTitle(tx), tags, dateText, amountText].filter(Boolean).join(", ")}
        accessibilityHint={isSavings ? t("a11y.deleteHint") : t("a11y.editHint")}
      >
        <View style={[styles.iconCircle, { backgroundColor: isSavings ? colors.vaultBg : cat ? `${cat.colorHex}33` : colors.inputBg }]}>
          {isSavings ? (
            <Ionicons name="lock-closed" size={18} color={colors.vault} />
          ) : (
            <CategoryIcon iconName={cat?.iconName ?? "receipt-outline"} size={20} color={cat?.colorHex ?? colors.textSecondary} />
          )}
        </View>
        <View style={styles.rowInfo}>
          <Text style={[styles.merchant, { color: colors.text }]} numberOfLines={1}>{rowTitle(tx)}</Text>
          {tags ? <Text style={[styles.tag, { color: colors.textSecondary }]} numberOfLines={1}>{tags}</Text> : null}
          <Text style={[styles.date, { color: colors.textTertiary }]}>{dateText}</Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={[styles.amount, { color: amountColor }]}>{amountText}</Text>
          {!isSavings && (
            <Text style={[styles.source, { color: colors.textTertiary }]}>{t(SOURCE_KEY[tx.source] ?? SOURCE_KEY["Рачно"])}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]} accessibilityRole="header">
          {t("history.title")}
        </Text>
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.card }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={t("history.searchPlaceholder")}
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
          returnKeyType="search"
          accessibilityLabel={t("history.searchPlaceholder")}
        />
      </View>

      {/* The list itself scrolls and is virtualized (P-1). extraData refreshes
          rows when a category or goal is renamed (B-17). */}
      <FlatList
        data={filtered}
        keyExtractor={(tx) => tx.id}
        renderItem={renderItem}
        extraData={[categories, savingsGoals, i18n.language]}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.separator }]} />}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: bottomSpace }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name={query ? "search-outline" : "list-outline"} size={60} color={colors.separator} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {query ? t("history.noResults") : t("history.noItems")}
            </Text>
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
    </View>
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
    if (value === null || !hasMerchant) return;
    onSave({ ...tx, merchant: tx.merchant.trim(), amount: value });
  };

  // Confirm while the sheet is still open, then close: presenting an alert
  // during the sheet's dismissal can drop it on iOS (B-8).
  const handleDelete = () =>
    Alert.alert(t("history.delete"), t("history.confirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: () => onDelete(tx.id) },
    ]);

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
          style={styles.modalScroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          {/* ── BASIC ── */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t("history.sections.basic")}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder={t("history.merchant")}
                placeholderTextColor={colors.textTertiary}
                value={tx.merchant}
                onChangeText={(v) => { setTx({ ...tx, merchant: v }); setMerchantError(false); }}
                returnKeyType="next"
                accessibilityLabel={t("history.merchant")}
              />
              {merchantError && (
                <Text style={[styles.fieldError, { color: colors.destructive }]}>{t("history.merchantRequired")}</Text>
              )}
              <View style={[styles.inputSep, { backgroundColor: colors.separator }]} />
              <View style={styles.editRow}>
                <Text style={[styles.label, { color: colors.text }]}>{t("history.amount")}</Text>
                <TextInput
                  style={[styles.input, { flex: 1, textAlign: "right", color: colors.text }]}
                  value={amount.text}
                  onChangeText={amount.onChangeText}
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  accessibilityLabel={t("history.amount")}
                />
                <Text style={[styles.currency, { color: colors.textSecondary }]}>{currency}</Text>
              </View>
              {amount.errorText && (
                <Text style={[styles.fieldError, { color: colors.destructive }]}>{amount.errorText}</Text>
              )}
              <View style={[styles.inputSep, { backgroundColor: colors.separator }]} />
              <DateField label={t("history.date")} value={date} onChange={handleDateChange} />
              <View style={[styles.inputSep, { backgroundColor: colors.separator }]} />
              <View style={[styles.segmentContainer, { backgroundColor: colors.inputBg }]} accessibilityRole="radiogroup">
                {[
                  { label: t("history.expense"), value: TransactionKind.EXPENSE },
                  { label: t("history.income"),  value: TransactionKind.INCOME  },
                ].map((k) => {
                  const selected = tx.kind === k.value;
                  return (
                    <TouchableOpacity
                      key={k.value}
                      style={[styles.segment, selected && { backgroundColor: colors.accent }]}
                      onPress={() => setTx({ ...tx, kind: k.value })}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.segmentText, { color: selected ? colors.onAccent : colors.textSecondary }]}>
                        {k.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* ── CATEGORY ── */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t("history.sections.category")}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>{t("history.category")}</Text>
              <ChipRow
                accessibilityLabel={t("history.category")}
                chips={[
                  { key: NONE, label: t("history.without") },
                  ...categories.map((c) => ({ key: c.id, label: categoryLabel(c, t), color: c.colorHex })),
                ]}
                selectedKey={tx.categoryId ?? NONE}
                onSelect={(key) =>
                  setTx({ ...tx, categoryId: key === NONE ? undefined : key, subcategoryId: undefined })
                }
              />

              {selectedCat && selectedCat.subcategories.length > 0 && (
                <>
                  <View style={[styles.inputSep, { backgroundColor: colors.separator }]} />
                  <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>{t("history.subcategory")}</Text>
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
            </View>
          </View>

          {/* ── NOTE ── */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t("history.sections.note")}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <TextInput
                style={[styles.input, { minHeight: 60, color: colors.text }]}
                placeholder={t("history.optional")}
                placeholderTextColor={colors.textTertiary}
                value={tx.note}
                onChangeText={(v) => setTx({ ...tx, note: v })}
                multiline
                accessibilityLabel={t("history.sections.note")}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: colors.card }]}
            onPress={handleDelete}
            accessibilityRole="button"
          >
            <Ionicons name="trash" size={18} color={colors.destructive} />
            <Text style={[styles.deleteText, { color: colors.destructive }]}>{t("history.delete")}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  headerTitle: { fontSize: 34, fontWeight: "700", letterSpacing: 0.3 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    margin: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: MIN_TOUCH,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 10 },
  empty: { alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 80 },
  emptyText: { fontSize: 18 },
  row: { flexDirection: "row", alignItems: "center", padding: 14 },
  rowFirst: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  rowLast: { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  rowInfo: { flex: 1, marginLeft: 12 },
  merchant: { fontSize: 16, fontWeight: "600" },
  tag: { fontSize: 12, marginTop: 2 },
  date: { fontSize: 12, marginTop: 2 },
  rowRight: { alignItems: "flex-end", marginLeft: 8 },
  amount: { fontSize: 16, fontWeight: "600" },
  source: { fontSize: 12, marginTop: 2 },
  separator: { height: StyleSheet.hairlineWidth },
  modalScroll: { flex: 1 },
  section: { margin: 16, marginBottom: 0 },
  sectionHeader: { fontSize: 12, fontWeight: "600", marginBottom: 6, paddingHorizontal: 4, letterSpacing: 0.5 },
  card: { borderRadius: 12, overflow: "hidden" },
  input: { paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  inputSep: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  editRow: { flexDirection: "row", alignItems: "center" },
  label: { paddingLeft: 16, fontSize: 16, width: 90 },
  currency: { paddingRight: 16, fontSize: 15 },
  fieldError: { fontSize: 13, paddingHorizontal: 16, paddingBottom: 10, marginTop: -4 },
  segmentContainer: { flexDirection: "row", margin: 10, borderRadius: 8, padding: 3 },
  segment: { flex: 1, minHeight: 36, justifyContent: "center", borderRadius: 6, alignItems: "center" },
  segmentText: { fontSize: 14, fontWeight: "500" },
  pickerLabel: { fontSize: 13, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    minHeight: MIN_TOUCH,
  },
  deleteText: { fontSize: 16, fontWeight: "500" },
});
