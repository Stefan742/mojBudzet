import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useAppStore } from "../store/useAppStore";
import { formatAmount } from "../utils/helpers";
import { Category, incomeForMonth, monthKey } from "../models";
import {
  generateBudgetSuggestion,
  BudgetSuggestion,
} from "../services/budgetSuggestionEngine";
import { useTheme } from "@/hooks/useTheme";

// ─── Bucket colors ─────────────────────────────────────────────────────────────
const BUCKET_COLOR: Record<string, string> = {
  needs:     "#4CAF50",
  wants:     "#FF9800",
  savings:   "#2196F3",
  emergency: "#F44336",
  debt:      "#9C27B0",
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BudgetScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const categories             = useAppStore((s) => s.categories);
  // monthKey(new Date()) inside the selector so it is never a cached render value.
  const monthlyIncome          = useAppStore((s) => incomeForMonth(s.incomeSchedule, monthKey(new Date())));
  const transactions           = useAppStore((s) => s.transactions);
  const applyBudgetSuggestions = useAppStore((s) => s.applyBudgetSuggestions);
  const insets                 = useSafeAreaInsets();

  // Suggestion modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [incomeText, setIncomeText]     = useState("");
  const [suggestions, setSuggestions]   = useState<BudgetSuggestion[]>([]);
  const [step, setStep]                 = useState<"income" | "preview">("income");

  // Bucket label map — built from translations so it stays in sync with locale
  const BUCKET_LABEL: Record<string, string> = {
    needs:     t("budget.buckets.needs"),
    wants:     t("budget.buckets.wants"),
    savings:   t("budget.buckets.savings"),
    emergency: t("budget.buckets.emergency"),
    debt:      t("budget.buckets.debt"),
  };

  // ── Generate suggestions ──────────────────────────────────────────────────
  const handleGenerate = useCallback(() => {
    const income = parseFloat(incomeText.replace(",", ".")) || 0;
    if (income <= 0) return;

    const result = generateBudgetSuggestion({ income, categories, transactions });
    setSuggestions(result);
    setStep("preview");
  }, [incomeText, categories, transactions]);

  // ── Apply & close ─────────────────────────────────────────────────────────
  const handleApply = useCallback(() => {
    applyBudgetSuggestions(suggestions);
    setModalVisible(false);
    setStep("income");
  }, [suggestions, applyBudgetSuggestions]);

  const handleClose = () => {
    setModalVisible(false);
    setStep("income");
  };

  const catMap = new Map(categories.map((c) => [c.id, c]));

  // Android's Modal (even with presentationStyle="pageSheet", which iOS honors
  // but Android ignores) does not automatically inset for the status bar or
  // the gesture/nav bar, so we add the safe-area insets manually below.
  const modalHeaderTopPad = Platform.OS === "android" ? insets.top + 16 : 20;
  const modalBottomPad    = Platform.OS === "android" ? insets.bottom : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <FlatList
        data={categories}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t("budget.title")}</Text>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{t("budget.subtitle")}</Text>
            <TouchableOpacity
              style={[styles.aiBtn, { backgroundColor: colors.accent }]}
              onPress={() => {
                // Pre-fill with the monthly income from Settings at the moment the modal opens.
                setIncomeText(monthlyIncome > 0 ? String(monthlyIncome) : "");
                setModalVisible(true);
              }}
              activeOpacity={0.82}
            >
              <Ionicons name="sparkles" size={15} color="#fff" />
              <Text style={styles.aiBtnText}>{t("budget.aiSuggest")}</Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={
          <Text style={[styles.footer, { color: colors.textTertiary }]}>{t("budget.footer")}</Text>
        }
        renderItem={({ item }) => <BudgetRow category={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}
      >
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          {/* Modal header */}
          <View
            style={[
              styles.modalHeader,
              { backgroundColor: colors.background, borderBottomColor: colors.separator, paddingTop: modalHeaderTopPad },
            ]}
          >
            <TouchableOpacity onPress={handleClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t("budget.modal.title")}</Text>
            <View style={{ width: 24 }} />
          </View>

          {step === "income" ? (
            /* ── Step 1: income input ── */
            <KeyboardAvoidingView
              style={[styles.modalBody, { paddingBottom: modalBottomPad }]}
              behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
              <View style={[styles.stepCard, { backgroundColor: colors.card }]}>
                <Ionicons name="cash-outline" size={36} color={colors.accent} />
                <Text style={[styles.stepTitle, { color: colors.text }]}>{t("budget.modal.question")}</Text>
                <Text style={[styles.stepSub, { color: colors.textSecondary }]}>{t("budget.modal.sub")}</Text>
                <View style={[styles.incomeInputRow, { backgroundColor: colors.inputBg }]}>
                  <TextInput
                    style={[styles.incomeInput, { color: colors.text }]}
                    value={incomeText}
                    onChangeText={setIncomeText}
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="decimal-pad"
                    autoFocus
                  />
                  <Text style={[styles.incomeCurrency, { color: colors.textSecondary }]}>
                    {t("budget.modal.currency")}
                  </Text>
                </View>
                <View style={styles.rulePills}>
                  {Object.entries(BUCKET_LABEL).map(([b, label]) => (
                    <View key={b} style={[styles.pill, { backgroundColor: `${BUCKET_COLOR[b]}18` }]}>
                      <View style={[styles.pillDot, { backgroundColor: BUCKET_COLOR[b] }]} />
                      <Text style={[styles.pillText, { color: BUCKET_COLOR[b] }]}>{label}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <TouchableOpacity
                style={[styles.primaryBtn, !incomeText && styles.primaryBtnDisabled]}
                onPress={handleGenerate}
                disabled={!incomeText}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>{t("budget.modal.generate")}</Text>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          ) : (
            /* ── Step 2: preview ── */
            <View style={[styles.modalBody, { paddingBottom: modalBottomPad }]}>
              <Text style={[styles.previewHint, { color: colors.textSecondary }]}>
                {t("budget.modal.preview")}
              </Text>
              <ScrollView style={styles.previewScroll} showsVerticalScrollIndicator={false}>
                {suggestions.map((s) => {
                  const cat   = catMap.get(s.categoryId);
                  if (!cat) return null;
                  const color = BUCKET_COLOR[s.bucket] ?? "#888";
                  return (
                    <View key={s.categoryId} style={[styles.previewRow, { backgroundColor: colors.card }]}>
                      <View style={[styles.previewIcon, { backgroundColor: `${cat.colorHex}22` }]}>
                        <Ionicons name="pricetag" size={16} color={cat.colorHex} />
                      </View>
                      <View style={styles.previewInfo}>
                        <Text style={[styles.previewName, { color: colors.text }]}>{cat.name}</Text>
                        <View style={styles.previewBucketRow}>
                          <View style={[styles.previewBucketDot, { backgroundColor: color }]} />
                          <Text style={[styles.previewBucket, { color }]}>
                            {BUCKET_LABEL[s.bucket] ?? s.bucket}
                          </Text>
                          {s.confidence < 1 && (
                            <Text style={[styles.previewCalib, { color: colors.textTertiary }]}>
                              {" "}· {t("budget.modal.calibrated")}
                            </Text>
                          )}
                        </View>
                      </View>
                      <Text style={[styles.previewAmount, { color: colors.text }]}>
                        {formatAmount(s.suggestedMonthlyLimit)}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
              <View style={[styles.actionRow, { paddingBottom: (Platform.OS === "ios" ? 32 : 16) + modalBottomPad }]}>
                <TouchableOpacity
                  style={[styles.secondaryBtn, { backgroundColor: colors.inputBg }]}
                  onPress={() => setStep("income")}
                >
                  <Text style={[styles.secondaryBtnText, { color: colors.text }]}>{t("budget.modal.back")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
                  onPress={handleApply}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>{t("budget.modal.apply")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

// ─── Budget Row ───────────────────────────────────────────────────────────────

function BudgetRow({ category }: { category: Category }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const budgets      = useAppStore((s) => s.budgets);
  const setBudget    = useAppStore((s) => s.setBudget);
  const monthlySpent = useAppStore((s) => s.monthlySpent);

  const limit    = budgets.find((b) => b.categoryId === category.id)?.monthlyLimit ?? 0;
  const spent    = monthlySpent(category.id);
  const progress = limit > 0 ? Math.min(1, spent / limit) : 0;

  const [text, setText] = useState(limit > 0 ? String(Math.round(limit)) : "");

  const progressColor =
    progress >= 1   ? "#FF3B30" :
    progress > 0.8  ? "#FF9500" :
    category.colorHex;

  const handleSet = () => {
    const v = parseFloat(text.replace(",", ".")) || 0;
    setBudget(category.id, v);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.rowTop}>
        <View style={[styles.iconCircle, { backgroundColor: `${category.colorHex}22` }]}>
          <Ionicons name="pricetag" size={18} color={category.colorHex} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.categoryName, { color: colors.text }]}>{category.name}</Text>
          <Text style={[styles.amounts, { color: colors.textSecondary }]}>
            {formatAmount(spent)}{limit > 0 ? ` / ${formatAmount(limit)}` : ""}
          </Text>
        </View>
        {limit > 0 && (
          <Text style={[styles.pct, { color: progressColor }]}>{Math.round(progress * 100)}%</Text>
        )}
      </View>

      {limit > 0 && (
        <View style={[styles.progressTrack, { backgroundColor: colors.separator }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: progressColor }]} />
        </View>
      )}

      <View style={[styles.divider, { backgroundColor: colors.separator }]} />

      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]}
          placeholder={t("budget.monthlyLimit")}
          placeholderTextColor={colors.textTertiary}
          value={text}
          onChangeText={setText}
          keyboardType="decimal-pad"
        />
        <TouchableOpacity style={[styles.setButton, { backgroundColor: colors.accent }]} onPress={handleSet}>
          <Text style={styles.setButtonText}>{t("budget.setLimit")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f2f2f7" },
  content:   { paddingHorizontal: 20, paddingBottom: 140 },

  header: { paddingTop: 8, paddingBottom: 16, gap: 10 },
  headerTitle: {
    fontSize: 34,
    fontWeight: "700",
    color: "#000",
    letterSpacing: 0.3,
  },
  headerSub: { fontSize: 13, color: "#888" },

  aiBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignSelf: "stretch",
    justifyContent: "center",
    shadowColor: "#007AFF",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  aiBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  footer: {
    fontSize: 12,
    color: "#999",
    marginTop: 16,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: 8,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  rowTop:    { flexDirection: "row", alignItems: "center" },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryName: { fontSize: 16, fontWeight: "600", color: "#000" },
  amounts:      { fontSize: 12, color: "#888", marginTop: 1 },
  pct:          { fontSize: 15, fontWeight: "700", marginLeft: 8 },

  progressTrack: {
    height: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: { height: 8, borderRadius: 4 },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#e8e8e8" },

  inputRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  input: {
    flex: 1,
    backgroundColor: "#f2f2f7",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#000",
  },
  setButton: {
    backgroundColor: "#007AFF",
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  setButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  modal: { flex: 1, backgroundColor: "#f2f2f7" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: "#f2f2f7",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: { fontSize: 17, fontWeight: "600", color: "#000" },
  modalBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 16,
  },

  stepCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  stepTitle: { fontSize: 18, fontWeight: "700", color: "#000", textAlign: "center" },
  stepSub:   { fontSize: 13, color: "#888", textAlign: "center", lineHeight: 19 },
  incomeInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f2f2f7",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    alignSelf: "stretch",
    marginTop: 4,
  },
  incomeInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: "700",
    color: "#000",
    textAlign: "right",
  },
  incomeCurrency: { fontSize: 18, fontWeight: "500", color: "#888" },

  rulePills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginTop: 4,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  pillDot:  { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 12, fontWeight: "600" },

  previewHint: {
    fontSize: 13,
    color: "#888",
    textAlign: "center",
    marginBottom: 4,
  },
  previewScroll: { flex: 1 },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  previewIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  previewInfo:      { flex: 1, gap: 3 },
  previewName:      { fontSize: 15, fontWeight: "600", color: "#000" },
  previewBucketRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  previewBucketDot: { width: 6, height: 6, borderRadius: 3 },
  previewBucket:    { fontSize: 11, fontWeight: "600" },
  previewCalib:     { fontSize: 11, color: "#aaa" },
  previewAmount:    { fontSize: 15, fontWeight: "700", color: "#000" },

  actionRow: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 8,
  },
  primaryBtn: {
    backgroundColor: "#007AFF",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    shadowColor: "#007AFF",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  primaryBtnDisabled: {
    backgroundColor: "#c7c7cc",
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "#e8e8ed",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#000", fontSize: 16, fontWeight: "600" },
});