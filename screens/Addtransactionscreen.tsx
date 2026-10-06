import React, { useState, useRef, useCallback, useEffect } from "react";
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
  Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/useAppStore";
import { TransactionKind } from "../models";
import { findCategory } from "../store/selectors";
import { useMLCategorizer } from "../services/categorizer/useMLCategorizer";
import { v4 as uuid } from "uuid";
import { useTheme } from "@/hooks/useTheme";
import { MARKET_DATASET_CSV } from "../assets/datasets/market_dataset";

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AddTransactionScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const addTransaction = useAppStore((s) => s.addTransaction);
  const categories     = useAppStore((s) => s.categories);
  const currency       = t("common.currency");
  const insets         = useSafeAreaInsets();

  const { categorize, correct, isReady } = useMLCategorizer({ datasetCSV: MARKET_DATASET_CSV });

  const [merchant, setMerchant]             = useState("");
  const [amountText, setAmountText]         = useState("");
  const [kind, setKind]                     = useState<TransactionKind>(TransactionKind.EXPENSE);
  const [note, setNote]                     = useState("");
  const [categoryId, setCategoryId]         = useState<string | undefined>();
  const [subcategoryId, setSubcategoryId]   = useState<string | undefined>();
  const [useAI, setUseAI]                   = useState(true);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [showToast, setShowToast]           = useState(false);

  const toastAnim   = useRef(new Animated.Value(0)).current;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const KINDS = [
    { label: t("add.expense"), value: TransactionKind.EXPENSE },
    { label: t("add.income"),  value: TransactionKind.INCOME  },
  ];

  const canSave =
    merchant.trim().length > 0 &&
    (parseFloat(amountText.replace(",", ".")) || 0) > 0;

  // ── AI categorization ─────────────────────────────────────────────────────
  const scheduleAI = useCallback(
    (newMerchant: string, newNote: string) => {
      if (!useAI || !isReady) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        if (!newMerchant.trim()) return;
        setIsCategorizing(true);
        const res = await categorize(newMerchant, newNote, categories);
        if (res.confidence > 0.05) {
          setCategoryId(res.categoryId);
          setSubcategoryId(res.subcategoryId);
        }
        setIsCategorizing(false);
      }, 400);
    },
    [useAI, isReady, categories, categorize]
  );

  const handleMerchantChange = (text: string) => {
    setMerchant(text);
    scheduleAI(text, note);
  };

  const handleNoteChange = (text: string) => {
    setNote(text);
    scheduleAI(merchant, text);
  };

  const handleSwitchMode = (val: boolean) => {
    setUseAI(val);
    if (val) scheduleAI(merchant, note);
    else { setCategoryId(undefined); setSubcategoryId(undefined); }
  };

  // ── Called when user manually picks a different subcategory ───────────────
  const handleManualSubcategoryPick = (subId: string) => {
    setSubcategoryId(subId);
    // teach the model only if there's a merchant to learn from
    if (merchant.trim()) {
      correct(merchant, note, subId);
    }
  };

  const save = () => {
    const amount = parseFloat(amountText.replace(",", ".")) || 0;
    addTransaction({
      id: uuid(),
      date: new Date().toISOString(),
      merchant,
      amount,
      kind,
      categoryId,
      subcategoryId,
      note,
      source: "Рачно",
    });
    setMerchant("");
    setAmountText("");
    setNote("");
    setCategoryId(undefined);
    setSubcategoryId(undefined);
    setShowToast(true);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(1200),
      Animated.timing(toastAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setShowToast(false));
  };

  const selectedCat = findCategory(categories, categoryId);
  const selectedSub = selectedCat?.subcategories.find((s) => s.id === subcategoryId);

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t("add.title")}</Text>
          </View>

          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 72 + 34 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {showToast && (
              <Animated.View style={[styles.toast, { opacity: toastAnim }]}>
                <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
                <Text style={styles.toastText}>{t("add.saved")}</Text>
              </Animated.View>
            )}

            {/* Transaction card */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                {t("add.sections.transaction")}
              </Text>
              <View style={[styles.card, { backgroundColor: colors.card }]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder={t("add.merchant")}
                  placeholderTextColor={colors.textTertiary}
                  value={merchant}
                  onChangeText={handleMerchantChange}
                />
                <View style={[styles.separator, { backgroundColor: colors.separator }]} />
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, { flex: 1, color: colors.text }]}
                    placeholder={t("add.amount")}
                    placeholderTextColor={colors.textTertiary}
                    value={amountText}
                    onChangeText={setAmountText}
                    keyboardType="decimal-pad"
                  />
                  <Text style={[styles.currency, { color: colors.textSecondary }]}>{currency}</Text>
                </View>
                <View style={[styles.separator, { backgroundColor: colors.separator }]} />
                <View style={[styles.segmentContainer, { backgroundColor: colors.inputBg }]}>
                  {KINDS.map((k) => (
                    <TouchableOpacity
                      key={k.value}
                      style={[styles.segment, kind === k.value && { backgroundColor: colors.accent }]}
                      onPress={() => setKind(k.value)}
                    >
                      <Text style={[styles.segmentText, { color: kind === k.value ? "#fff" : colors.textSecondary }]}>
                        {k.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Save button */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                !canSave && styles.saveButtonDisabled,
                { backgroundColor: canSave ? colors.accent : colors.card },
              ]}
              onPress={save}
              disabled={!canSave}
            >
              <Ionicons name="checkmark" size={20} style={{color: colors.text}} />
              <Text style={{color: colors.text}}>{t("add.saveTransaction")}</Text>
            </TouchableOpacity>

            {/* Categorization */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                {t("add.sections.categorization")}
              </Text>
              <View style={[styles.card, { backgroundColor: colors.card }]}>
                <View style={[styles.segmentContainer, { backgroundColor: colors.inputBg }]}>
                  <TouchableOpacity
                    style={[styles.segment, useAI && { backgroundColor: colors.accent }]}
                    onPress={() => handleSwitchMode(true)}
                  >
                    <Ionicons name="sparkles" size={14} color={useAI ? "#fff" : colors.textSecondary} />
                    <Text style={[styles.segmentText, { color: useAI ? "#fff" : colors.textSecondary }]}>
                      {" "}{t("add.ai")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.segment, !useAI && { backgroundColor: colors.accent }]}
                    onPress={() => handleSwitchMode(false)}
                  >
                    <Text style={[styles.segmentText, { color: !useAI ? "#fff" : colors.textSecondary }]}>
                      {t("add.manual")}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.separator, { backgroundColor: colors.separator }]} />
                {useAI ? (
                  <View style={styles.aiRow}>
                    {isCategorizing ? (
                      <>
                        <ActivityIndicator size="small" color={colors.accent} />
                        <Text style={[styles.aiLabel, { color: colors.textSecondary }]}>
                          {" "}{t("add.aiCategorizing")}
                        </Text>
                      </>
                    ) : selectedCat ? (
                      <>
                        <Ionicons name="sparkles" size={16} color={colors.accent} />
                        <Text style={[styles.aiLabel, { color: colors.accent }]}>
                          {" "}{selectedCat.name}
                        </Text>
                        {selectedSub && (
                          <Text style={[styles.aiSub, { color: colors.textTertiary }]}>
                            {" "}· {selectedSub.name}
                          </Text>
                        )}
                      </>
                    ) : (
                      <Text style={[styles.aiPlaceholder, { color: colors.textTertiary }]}>
                        {t("add.aiHint")}
                      </Text>
                    )}
                  </View>
                ) : (
                  <>
                    <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>
                      {t("add.sections.category")}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                      <TouchableOpacity
                        style={[styles.chip, { backgroundColor: !categoryId ? colors.accent : colors.inputBg }]}
                        onPress={() => { setCategoryId(undefined); setSubcategoryId(undefined); }}
                      >
                        <Text style={[styles.chipText, { color: !categoryId ? "#fff" : colors.text }]}>
                          {t("add.chooseCategory")}
                        </Text>
                      </TouchableOpacity>
                      {categories.map((c) => (
                        <TouchableOpacity
                          key={c.id}
                          style={[styles.chip, { backgroundColor: categoryId === c.id ? c.colorHex : colors.inputBg }]}
                          onPress={() => { setCategoryId(c.id); setSubcategoryId(undefined); }}
                        >
                          <Text style={[styles.chipText, { color: categoryId === c.id ? "#fff" : colors.text }]}>
                            {c.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    {selectedCat && selectedCat.subcategories.length > 0 && (
                      <>
                        <View style={[styles.separator, { backgroundColor: colors.separator }]} />
                        <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>
                          {t("add.sections.subcategory")}
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                          <TouchableOpacity
                            style={[styles.chip, { backgroundColor: !subcategoryId ? colors.accent : colors.inputBg }]}
                            onPress={() => setSubcategoryId(undefined)}
                          >
                            <Text style={[styles.chipText, { color: !subcategoryId ? "#fff" : colors.text }]}>
                              {t("add.withoutSub")}
                            </Text>
                          </TouchableOpacity>
                          {selectedCat.subcategories.map((s) => (
                            <TouchableOpacity
                              key={s.id}
                              style={[styles.chip, { backgroundColor: subcategoryId === s.id ? colors.accent : colors.inputBg }]}
                              onPress={() => handleManualSubcategoryPick(s.id)}
                            >
                              <Text style={[styles.chipText, { color: subcategoryId === s.id ? "#fff" : colors.text }]}>
                                {s.name}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </>
                    )}
                  </>
                )}
              </View>
            </View>

            {/* Note */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                {t("add.sections.note")}
              </Text>
              <View style={[styles.card, { backgroundColor: colors.card }]}>
                <TextInput
                  style={[styles.input, { minHeight: 60, color: colors.text }]}
                  placeholder={t("history.optional")}
                  placeholderTextColor={colors.textTertiary}
                  value={note}
                  onChangeText={handleNoteChange}
                  multiline
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

    </>
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
  scanBtn: {
    flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16,
    padding: 14, marginBottom: 16, borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  scanBtnIcon:     { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  scanBtnTextWrap: { flex: 1 },
  scanBtnTitle:    { fontSize: 15, fontWeight: "600" },
  scanBtnSub:      { fontSize: 12, marginTop: 1 },
  card: {
    borderRadius: 16, overflow: "hidden", shadowColor: "#000",
    shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  input:    { paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  separator: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  row:      { flexDirection: "row", alignItems: "center" },
  currency: { paddingRight: 16, fontSize: 15 },
  segmentContainer: { flexDirection: "row", margin: 10, borderRadius: 8, padding: 3 },
  segment: {
    flex: 1, paddingVertical: 8, borderRadius: 6,
    alignItems: "center", flexDirection: "row", justifyContent: "center",
  },
  segmentText: { fontSize: 14, fontWeight: "500" },
  saveButton: {
    borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 16,
    flexDirection: "row", justifyContent: "center", gap: 8,
    shadowColor: "#007AFF", shadowOpacity: 0.3, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  saveButtonDisabled: { backgroundColor: "#3a3a3c", shadowOpacity: 0 },
  saveButtonText: { color: "#fff", fontSize: 17, fontWeight: "400" },
  aiRow:        { flexDirection: "row", alignItems: "center", padding: 14 },
  aiLabel:      { fontSize: 15 },
  aiSub:        { fontSize: 14 },
  aiPlaceholder:{ fontSize: 14, padding: 14 },
  pickerLabel:  { fontSize: 13, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, color: "#8e8e93" },
  chipScroll:   { paddingHorizontal: 12, paddingBottom: 12 },
  chip:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, marginTop: 4 },
  chipText:     { fontSize: 14 },
  toast: {
    position: "absolute", top: 10, alignSelf: "center", zIndex: 100,
    backgroundColor: "rgba(0,0,0,0.75)", paddingHorizontal: 20,
    paddingVertical: 10, borderRadius: 30, flexDirection: "row", alignItems: "center", gap: 6,
  },
  toastText: { color: "#fff", fontSize: 15, fontWeight: "500" },
});
