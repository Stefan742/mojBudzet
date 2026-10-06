import React, { useState } from "react";
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
import { formatMoney } from "../utils/money";
import { Category, categoryLabel, incomeForMonth, monthKey } from "../models";
import { spentInCategory } from "../store/selectors";
import {
  generateBudgetSuggestion,
  BudgetSuggestion,
} from "../services/budgetSuggestionEngine";
import { useTheme } from "@/hooks/useTheme";
import { useAmountField } from "@/hooks/useAmountField";
import { CategoryIcon } from "@/components/CategoryIcon";
import { MIN_TOUCH, useTabBarSpace } from "@/constants/layout";

// ─── Bucket colors ─────────────────────────────────────────────────────────────
const BUCKET_COLOR: Record<string, string> = {
  needs:     "#4CAF50",
  wants:     "#FF9800",
  savings:   "#2196F3",
  emergency: "#F44336",
  debt:      "#9C27B0",
};

/** Share of the limit at which a row starts warning (U-14). */
const WARN_AT = 0.8;

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BudgetScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomSpace = useTabBarSpace();
  const currency = t("common.currency");

  const categories             = useAppStore((s) => s.categories);
  const budgets                = useAppStore((s) => s.budgets);
  // monthKey(new Date()) inside the selector so it is never a cached render value.
  const monthlyIncome          = useAppStore((s) => incomeForMonth(s.incomeSchedule, monthKey(new Date())));
  const transactions           = useAppStore((s) => s.transactions);
  const applyBudgetSuggestions = useAppStore((s) => s.applyBudgetSuggestions);

  // Suggestion modal state
  const [modalVisible, setModalVisible] = useState(false);
  const income                          = useAmountField();
  const [suggestions, setSuggestions]   = useState<BudgetSuggestion[]>([]);
  const [step, setStep]                 = useState<"income" | "preview">("income");

  const BUCKET_LABEL: Record<string, string> = {
    needs:     t("budget.buckets.needs"),
    wants:     t("budget.buckets.wants"),
    savings:   t("budget.buckets.savings"),
    emergency: t("budget.buckets.emergency"),
    debt:      t("budget.buckets.debt"),
  };

  const limitOf = (categoryId: string) =>
    budgets.find((b) => b.categoryId === categoryId)?.monthlyLimit ?? 0;

  const openModal = () => {
    // Pre-fill with the monthly income from Settings at the moment the modal opens.
    if (monthlyIncome > 0) income.setAmount(monthlyIncome);
    else income.reset();
    setStep("income");
    setModalVisible(true);
  };

  const handleGenerate = () => {
    const value = income.parse();
    if (value === null) return;
    setSuggestions(generateBudgetSuggestion({ income: value, categories, transactions }));
    setStep("preview");
  };

  const handleApply = () => {
    applyBudgetSuggestions(suggestions);
    setModalVisible(false);
  };

  const catMap = new Map(categories.map((c) => [c.id, c]));

  // Android shows pageSheet modals full-screen with no insets.
  const modalHeaderTopPad = Platform.OS === "android" ? insets.top + 8 : 8;
  const modalBottomPad    = Math.max(insets.bottom, 16);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <FlatList
        data={categories}
        // The limit is part of the key, so a row's input shows a limit that
        // changed elsewhere (AI "Apply") instead of its stale text (B-16).
        keyExtractor={(c) => `${c.id}:${limitOf(c.id)}`}
        contentContainerStyle={[styles.content, { paddingBottom: bottomSpace }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.text }]} accessibilityRole="header">
              {t("budget.title")}
            </Text>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{t("budget.subtitle")}</Text>
            {categories.length > 0 && (
              <TouchableOpacity
                style={[styles.aiBtn, { backgroundColor: colors.accent, shadowColor: colors.accent }]}
                onPress={openModal}
                activeOpacity={0.82}
                accessibilityRole="button"
              >
                <Ionicons name="sparkles" size={15} color={colors.onAccent} />
                <Text style={[styles.aiBtnText, { color: colors.onAccent }]}>{t("budget.aiSuggest")}</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="pricetags-outline" size={56} color={colors.separator} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("budget.noCategories")}</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>{t("budget.noCategoriesSub")}</Text>
          </View>
        }
        ListFooterComponent={
          categories.length > 0 ? (
            <Text style={[styles.footer, { color: colors.textSecondary }]}>{t("budget.footer")}</Text>
          ) : null
        }
        renderItem={({ item }) => <BudgetRow category={item} limit={limitOf(item.id)} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View
            style={[
              styles.modalHeader,
              { backgroundColor: colors.background, borderBottomColor: colors.separator, paddingTop: modalHeaderTopPad },
            ]}
          >
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]} accessibilityRole="header">
              {t("budget.modal.title")}
            </Text>
            <View style={styles.closeBtn} />
          </View>

          {step === "income" ? (
            <KeyboardAvoidingView style={[styles.modalBody, { paddingBottom: modalBottomPad }]} behavior="padding">
              <View style={[styles.stepCard, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                <Ionicons name="cash-outline" size={36} color={colors.accent} />
                <Text style={[styles.stepTitle, { color: colors.text }]}>{t("budget.modal.question")}</Text>
                <Text style={[styles.stepSub, { color: colors.textSecondary }]}>{t("budget.modal.sub")}</Text>
                <View style={[styles.incomeInputRow, { backgroundColor: colors.inputBg }]}>
                  <TextInput
                    style={[styles.incomeInput, { color: colors.text }]}
                    value={income.text}
                    onChangeText={income.onChangeText}
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                    autoFocus
                    accessibilityLabel={t("budget.modal.question")}
                  />
                  <Text style={[styles.incomeCurrency, { color: colors.textSecondary }]}>{currency}</Text>
                </View>
                {income.errorText && (
                  <Text style={[styles.fieldError, { color: colors.destructive }]}>{income.errorText}</Text>
                )}
                <View style={styles.rulePills}>
                  {Object.entries(BUCKET_LABEL).map(([b, label]) => (
                    <View key={b} style={[styles.pill, { backgroundColor: `${BUCKET_COLOR[b]}18` }]}>
                      <View style={[styles.pillDot, { backgroundColor: BUCKET_COLOR[b] }]} />
                      <Text style={[styles.pillText, { color: colors.text }]}>{label}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: income.text ? colors.accent : colors.inputBg }]}
                onPress={handleGenerate}
                disabled={!income.text}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ disabled: !income.text }}
              >
                <Text style={[styles.primaryBtnText, { color: income.text ? colors.onAccent : colors.textTertiary }]}>
                  {t("budget.modal.generate")}
                </Text>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          ) : (
            <View style={[styles.modalBody, { paddingBottom: modalBottomPad }]}>
              <Text style={[styles.previewHint, { color: colors.textSecondary }]}>{t("budget.modal.preview")}</Text>
              <ScrollView style={styles.previewScroll} showsVerticalScrollIndicator={false}>
                {suggestions.map((s) => {
                  const cat = catMap.get(s.categoryId);
                  if (!cat) return null;
                  const color = BUCKET_COLOR[s.bucket] ?? colors.textSecondary;
                  return (
                    <View
                      key={s.categoryId}
                      style={[styles.previewRow, { backgroundColor: colors.card, shadowColor: colors.shadow }]}
                      accessible
                      accessibilityLabel={`${categoryLabel(cat, t)}, ${BUCKET_LABEL[s.bucket] ?? s.bucket}, ${formatMoney(s.suggestedMonthlyLimit, currency)}`}
                    >
                      <View style={[styles.previewIcon, { backgroundColor: `${cat.colorHex}22` }]}>
                        <CategoryIcon iconName={cat.iconName} size={16} color={cat.colorHex} />
                      </View>
                      <View style={styles.previewInfo}>
                        <Text style={[styles.previewName, { color: colors.text }]}>{categoryLabel(cat, t)}</Text>
                        <View style={styles.previewBucketRow}>
                          <View style={[styles.previewBucketDot, { backgroundColor: color }]} />
                          <Text style={[styles.previewBucket, { color: colors.textSecondary }]}>
                            {BUCKET_LABEL[s.bucket] ?? s.bucket}
                            {s.confidence < 1 ? ` · ${t("budget.modal.calibrated")}` : ""}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.previewAmount, { color: colors.text }]}>
                        {formatMoney(s.suggestedMonthlyLimit, currency)}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.secondaryBtn, { backgroundColor: colors.inputBg }]}
                  onPress={() => setStep("income")}
                  accessibilityRole="button"
                >
                  <Text style={[styles.secondaryBtnText, { color: colors.text }]}>{t("budget.modal.back")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, styles.flex, { backgroundColor: colors.accent }]}
                  onPress={handleApply}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Text style={[styles.primaryBtnText, { color: colors.onAccent }]}>{t("budget.modal.apply")}</Text>
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

function BudgetRow({ category, limit }: { category: Category; limit: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const currency  = t("common.currency");
  const setBudget = useAppStore((s) => s.setBudget);
  // Select the number, not a function, so the row re-renders when
  // transactions change (B-1).
  const spent     = useAppStore((s) => spentInCategory(s.transactions, category.id, monthKey(new Date())));
  // Empty text and 0 both remove the limit.
  const limitField = useAmountField(limit, { allowZero: true });

  const ratio    = limit > 0 ? spent / limit : 0;
  const progress = Math.min(1, ratio);
  const progressColor = ratio >= 1 ? colors.destructive : ratio >= WARN_AT ? colors.warning : category.colorHex;
  const name = categoryLabel(category, t);

  const handleSet = () => {
    const value = limitField.text.trim() === "" ? 0 : limitField.parse();
    if (value === null) return;
    setBudget(category.id, value);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
      <View
        style={styles.rowTop}
        accessible
        accessibilityLabel={`${name}, ${formatMoney(spent, currency)}${limit > 0 ? ` / ${formatMoney(limit, currency)}, ${Math.round(ratio * 100)}%` : ""}`}
      >
        <View style={[styles.iconCircle, { backgroundColor: `${category.colorHex}22` }]}>
          <CategoryIcon iconName={category.iconName} size={18} color={category.colorHex} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.categoryName, { color: colors.text }]}>{name}</Text>
          <Text style={[styles.amounts, { color: colors.textSecondary }]}>
            {formatMoney(spent, currency)}{limit > 0 ? ` / ${formatMoney(limit, currency)}` : ""}
          </Text>
        </View>
        {limit > 0 && (
          <Text style={[styles.pct, { color: ratio >= WARN_AT ? progressColor : colors.text }]}>{Math.round(ratio * 100)}%</Text>
        )}
      </View>

      {limit > 0 && (
        <View style={[styles.progressTrack, { backgroundColor: colors.separator }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: progressColor }]} />
        </View>
      )}

      {/* The warning the footer promises (U-14). */}
      {limit > 0 && ratio >= WARN_AT && (
        <View style={styles.warningRow}>
          <Ionicons name={ratio >= 1 ? "alert-circle" : "warning"} size={14} color={progressColor} />
          <Text style={[styles.warningText, { color: colors.text }]}>
            {ratio >= 1
              ? t("budget.overLimit", { amount: formatMoney(spent - limit, currency) })
              : t("budget.nearLimit", { amount: formatMoney(limit - spent, currency) })}
          </Text>
        </View>
      )}

      <View style={[styles.divider, { backgroundColor: colors.separator }]} />

      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]}
          placeholder={t("budget.monthlyLimit")}
          placeholderTextColor={colors.textTertiary}
          value={limitField.text}
          onChangeText={limitField.onChangeText}
          keyboardType="number-pad"
          returnKeyType="done"
          onSubmitEditing={handleSet}
          accessibilityLabel={t("budget.limitFor", { name })}
        />
        <TouchableOpacity
          style={[styles.setButton, { backgroundColor: colors.accent }]}
          onPress={handleSet}
          accessibilityRole="button"
          accessibilityLabel={t("budget.setLimitFor", { name })}
        >
          <Text style={[styles.setButtonText, { color: colors.onAccent }]}>{t("budget.setLimit")}</Text>
        </TouchableOpacity>
      </View>
      {limitField.errorText && (
        <Text style={[styles.fieldError, { color: colors.destructive }]}>{limitField.errorText}</Text>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content:   { paddingHorizontal: 20 },
  flex:      { flex: 1 },

  header: { paddingTop: 8, paddingBottom: 16, gap: 10 },
  headerTitle: { fontSize: 34, fontWeight: "700", letterSpacing: 0.3 },
  headerSub: { fontSize: 13 },

  aiBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    minHeight: MIN_TOUCH,
    paddingHorizontal: 18,
    alignSelf: "stretch",
    justifyContent: "center",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  aiBtnText: { fontSize: 14, fontWeight: "600" },

  empty:      { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: "600", textAlign: "center" },
  emptySub:   { fontSize: 14, textAlign: "center", paddingHorizontal: 32 },

  footer: { fontSize: 12, marginTop: 16, lineHeight: 18, textAlign: "center", paddingHorizontal: 8 },

  card: {
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  rowTop:     { flexDirection: "row", alignItems: "center" },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  categoryName: { fontSize: 16, fontWeight: "600" },
  amounts:      { fontSize: 13, marginTop: 1 },
  pct:          { fontSize: 15, fontWeight: "700", marginLeft: 8 },

  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill:  { height: 8, borderRadius: 4 },
  warningRow:    { flexDirection: "row", alignItems: "center", gap: 6 },
  warningText:   { fontSize: 13, flex: 1 },

  divider: { height: StyleSheet.hairlineWidth },

  inputRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  input: { flex: 1, borderRadius: 10, paddingHorizontal: 14, minHeight: MIN_TOUCH, fontSize: 15 },
  setButton: { borderRadius: 10, paddingHorizontal: 18, minHeight: MIN_TOUCH, justifyContent: "center" },
  setButtonText: { fontSize: 15, fontWeight: "600" },
  fieldError: { fontSize: 13 },

  modal: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center" },
  modalTitle: { fontSize: 17, fontWeight: "600", flex: 1, textAlign: "center" },
  modalBody: { flex: 1, paddingHorizontal: 20, paddingTop: 24, gap: 16 },

  stepCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 12,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  stepTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  stepSub:   { fontSize: 13, textAlign: "center", lineHeight: 19 },
  incomeInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    alignSelf: "stretch",
    marginTop: 4,
  },
  incomeInput:    { flex: 1, fontSize: 28, fontWeight: "700", textAlign: "right" },
  incomeCurrency: { fontSize: 18, fontWeight: "500" },

  rulePills: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 4 },
  pill:      { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  pillDot:   { width: 7, height: 7, borderRadius: 4 },
  pillText:  { fontSize: 12, fontWeight: "600" },

  previewHint:   { fontSize: 13, textAlign: "center", marginBottom: 4 },
  previewScroll: { flex: 1 },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  previewIcon:      { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  previewInfo:      { flex: 1, gap: 3 },
  previewName:      { fontSize: 15, fontWeight: "600" },
  previewBucketRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  previewBucketDot: { width: 6, height: 6, borderRadius: 3 },
  previewBucket:    { fontSize: 12, fontWeight: "600" },
  previewAmount:    { fontSize: 15, fontWeight: "700" },

  actionRow: { flexDirection: "row", gap: 10, paddingTop: 8 },
  primaryBtn: { borderRadius: 14, paddingVertical: 15, alignItems: "center", minHeight: MIN_TOUCH },
  primaryBtnText: { fontSize: 16, fontWeight: "600" },
  secondaryBtn: { flex: 1, borderRadius: 14, paddingVertical: 15, alignItems: "center", minHeight: MIN_TOUCH },
  secondaryBtnText: { fontSize: 16, fontWeight: "600" },
});
