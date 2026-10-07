import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/useAppStore";
import { useTheme } from "../hooks/useTheme";
import { MAX_AMOUNT_MKD, formatWholeDenars, parseWholeDenars } from "../utils/money";
import { haptics } from "../utils/haptics";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { GUTTER, ROW_MIN, SECTION_GAP, corners, inputType, money, radius, space, tint, type } from "@/constants/design";

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const [balanceText, setBalanceText] = useState("");
  const [incomeText, setIncomeText]   = useState("");
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [incomeError, setIncomeError]   = useState<string | null>(null);

  // Returns the amount, or an error message for the field.
  const validate = (text: string, allowZero: boolean): number | string => {
    const amount = parseWholeDenars(text);
    if (amount === null) return t("settings.amountErrors.format");
    if (amount === 0 && !allowZero) return t("settings.amountErrors.positive");
    if (amount > MAX_AMOUNT_MKD) {
      return t("settings.amountErrors.tooLarge", { max: formatWholeDenars(MAX_AMOUNT_MKD) });
    }
    return amount;
  };

  const handleContinue = () => {
    const balance = validate(balanceText, true);
    // Income is optional; it can be set later in Settings.
    const income = incomeText.trim() === "" ? 0 : validate(incomeText, false);
    setBalanceError(typeof balance === "string" ? balance : null);
    setIncomeError(typeof income === "string" ? income : null);
    if (typeof balance === "string" || typeof income === "string") {
      haptics.error();
      return;
    }
    haptics.success();
    // The root layout's protected routes switch to the tabs once onboarded.
    completeOnboarding(balance, income);
  };

  const fields = [
    {
      key: "balance",
      label: t("onboarding.balanceLabel"),
      hint: t("onboarding.balanceHint"),
      value: balanceText,
      onChange: (v: string) => { setBalanceText(v); setBalanceError(null); },
      error: balanceError,
    },
    {
      key: "income",
      label: t("onboarding.incomeLabel"),
      hint: t("onboarding.incomeHint"),
      value: incomeText,
      onChange: (v: string) => { setIncomeText(v); setIncomeError(null); },
      error: incomeError,
    },
  ];

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]} behavior="padding">
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space[10], paddingBottom: insets.bottom + space[6] },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={styles.top}>
          <View style={[styles.badge, { backgroundColor: tint(colors.success, "soft") }]}>
            <Icon name="money" size={40} color={colors.success} />
          </View>
          <Text style={[type.largeTitle, styles.center, { color: colors.text }]} accessibilityRole="header">
            {t("onboarding.title")}
          </Text>
          <Text style={[type.body, styles.center, { color: colors.textSecondary }]}>{t("onboarding.subtitle")}</Text>
        </View>

        <View style={styles.fields}>
          {fields.map((f, i) => (
            <Section
              key={f.key}
              title={f.label}
              footer={f.error ?? f.hint}
              footerColor={f.error ? colors.destructive : undefined}
            >
              <View style={styles.inputRow}>
                <TextInput
                  style={[inputType(type.title1), money, styles.amountInput, { color: colors.text }]}
                  placeholder="0"
                  placeholderTextColor={colors.placeholder}
                  value={f.value}
                  onChangeText={f.onChange}
                  keyboardType="number-pad"
                  textAlign="right"
                  autoFocus={i === 0}
                  accessibilityLabel={f.label}
                  accessibilityHint={f.error ?? f.hint}
                />
                <Text style={[type.title3, { color: colors.textSecondary }]}>{t("common.currency")}</Text>
              </View>
            </Section>
          ))}
        </View>

        <Button title={t("onboarding.continue")} onPress={handleContinue} disabled={!balanceText} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:        { flex: 1 },
  center:      { textAlign: "center" },
  content:     { flexGrow: 1, paddingHorizontal: GUTTER, justifyContent: "space-between", gap: space[8] },
  top:         { alignItems: "center", gap: space[3] },
  badge:       { width: 80, height: 80, alignItems: "center", justifyContent: "center", marginBottom: space[2], ...corners(radius.xl) },
  fields:      { gap: SECTION_GAP },
  inputRow:    { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], minHeight: ROW_MIN + 24 },
  amountInput: { flex: 1, minWidth: 0, paddingVertical: space[3] },
});
