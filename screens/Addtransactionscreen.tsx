import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Pressable,
  Keyboard,
  InputAccessoryView,
} from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/useAppStore";
import { showToast } from "../store/session";
import { INCOME_TYPES, IncomeType, TransactionKind, categoryLabel } from "../models";
import { findCategory } from "../store/selectors";
import { useMLCategorizer } from "../services/categorizer/useMLCategorizer";
import { v4 as uuid } from "uuid";
import { haptics } from "../utils/haptics";
import { useTheme } from "@/hooks/useTheme";
import { amountKeyboard, useCurrency } from "@/hooks/useCurrency";
import { useAmountField } from "@/hooks/useAmountField";
import { DateField } from "@/components/DateField";
import { ChipRow } from "@/components/ChipRow";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/Button";
import { Section, Separator } from "@/components/ui/Section";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { MARKET_DATASET_CSV } from "../assets/datasets/market_dataset";
import { GUTTER, ROW_MIN, SECTION_GAP, inputType, money, space, type } from "@/constants/design";

const NONE = "__none__";
const AI_DEBOUNCE_MS = 400;
/**
 * iOS keyboard toolbars that carry the Save button, one per field: React
 * Native (New Architecture) attaches an InputAccessoryView only to the first
 * text input with its ID, so a shared ID left the amount pad without one.
 */
const ACCESSORY = {
  merchant: "add-save-merchant",
  amount:   "add-save-amount",
  note:     "add-save-note",
} as const;

