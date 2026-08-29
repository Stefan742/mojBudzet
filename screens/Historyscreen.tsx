import React, { useState } from "react";
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
  Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/useAppStore";
import { formatAmount, formatDate } from "../utils/helpers";
import { Transaction, TransactionKind } from "../models";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";

export default function HistoryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const transactions = useAppStore((s) => s.transactions);
  const deleteTransaction = useAppStore((s) => s.deleteTransaction);
  const updateTransaction = useAppStore((s) => s.updateTransaction);
  const category = useAppStore((s) => s.category);
  const subcategory = useAppStore((s) => s.subcategory);
  const currency = useAppStore((s) => s.currency);

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);

  const insets = useSafeAreaInsets();

  const filtered = search.trim()
    ? transactions.filter(
        (t) =>
          t.merchant.toLowerCase().includes(search.toLowerCase()) ||
          t.note?.toLowerCase().includes(search.toLowerCase())
      )
    : transactions;

  const handleDelete = (id: string) => {
    Alert.alert(t("history.delete"), t("history.confirm"), [
      { text: t("history.cancel"), style: "cancel" },
      {
        text: t("history.delete"),
        style: "destructive",
        onPress: () => deleteTransaction(id),
      },
    ]);
  };

  const renderItem = ({ item: tx }: { item: Transaction }) => {
    const cat = category(tx.categoryId);
    const sub = subcategory(tx.categoryId, tx.subcategoryId);

    return (
      <TouchableOpacity
        style={[styles.row, { backgroundColor: colors.card }]}
        onPress={() => setEditing({ ...tx })}
        activeOpacity={0.7}
      >
        <View style={[styles.iconCircle, { backgroundColor: cat ? `${cat.colorHex}33` : colors.inputBg }]}>
          <Ionicons name="receipt-outline" size={20} color={cat?.colorHex ?? colors.textTertiary} />
        </View>
        <View style={styles.rowInfo}>
          <Text style={[styles.merchant, { color: colors.text }]}>{tx.merchant}</Text>
          <View style={styles.tags}>
            {cat && <Text style={[styles.tag, { color: colors.textSecondary }]}>{cat.name}</Text>}
            {sub && <Text style={[styles.tag, { color: colors.textSecondary }]}>· {sub.name}</Text>}
          </View>
          <Text style={[styles.date, { color: colors.textTertiary }]}>{formatDate(tx.date)}</Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={[styles.amount, tx.kind === TransactionKind.INCOME ? styles.income : styles.expense]}>
            {tx.kind === TransactionKind.EXPENSE ? "-" : "+"}{formatAmount(tx.amount, currency)}
          </Text>
          <Text style={[styles.source, { color: colors.textTertiary }]}>{tx.source}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("history.title")}</Text>
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.card }]}>
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={t("history.searchPlaceholder")}
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="list-outline" size={60} color={colors.separator} />
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{t("history.noItems")}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 140 }}>
          <View style={[styles.listCard, { backgroundColor: colors.card }]}>
            <FlatList
              data={filtered}
              keyExtractor={(tx) => tx.id}
              renderItem={renderItem}
              ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.separator }]} />}
              scrollEnabled={false}
            />
          </View>
        </ScrollView>
      )}

      {editing && (
        <TransactionEditorModal
          transaction={editing}
          onClose={() => setEditing(null)}
          onSave={(tx) => { updateTransaction(tx); setEditing(null); }}
          onDelete={(id) => { handleDelete(id); setEditing(null); }}
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

function TransactionEditorModal({
  transaction,
  onClose,
  onSave,
  onDelete,
}: EditorProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const categories = useAppStore((s) => s.categories);
  const currency = useAppStore((s) => s.currency);
  const category = useAppStore((s) => s.category);

  const [tx, setTx] = useState<Transaction>(transaction);
  const selectedCat = category(tx.categoryId);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.modalHeader, { backgroundColor: colors.background, borderBottomColor: colors.separator }]}>
          <TouchableOpacity onPress={onClose}>
            <Text style={[styles.cancelBtn, { color: colors.destructive }]}>{t("history.cancel")}</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>{t("history.edit")}</Text>
          <TouchableOpacity onPress={() => onSave(tx)}>
            <Text style={[styles.saveBtn, { color: colors.accent }]}>{t("history.save")}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={[styles.modalScroll, { backgroundColor: colors.background }]}
          keyboardShouldPersistTaps="handled"
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
                onChangeText={(v) => setTx({ ...tx, merchant: v })}
              />
              <View style={[styles.inputSep, { backgroundColor: colors.separator }]} />
              <View style={styles.editRow}>
                <Text style={[styles.label, { color: colors.text }]}>{t("history.amount")}</Text>
                <TextInput
                  style={[styles.input, { flex: 1, textAlign: "right", color: colors.text }]}
                  value={String(tx.amount)}
                  onChangeText={(v) => setTx({ ...tx, amount: parseFloat(v) || 0 })}
                  keyboardType="decimal-pad"
                />
                <Text style={[styles.currency, { color: colors.textSecondary }]}>{currency}</Text>
              </View>
              <View style={[styles.inputSep, { backgroundColor: colors.separator }]} />
              <View style={[styles.segmentContainer, { backgroundColor: colors.inputBg }]}>
                {[
                  { label: t("history.expense"), value: TransactionKind.EXPENSE },
                  { label: t("history.income"),  value: TransactionKind.INCOME  },
                ].map((k) => (
                  <TouchableOpacity
                    key={k.value}
                    style={[styles.segment, tx.kind === k.value && { backgroundColor: colors.accent }]}
                    onPress={() => setTx({ ...tx, kind: k.value })}
                  >
                    <Text style={[styles.segmentText, { color: tx.kind === k.value ? "#fff" : colors.textSecondary }]}>
                      {k.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* ── CATEGORY ── */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t("history.sections.category")}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>
                {t("history.category")}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                <TouchableOpacity
                  style={[styles.chip, { backgroundColor: !tx.categoryId ? colors.accent : colors.inputBg }]}
                  onPress={() => setTx({ ...tx, categoryId: undefined, subcategoryId: undefined })}
                >
                  <Text style={[styles.chipText, { color: !tx.categoryId ? "#fff" : colors.text }]}>
                    {t("history.without")}
                  </Text>
                </TouchableOpacity>
                {categories.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, { backgroundColor: tx.categoryId === c.id ? c.colorHex : colors.inputBg }]}
                    onPress={() => setTx({ ...tx, categoryId: c.id, subcategoryId: undefined })}
                  >
                    <Text style={[styles.chipText, { color: tx.categoryId === c.id ? "#fff" : colors.text }]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {selectedCat && selectedCat.subcategories.length > 0 && (
                <>
                  <View style={[styles.inputSep, { backgroundColor: colors.separator }]} />
                  <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>
                    {t("history.subcategory")}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    <TouchableOpacity
                      style={[styles.chip, { backgroundColor: !tx.subcategoryId ? colors.accent : colors.inputBg }]}
                      onPress={() => setTx({ ...tx, subcategoryId: undefined })}
                    >
                      <Text style={[styles.chipText, { color: !tx.subcategoryId ? "#fff" : colors.text }]}>
                        {t("history.without")}
                      </Text>
                    </TouchableOpacity>
                    {selectedCat.subcategories.map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.chip, { backgroundColor: tx.subcategoryId === s.id ? colors.accent : colors.inputBg }]}
                        onPress={() => setTx({ ...tx, subcategoryId: s.id })}
                      >
                        <Text style={[styles.chipText, { color: tx.subcategoryId === s.id ? "#fff" : colors.text }]}>
                          {s.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
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
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: colors.card }]}
            onPress={() => onDelete(tx.id)}
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
  container: { flex: 1, backgroundColor: "#f2f2f7" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    margin: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 16, color: "#000" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingTop: 80,
  },
  emptyText: { fontSize: 18, color: "#999" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  rowInfo: { flex: 1, marginLeft: 12 },
  merchant: { fontSize: 16, fontWeight: "600", color: "#000" },
  tags: { flexDirection: "row", gap: 4, marginTop: 2 },
  tag: { fontSize: 12, color: "#666" },
  date: { fontSize: 11, color: "#aaa", marginTop: 2 },
  rowRight: { alignItems: "flex-end" },
  amount: { fontSize: 16, fontWeight: "600" },
  income: { color: "#34C759" },
  expense: { color: "#FF3B30" },
  source: { fontSize: 11, color: "#aaa", marginTop: 2 },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#e0e0e0",
  },
  // Modal
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
    backgroundColor: "#f2f2f7",
  },
  modalTitle: { fontSize: 17, fontWeight: "600" },
  cancelBtn: { fontSize: 17, color: "#FF3B30" },
  saveBtn: { fontSize: 17, color: "#007AFF", fontWeight: "600" },
  modalScroll: { flex: 1, backgroundColor: "#f2f2f7" },
  section: { margin: 16, marginBottom: 0 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 6,
    paddingHorizontal: 4,
    letterSpacing: 0.5,
  },
  card: { backgroundColor: "#fff", borderRadius: 12, overflow: "hidden" },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#000",
  },
  inputSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#e0e0e0",
    marginHorizontal: 16,
  },
  editRow: { flexDirection: "row", alignItems: "center" },
  label: { paddingLeft: 16, fontSize: 16, color: "#000", width: 80 },
  currency: { paddingRight: 16, fontSize: 15, color: "#666" },
  segmentContainer: {
    flexDirection: "row",
    margin: 10,
    backgroundColor: "#f2f2f7",
    borderRadius: 8,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  segmentText: { fontSize: 14, fontWeight: "500", color: "#666" },
  pickerLabel: {
    fontSize: 13,
    color: "#666",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  chipScroll: { paddingHorizontal: 12, paddingBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f2f2f7",
    marginRight: 8,
    marginTop: 4,
  },
  chipText: { fontSize: 14, color: "#333" },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    margin: 16,
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  deleteText: { fontSize: 16, color: "#FF3B30", fontWeight: "500" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: "700",
    color: "#000",
    letterSpacing: 0.3,
  },
  listCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
  },
});