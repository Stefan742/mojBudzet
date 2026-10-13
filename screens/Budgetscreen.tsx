import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useAppStore } from "../store/useAppStore";
import { showToast } from "../store/session";
import { formatMoney } from "../utils/money";
import { haptics } from "../utils/haptics";
import { Category, categoryLabel, monthKey, plannedMonthlyIncome } from "../models";
import { BUDGET_WARN_AT, spentInCategory } from "../store/selectors";
import {
  generateBudgetSuggestion,
  BudgetSuggestion,
} from "../services/budgetSuggestionEngine";
import { useTheme } from "@/hooks/useTheme";
import { amountKeyboard, useCurrency } from "@/hooks/useCurrency";
import { useAmountField } from "@/hooks/useAmountField";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Icon } from "@/components/Icon";
import { ModalHeader } from "@/components/ModalHeader";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Section, Separator } from "@/components/ui/Section";
import { dataColor } from "@/constants/palette";
import {
  GUTTER, ROW_MIN, SECTION_GAP, corners, inputType, money, radius, space, tint, type,
} from "@/constants/design";

// ─── Bucket colours (system palette) ──────────────────────────────────────────
const BUCKET_COLOR: Record<string, string> = {
  needs:     "#34C759",
  wants:     "#FF9500",
  savings:   "#007AFF",
  emergency: "#FF3B30",
  debt:      "#AF52DE",
};