export default function AddTransactionScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const addTransaction = useAppStore((s) => s.addTransaction);
  const categories     = useAppStore((s) => s.categories);
  const currency       = useCurrency();

  const { categorize, correct, isReady } = useMLCategorizer({ datasetCSV: MARKET_DATASET_CSV });

  const [merchant, setMerchant]             = useState("");
  const amount                              = useAmountField();
  const [kind, setKind]                     = useState<TransactionKind>(TransactionKind.EXPENSE);
  const [date, setDate]                     = useState(() => new Date());
  const [note, setNote]                     = useState("");
  const [categoryId, setCategoryId]         = useState<string | undefined>();
  const [subcategoryId, setSubcategoryId]   = useState<string | undefined>();
  const [incomeType, setIncomeType]         = useState<IncomeType | undefined>();
  const [autoSuggest, setAutoSuggest]       = useState(true);
  // Once the user picks a category by hand, suggestions no longer overwrite it.
  const [userPicked, setUserPicked]         = useState(false);
  const [isCategorizing, setIsCategorizing] = useState(false);

  // B-13: only the latest request may apply its result, and nothing applies
  // after the form was saved or the screen unmounted.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef  = useRef(0);
  const amountRef   = useRef<TextInput>(null);

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

  // Categories are for spending; income gets a source instead, picked by hand.
  const scheduleSuggestion = (newMerchant: string, newNote: string, forKind = kind) => {
    if (forKind !== TransactionKind.EXPENSE || !autoSuggest || !isReady || userPicked) return;
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

  const changeKind = (next: TransactionKind) => {
    setKind(next);
    if (next === TransactionKind.EXPENSE) scheduleSuggestion(merchant, note, next);
    else cancelSuggestion();
  };

  const pickIncomeType = (key: string) => {
    setIncomeType(key === NONE ? undefined : (key as IncomeType));
  };

  const isIncome = kind === TransactionKind.INCOME;
  const canSave = merchant.trim().length > 0 && amount.text.trim().length > 0;

  const save = () => {
    const value = amount.parse();
    if (value === null || !merchant.trim()) {
      haptics.error();
      return;
    }
    cancelSuggestion();
    addTransaction({
      id: uuid(),
      date: date.toISOString(),
      merchant: merchant.trim(),
      amount: value,
      kind,
      // The store drops whichever of these does not belong to the kind.
      categoryId,
      subcategoryId,
      incomeType,
      note,
      source: "Рачно",
    });
    setMerchant("");
    amount.reset();
    setNote("");
    setDate(new Date());
    setCategoryId(undefined);
    setSubcategoryId(undefined);
    setIncomeType(undefined);
    setUserPicked(false);
    Keyboard.dismiss();
    haptics.success();
    showToast(t("add.saved"));
  };

  const selectedCat = findCategory(categories, categoryId);
  const hint =
    !categoryId && kind === TransactionKind.EXPENSE
      ? autoSuggest && !merchant.trim() ? t("add.aiHint") : t("add.noCategoryHint")
      : null;

  const form = (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      {/* Kind first: it decides what the amount means. */}
      <SegmentedControl
        options={[
          { value: TransactionKind.EXPENSE, label: t("add.expense") },
          { value: TransactionKind.INCOME, label: t("add.income") },
        ]}
        value={kind}
        onChange={changeKind}
      />

      <Section title={t("add.sections.transaction")} footer={amount.errorText} footerColor={colors.destructive}>
        <TextInput
          style={[inputType(type.body), styles.input, { color: colors.text }]}
          placeholder={isIncome ? t("add.payer") : t("add.merchant")}
          placeholderTextColor={colors.placeholder}
          value={merchant}
          onChangeText={handleMerchantChange}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => amountRef.current?.focus()}
          inputAccessoryViewID={ACCESSORY.merchant}
          accessibilityLabel={isIncome ? t("add.payerLabel") : t("add.merchantLabel")}
        />
        <Separator />
        <View style={styles.amountRow}>
          <TextInput
            ref={amountRef}
            style={[inputType(type.title2), money, styles.amountInput, { color: colors.text }]}
            placeholder={t("add.amount")}
            placeholderTextColor={colors.placeholder}
            value={amount.text}
            onChangeText={amount.onChangeText}
            keyboardType={amountKeyboard(currency)}
            // Android's number pad has a Done key; iOS uses the toolbar below.
            returnKeyType="done"
            onSubmitEditing={() => { if (canSave) save(); }}
            inputAccessoryViewID={ACCESSORY.amount}
            accessibilityLabel={t("add.amount")}
          />
          <Text style={[type.body, { color: colors.textSecondary }]}>{currency.label}</Text>
        </View>
        <Separator />
        <DateField label={t("history.date")} value={date} onChange={setDate} />
      </Section>

      {isIncome ? (
        <Section title={t("add.sections.source")}>
          <View style={styles.sourceChips}>
            <ChipRow
              accessibilityLabel={t("add.source")}
              chips={[
                { key: NONE, label: t("history.without") },
                ...INCOME_TYPES.map((key) => ({ key, label: t(`incomeTypes.${key}`) })),
              ]}
              selectedKey={incomeType ?? NONE}
              onSelect={pickIncomeType}
            />
          </View>
        </Section>
      ) : (
        // The suggestion is the selected chip and can be corrected directly (U-8).
        <Section title={t("add.sections.categorization")} footer={hint}>
          <View style={styles.switchRow}>
            <Icon name="sparkles" size={18} color={colors.accent} />
            <Text style={[type.body, styles.switchLabel, { color: colors.text }]} numberOfLines={1}>
              {t("add.autoSuggestShort")}
            </Text>
            {isCategorizing && <ActivityIndicator size="small" color={colors.accent} />}
            {/* Fixed slot: the iOS 26 switch is larger than the frame React Native
                reserves for it, so centre it in a known box instead of letting it drift. */}
            <View style={styles.switchSlot}>
              <Switch
                value={autoSuggest}
                onValueChange={handleAutoSuggest}
                trackColor={{ true: colors.success }}
                accessibilityLabel={t("add.autoSuggest")}
              />
            </View>
          </View>
          <Separator />
          <Text style={[type.footnote, styles.pickerLabel, { color: colors.textSecondary }]}>{t("add.sections.category")}</Text>
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
              <Separator />
              <Text style={[type.footnote, styles.pickerLabel, { color: colors.textSecondary }]}>{t("add.sections.subcategory")}</Text>
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
        </Section>
      )}

      <Section title={t("add.sections.note")}>
        <TextInput
          style={[inputType(type.body), styles.input, styles.note, { color: colors.text }]}
          placeholder={t("history.optional")}
          placeholderTextColor={colors.placeholder}
          value={note}
          onChangeText={handleNoteChange}
          multiline
          inputAccessoryViewID={ACCESSORY.note}
          accessibilityLabel={t("add.sections.note")}
        />
      </Section>
    </ScrollView>
  );

  // Save is always one tap away, never below the fold: in the navigation bar
  // (the iOS place for a form's confirming action) and, while typing on iOS,
  // in a toolbar on top of the keyboard.
  const header = (
    <Stack.Screen
      options={{
        headerRight: () => (
          <Pressable
            onPress={save}
            disabled={!canSave}
            hitSlop={8}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel={t("add.saveTransaction")}
            accessibilityState={{ disabled: !canSave }}
          >
            <Text style={[type.headline, { color: canSave ? colors.accent : colors.placeholder }]}>
              {t("add.saveShort")}
            </Text>
          </Pressable>
        ),
      }}
    />
  );

  // iOS adjusts the scroll view for the keyboard itself, which keeps it the
  // screen's first child (needed for the collapsing large title).
  if (Platform.OS === "ios") {
    return (
      <>
        {header}
        {form}
        {Object.values(ACCESSORY).map((id) => (
          <InputAccessoryView key={id} nativeID={id} backgroundColor={colors.background}>
            <View style={styles.accessory}>
              <Button title={t("add.saveTransaction")} icon="check" onPress={save} disabled={!canSave} />
            </View>
          </InputAccessoryView>
        ))}
      </>
    );
  }
  return (
    <>
      {header}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">{form}</KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex:        { flex: 1 },
  content:     { paddingHorizontal: GUTTER, paddingTop: space[2], paddingBottom: space[8], gap: SECTION_GAP },
  input:       { paddingHorizontal: space[4], paddingVertical: space[3], minHeight: ROW_MIN },
  note:        { minHeight: 88, textAlignVertical: "top" },
  amountRow:   { flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[4], minHeight: ROW_MIN + 12 },
  amountInput: { flex: 1, minWidth: 0, paddingVertical: space[2] },
  headerButton: { paddingHorizontal: space[2], minHeight: 36, justifyContent: "center" },
  accessory:   { paddingHorizontal: GUTTER, paddingVertical: space[2] },
  switchRow:   { flexDirection: "row", alignItems: "center", gap: space[3], paddingLeft: space[4], paddingRight: space[3], paddingVertical: space[1] + 2, minHeight: ROW_MIN + 8 },
  switchLabel: { flex: 1 },
  switchSlot:  { width: 64, height: 40, alignItems: "center", justifyContent: "center" },
  pickerLabel: { paddingHorizontal: space[4], paddingTop: space[3], paddingBottom: space[1] },
  sourceChips: { paddingTop: space[2] },
});
