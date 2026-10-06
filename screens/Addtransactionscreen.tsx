import React, { useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Switch,
  AccessibilityInfo,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/useAppStore";
import { TransactionKind, categoryLabel } from "../models";
import { findCategory } from "../store/selectors";
import { useMLCategorizer } from "../services/categorizer/useMLCategorizer";
import { v4 as uuid } from "uuid";
import { useTheme } from "@/hooks/useTheme";
import { useAmountField } from "@/hooks/useAmountField";
import { DateField } from "@/components/DateField";
import { ChipRow } from "@/components/ChipRow";
import { MARKET_DATASET_CSV } from "../assets/datasets/market_dataset";
import { MIN_TOUCH, useTabBarSpace } from "@/constants/layout";

const NONE = "__none__";
const AI_DEBOUNCE_MS = 400;

export default function AddTransactionScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomSpace = useTabBarSpace();
  const addTransaction = useAppStore((s) => s.addTransaction);
  const categories     = useAppStore((s) => s.categories);
  const currency       = t("common.currency");

  const { categorize, correct, isReady } = useMLCategorizer({ datasetCSV: MARKET_DATASET_CSV });

  const [merchant, setMerchant]             = useState("");
  const amount                              = useAmountField();
  const [kind, setKind]                     = useState<TransactionKind>(TransactionKind.EXPENSE);
  const [date, setDate]                     = useState(() => new Date());
  const [note, setNote]                     = useState("");
  const [categoryId, setCategoryId]         = useState<string | undefined>();
  const [subcategoryId, setSubcategoryId]   = useState<string | undefined>();
  const [autoSuggest, setAutoSuggest]       = useState(true);
  // Once the user picks a category by hand, suggestions no longer overwrite it.
  const [userPicked, setUserPicked]         = useState(false);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [toastAnim]                         = useState(() => new Animated.Value(0));

  // B-13: only the latest request may apply its result, and nothing applies
  // after the form was saved or the screen unmounted.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef  = useRef(0);

  const cancelSuggestion = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    requestRef.current += 1;
    setIsCategorizing(false);
  };

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    requestRef.current += 1;
  }, []);

  const scheduleSuggestion = (newMerchant: string, newNote: string) => {
    if (!autoSuggest || !isReady || userPicked) return;
    cancelSuggestion();
    if (!newMerchant.trim()) return;
    const request = requestRef.current;
    debounceRef.current = setTimeout(async () => {
      setIsCategorizing(true);
      const res = await categorize(newMerchant, newNote, categories);
      if (request !== requestRef.current) return;
      if (res.confidence > 0.05) {
        setCategoryId(res.categoryId);
        setSubcategoryId(res.subcategoryId);
      }
      setIsCategorizing(false);
    }, AI_DEBOUNCE_MS);
  };

  const handleMerchantChange = (text: string) => {
    setMerchant(text);
    scheduleSuggestion(text, note);
  };

  const handleNoteChange = (text: string) => {
    setNote(text);
    scheduleSuggestion(merchant, text);
  };

  const handleAutoSuggest = (on: boolean) => {
    setAutoSuggest(on);
    if (on) {
      setUserPicked(false);
      scheduleSuggestion(merchant, note);
    } else {
      cancelSuggestion();
    }
  };

  const pickCategory = (key: string) => {
    cancelSuggestion();
    setUserPicked(true);
    setCategoryId(key === NONE ? undefined : key);
    setSubcategoryId(undefined);
  };

  const pickSubcategory = (key: string) => {
    cancelSuggestion();
    setUserPicked(true);
    const subId = key === NONE ? undefined : key;
    setSubcategoryId(subId);
    // Teach the model from a correction, when there is a merchant to learn from.
    if (subId && merchant.trim()) correct(merchant, note, subId);
  };

  const canSave = merchant.trim().length > 0 && amount.text.trim().length > 0;

  const save = () => {
    const value = amount.parse();
    if (value === null || !merchant.trim()) return;
    cancelSuggestion();
    addTransaction({
      id: uuid(),
      date: date.toISOString(),
      merchant: merchant.trim(),
      amount: value,
      kind,
      categoryId,
      subcategoryId,
      note,
      source: "Рачно",
    });
    setMerchant("");
    amount.reset();
    setNote("");
    setDate(new Date());
    setCategoryId(undefined);
    setSubcategoryId(undefined);
    setUserPicked(false);
    AccessibilityInfo.announceForAccessibility(t("add.saved"));
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(1200),
      Animated.timing(toastAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const selectedCat = findCategory(categories, categoryId);
  const kinds = [
    { label: t("add.expense"), value: TransactionKind.EXPENSE },
    { label: t("add.income"),  value: TransactionKind.INCOME  },
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]} accessibilityRole="header">
            {t("add.title")}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomSpace }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {/* Transaction card */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t("add.sections.transaction")}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder={t("add.merchant")}
                placeholderTextColor={colors.textTertiary}
                value={merchant}
                onChangeText={handleMerchantChange}
                returnKeyType="next"
                accessibilityLabel={t("add.merchantLabel")}
              />
              <View style={[styles.separator, { backgroundColor: colors.separator }]} />
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, { flex: 1, color: colors.text }]}
                  placeholder={t("add.amount")}
                  placeholderTextColor={colors.textTertiary}
                  value={amount.text}
                  onChangeText={amount.onChangeText}
                  keyboardType="number-pad"
                  accessibilityLabel={t("add.amount")}
                />
                <Text style={[styles.currency, { color: colors.textSecondary }]}>{currency}</Text>
              </View>
              {amount.errorText && (
                <Text style={[styles.fieldError, { color: colors.destructive }]}>{amount.errorText}</Text>
              )}
              <View style={[styles.separator, { backgroundColor: colors.separator }]} />
              <DateField label={t("history.date")} value={date} onChange={setDate} />
              <View style={[styles.separator, { backgroundColor: colors.separator }]} />
              <View style={[styles.segmentContainer, { backgroundColor: colors.inputBg }]} accessibilityRole="radiogroup">
                {kinds.map((k) => {
                  const selected = kind === k.value;
                  return (
                    <TouchableOpacity
                      key={k.value}
                      style={[styles.segment, selected && { backgroundColor: colors.accent }]}
                      onPress={() => setKind(k.value)}
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

          {/* Categorization: the suggestion is shown as the selected chip and can be corrected directly (U-8). */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t("add.sections.categorization")}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
              <View style={styles.switchRow}>
                <Ionicons name="sparkles" size={16} color={colors.accent} />
                <Text style={[styles.switchLabel, { color: colors.text }]}>{t("add.autoSuggest")}</Text>
                {isCategorizing && <ActivityIndicator size="small" color={colors.accent} />}
                <Switch
                  value={autoSuggest}
                  onValueChange={handleAutoSuggest}
                  trackColor={{ true: colors.accent }}
                  accessibilityLabel={t("add.autoSuggest")}
                />
              </View>
              <View style={[styles.separator, { backgroundColor: colors.separator }]} />
              <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>{t("add.sections.category")}</Text>
              <ChipRow
                accessibilityLabel={t("add.sections.category")}
                chips={[
                  { key: NONE, label: t("history.without") },
                  ...categories.map((c) => ({ key: c.id, label: categoryLabel(c, t), color: c.colorHex })),
                ]}
                selectedKey={categoryId ?? NONE}
                onSelect={pickCategory}
              />
              {selectedCat && selectedCat.subcategories.length > 0 && (
                <>
                  <View style={[styles.separator, { backgroundColor: colors.separator }]} />
                  <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>{t("add.sections.subcategory")}</Text>
                  <ChipRow
                    accessibilityLabel={t("add.sections.subcategory")}
                    chips={[
                      { key: NONE, label: t("add.withoutSub") },
                      ...selectedCat.subcategories.map((s) => ({ key: s.id, label: categoryLabel(s, t) })),
                    ]}
                    selectedKey={subcategoryId ?? NONE}
                    onSelect={pickSubcategory}
                  />
                </>
              )}
              {!categoryId && kind === TransactionKind.EXPENSE && (
                <Text style={[styles.hint, { color: colors.textSecondary }]}>
                  {autoSuggest && !merchant.trim() ? t("add.aiHint") : t("add.noCategoryHint")}
                </Text>
              )}
            </View>
          </View>

          {/* Note */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t("add.sections.note")}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
              <TextInput
                style={[styles.input, { minHeight: 60, color: colors.text }]}
                placeholder={t("history.optional")}
                placeholderTextColor={colors.textTertiary}
                value={note}
                onChangeText={handleNoteChange}
                multiline
                accessibilityLabel={t("add.sections.note")}
              />
            </View>
          </View>

          {/* Save, after everything it saves (U-8); clear enabled/disabled states (B-18). */}
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: canSave ? colors.accent : colors.inputBg }, canSave && [styles.saveShadow, { shadowColor: colors.accent }]]}
            onPress={save}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave }}
          >
            <Ionicons name="checkmark" size={20} color={canSave ? colors.onAccent : colors.textTertiary} />
            <Text style={[styles.saveButtonText, { color: canSave ? colors.onAccent : colors.textTertiary }]}>
              {t("add.saveTransaction")}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Outside the ScrollView so it stays in view (B-19). */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            { top: insets.top + 8, backgroundColor: colors.text, opacity: toastAnim },
          ]}
        >
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={[styles.toastText, { color: colors.background }]}>{t("add.saved")}</Text>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1 },
  header:      { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  headerTitle: { fontSize: 34, fontWeight: "700", letterSpacing: 0.3 },
  content:     { paddingHorizontal: 20, paddingTop: 16 },
  section:     { marginBottom: 16 },
  sectionHeader: {
    fontSize: 12, fontWeight: "600", marginBottom: 6,
    paddingHorizontal: 4, letterSpacing: 0.5,
  },
  card: {
    borderRadius: 16, overflow: "hidden",
    shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  input:     { paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  separator: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  row:       { flexDirection: "row", alignItems: "center" },
  currency:  { paddingRight: 16, fontSize: 15 },
  fieldError:{ fontSize: 13, paddingHorizontal: 16, paddingBottom: 10, marginTop: -4 },
  segmentContainer: { flexDirection: "row", margin: 10, borderRadius: 8, padding: 3 },
  segment: {
    flex: 1, minHeight: 36, borderRadius: 6,
    alignItems: "center", flexDirection: "row", justifyContent: "center",
  },
  segmentText: { fontSize: 14, fontWeight: "500" },
  switchRow:   { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, minHeight: MIN_TOUCH + 8 },
  switchLabel: { flex: 1, fontSize: 15 },
  pickerLabel: { fontSize: 13, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  hint:        { fontSize: 13, paddingHorizontal: 16, paddingBottom: 12 },
  saveButton: {
    borderRadius: 14, padding: 16, alignItems: "center", marginTop: 4, marginBottom: 16,
    flexDirection: "row", justifyContent: "center", gap: 8, minHeight: MIN_TOUCH,
  },
  saveShadow: { shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  saveButtonText: { fontSize: 17, fontWeight: "600" },
  toast: {
    position: "absolute", alignSelf: "center", zIndex: 100,
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 30,
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  toastText: { fontSize: 15, fontWeight: "500" },
});