const TILE = 36;

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BudgetScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const currency = useCurrency();

  const categories             = useAppStore((s) => s.categories);
  const budgets                = useAppStore((s) => s.budgets);
  // The repeating salary (and other repeating income) is the planned income.
  const monthlyIncome          = useAppStore((s) => plannedMonthlyIncome(s.recurring));
  const transactions           = useAppStore((s) => s.transactions);
  const applyBudgetSuggestions = useAppStore((s) => s.applyBudgetSuggestions);

  // Suggestion sheet state
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
    // Pre-fill with the planned monthly income (repeating salary) when the sheet opens.
    if (monthlyIncome > 0) income.setAmount(monthlyIncome);
    else income.reset();
    setStep("income");
    setModalVisible(true);
  };

  const handleGenerate = () => {
    const value = income.parse();
    if (value === null) {
      haptics.error();
      return;
    }
    haptics.selection();
    setSuggestions(generateBudgetSuggestion({ income: value, categories, transactions }));
    setStep("preview");
  };

  const handleApply = () => {
    applyBudgetSuggestions(suggestions);
    setModalVisible(false);
    haptics.success();
    showToast(t("budget.applied"));
  };

  const catMap = new Map(categories.map((c) => [c.id, c]));

  return (
    <>
      <FlatList
        data={categories}
        // The limit is part of the key, so a row's input shows a limit that
        // changed elsewhere (AI "Apply") instead of its stale text (B-16).
        keyExtractor={(c) => `${c.id}:${limitOf(c.id)}`}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={[type.subheadline, { color: colors.textSecondary }]}>{t("budget.subtitle")}</Text>
            {categories.length > 0 && (
              <Button title={t("budget.aiSuggest")} variant="tinted" icon="sparkles" onPress={openModal} />
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="tags" size={48} color={colors.placeholder} />
            <Text style={[type.title3, { color: colors.text }]}>{t("budget.noCategories")}</Text>
            <Text style={[type.footnote, styles.emptySub, { color: colors.textSecondary }]}>{t("budget.noCategoriesSub")}</Text>
          </View>
        }
        ListFooterComponent={
          categories.length > 0 ? (
            <Text style={[type.footnote, styles.footer, { color: colors.textSecondary }]}>{t("budget.footer")}</Text>
          ) : null
        }
        renderItem={({ item }) => <BudgetRow category={item} limit={limitOf(item.id)} />}
        ItemSeparatorComponent={() => <View style={{ height: space[3] }} />}
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]} behavior="padding">
          <ModalHeader
            title={t("budget.modal.title")}
            cancelLabel={step === "income" ? t("common.cancel") : t("common.back")}
            onCancel={() => (step === "income" ? setModalVisible(false) : setStep("income"))}
            saveLabel={step === "income" ? t("budget.modal.generateShort") : t("budget.modal.apply")}
            onSave={step === "income" ? handleGenerate : handleApply}
            saveDisabled={step === "income" ? !income.text : suggestions.length === 0}
          />

          {step === "income" ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + space[6] }]}
            >
              <View style={styles.sheetIntro}>
                <View style={[styles.badge, { backgroundColor: tint(colors.accent, "subtle") }]}>
                  <Icon name="money" size={26} color={colors.accent} />
                </View>
                <Text style={[type.title3, styles.center, { color: colors.text }]}>{t("budget.modal.question")}</Text>
                <Text style={[type.subheadline, styles.center, { color: colors.textSecondary }]}>{t("budget.modal.sub")}</Text>
              </View>
              <Section footer={income.errorText} footerColor={colors.destructive}>
                <View style={styles.incomeRow}>
                  <TextInput
                    style={[inputType(type.title1), money, styles.incomeInput, { color: colors.text }]}
                    value={income.text}
                    onChangeText={income.onChangeText}
                    placeholder="0"
                    placeholderTextColor={colors.placeholder}
                    keyboardType={amountKeyboard(currency)}
                    autoFocus
                    accessibilityLabel={t("budget.modal.question")}
                  />
                  <Text style={[type.body, { color: colors.textSecondary }]}>{currency.label}</Text>
                </View>
              </Section>
              <View style={styles.rulePills}>
                {Object.entries(BUCKET_LABEL).map(([b, label]) => (
                  <View key={b} style={[styles.pill, { backgroundColor: colors.fill }]}>
                    <View style={[styles.pillDot, { backgroundColor: dataColor(BUCKET_COLOR[b], isDark) }]} />
                    <Text style={[type.footnote, { color: colors.text }]}>{label}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + space[6] }]}>
              <Section title={t("budget.modal.previewTitle")} footer={t("budget.modal.preview")}>
                {suggestions.map((s, i) => {
                  const cat = catMap.get(s.categoryId);
                  if (!cat) return null;
                  const color = dataColor(cat.colorHex, isDark);
                  return (
                    <View key={s.categoryId}>
                      {i > 0 && <Separator inset={space[4] + TILE + space[3]} />}
                      <View
                        style={styles.previewRow}
                        accessible
                        accessibilityLabel={`${categoryLabel(cat, t)}, ${BUCKET_LABEL[s.bucket] ?? s.bucket}, ${formatMoney(s.suggestedMonthlyLimit, currency)}`}
                      >
                        <View style={[styles.tile, { backgroundColor: tint(color, "soft") }]}>
                          <CategoryIcon iconName={cat.iconName} size={18} color={color} />
                        </View>
                        <View style={styles.flex}>
                          <Text style={[type.body, { color: colors.text }]}>{categoryLabel(cat, t)}</Text>
                          <Text style={[type.footnote, { color: colors.textSecondary }]}>
                            {BUCKET_LABEL[s.bucket] ?? s.bucket}
                            {s.confidence < 1 ? ` · ${t("budget.modal.calibrated")}` : ""}
                          </Text>
                        </View>
                        <Text style={[type.headline, money, { color: colors.text }]}>
                          {formatMoney(s.suggestedMonthlyLimit, currency)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </Section>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ─── Budget Row ───────────────────────────────────────────────────────────────

function BudgetRow({ category, limit }: { category: Category; limit: number }) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const currency  = useCurrency();
  const setBudget = useAppStore((s) => s.setBudget);
  // Select the number, not a function, so the row re-renders when
  // transactions change (B-1).
  const spent     = useAppStore((s) => spentInCategory(s.transactions, category.id, monthKey(new Date())));
  // Empty text and 0 both remove the limit.
  const limitField = useAmountField(limit, { allowZero: true });

  const color    = dataColor(category.colorHex, isDark);
  const ratio    = limit > 0 ? spent / limit : 0;
  const status   = ratio >= 1 ? colors.destructive : ratio >= BUDGET_WARN_AT ? colors.warning : color;
  const name     = categoryLabel(category, t);

  const handleSet = () => {
    const value = limitField.text.trim() === "" ? 0 : limitField.parse();
    if (value === null) {
      haptics.error();
      return;
    }
    setBudget(category.id, value);
    haptics.success();
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View
        style={styles.rowTop}
        accessible
        accessibilityLabel={`${name}, ${formatMoney(spent, currency)}${limit > 0 ? ` / ${formatMoney(limit, currency)}, ${Math.round(ratio * 100)}%` : ""}`}
      >
        <View style={[styles.tile, { backgroundColor: tint(color, "soft") }]}>
          <CategoryIcon iconName={category.iconName} size={18} color={color} />
        </View>
        <View style={styles.flex}>
          <Text style={[type.headline, { color: colors.text }]}>{name}</Text>
          <Text style={[type.subheadline, money, { color: colors.textSecondary }]}>
            {formatMoney(spent, currency)}{limit > 0 ? ` / ${formatMoney(limit, currency)}` : ""}
          </Text>
        </View>
        {limit > 0 && (
          <Text style={[type.headline, money, { color: ratio >= BUDGET_WARN_AT ? status : colors.textSecondary }]}>
            {Math.round(ratio * 100)}%
          </Text>
        )}
      </View>

      {limit > 0 && <ProgressBar progress={ratio} color={status} />}

      {/* The warning the footer promises (U-14). */}
      {limit > 0 && ratio >= BUDGET_WARN_AT && (
        <View style={styles.warningRow}>
          <Icon name={ratio >= 1 ? "alert" : "warning"} size={14} color={status} />
          <Text style={[type.footnote, styles.flex, { color: colors.text }]}>
            {ratio >= 1
              ? t("budget.overLimit", { amount: formatMoney(spent - limit, currency) })
              : t("budget.nearLimit", { amount: formatMoney(limit - spent, currency) })}
          </Text>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={[inputType(type.body), money, styles.input, { backgroundColor: colors.fill, color: colors.text }]}
          placeholder={t("budget.monthlyLimit")}
          placeholderTextColor={colors.placeholder}
          value={limitField.text}
          onChangeText={limitField.onChangeText}
          keyboardType={amountKeyboard(currency)}
          returnKeyType="done"
          onSubmitEditing={handleSet}
          accessibilityLabel={t("budget.limitFor", { name })}
        />
        <Pressable
          style={[styles.setButton, { backgroundColor: colors.accent }]}
          onPress={handleSet}
          accessibilityRole="button"
          accessibilityLabel={t("budget.setLimitFor", { name })}
        >
          <Text style={[type.headline, { color: colors.onAccent }]}>{t("budget.setLimit")}</Text>
        </Pressable>
      </View>
      {limitField.errorText && (
        <Text style={[type.footnote, { color: colors.destructive }]}>{limitField.errorText}</Text>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex:         { flex: 1 },
  center:       { textAlign: "center" },
  content:      { paddingHorizontal: GUTTER, paddingTop: space[2], paddingBottom: space[8], flexGrow: 1 },
  listHeader:   { gap: space[4], marginBottom: SECTION_GAP },
  empty:        { alignItems: "center", paddingVertical: space[10], gap: space[3] },
  emptySub:     { textAlign: "center", paddingHorizontal: space[8] },
  footer:       { marginTop: space[4], textAlign: "center", paddingHorizontal: space[2] },
  card:         { padding: space[4], gap: space[3], ...corners(radius.lg) },
  rowTop:       { flexDirection: "row", alignItems: "center", gap: space[3] },
  tile:         { width: TILE, height: TILE, alignItems: "center", justifyContent: "center", ...corners(radius.sm) },
  warningRow:   { flexDirection: "row", alignItems: "center", gap: space[2] },
  inputRow:     { flexDirection: "row", gap: space[2], alignItems: "center" },
  input:        { flex: 1, minWidth: 0, paddingHorizontal: space[3], minHeight: ROW_MIN, borderRadius: radius.sm },
  setButton:    { paddingHorizontal: space[4], minHeight: ROW_MIN, justifyContent: "center", ...corners(radius.sm) },
  sheetContent: { paddingHorizontal: GUTTER, paddingTop: space[4], gap: SECTION_GAP },
  sheetIntro:   { alignItems: "center", gap: space[2] },
  badge:        { width: 56, height: 56, alignItems: "center", justifyContent: "center", marginBottom: space[2], ...corners(radius.lg) },
  incomeRow:    { flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[4], minHeight: ROW_MIN + 20 },
  incomeInput:  { flex: 1, minWidth: 0, textAlign: "right", paddingVertical: space[2] },
  rulePills:    { flexDirection: "row", flexWrap: "wrap", gap: space[2], justifyContent: "center" },
  pill:         { flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[3], paddingVertical: space[1] + 2, ...corners(radius.pill) },
  pillDot:      { width: 8, height: 8, borderRadius: 4 },
  previewRow:   { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3] },
});
