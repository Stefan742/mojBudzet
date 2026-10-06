import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/useAppStore";
import { useTheme } from "../hooks/useTheme";
import { MAX_AMOUNT_MKD, formatWholeDenars, parseWholeDenars } from "../utils/money";

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
    if (typeof balance === "string" || typeof income === "string") return;

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
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.card }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.inner,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.top}>
          <Ionicons name="cash" size={72} color="#4CAF50" />
          <Text style={[styles.title, { color: colors.text }]}>{t("onboarding.title")}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t("onboarding.subtitle")}
          </Text>
        </View>

        <View style={styles.fields}>
          {fields.map((f, i) => (
            <View key={f.key} style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>{f.label}</Text>
              <View style={[styles.inputCard, { backgroundColor: colors.inputBg }]}>
                <TextInput
                  style={[styles.amountInput, { color: colors.text }]}
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                  value={f.value}
                  onChangeText={f.onChange}
                  keyboardType="number-pad"
                  textAlign="right"
                  autoFocus={i === 0}
                  accessibilityLabel={f.label}
                />
                <Text style={[styles.currency, { color: colors.textSecondary }]}>
                  {t("common.currency")}
                </Text>
              </View>
              <Text
                style={[
                  styles.fieldHint,
                  { color: f.error ? colors.destructive : colors.textTertiary },
                ]}
              >
                {f.error ?? f.hint}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: colors.accent },
            !balanceText && styles.buttonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!balanceText}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{t("onboarding.continue")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
    gap: 32,
  },
  top: {
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    marginTop: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
  fields: {
    gap: 20,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: "600",
    paddingHorizontal: 4,
  },
  fieldHint: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  inputCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  amountInput: {
    flex: 1,
    fontSize: 30,
    fontWeight: "700",
  },
  currency: {
    fontSize: 20,
    fontWeight: "500",
  },
  button: {
    borderRadius: 14,
    padding: 18,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
});
