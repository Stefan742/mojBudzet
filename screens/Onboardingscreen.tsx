import React, { useEffect, useMemo, useState } from "react";
import { BackHandler, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInLeft, FadeInRight } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { v4 as uuid } from "uuid";
import { TransactionKind, firstAfter } from "../models";
import { useAppStore } from "../store/useAppStore";
import { useSession } from "../store/session";
import { generateBudgetSuggestion } from "../services/budgetSuggestionEngine";
import { requestReminderPermission } from "../services/reminders";
import { formatMoney, validateAmount } from "../utils/money";
import { haptics } from "../utils/haptics";
import { useTheme } from "@/hooks/useTheme";
import { amountErrorText, useCurrency } from "@/hooks/useCurrency";
import { CurrencyPicker } from "@/components/CurrencyPicker";
import { OnboardingFooter, OnboardingTopBar, StepHeading } from "@/components/onboarding/Chrome";
import { PlanHero, PrivateHero, TrackHero, WelcomeHero } from "@/components/onboarding/Heroes";
import { BILL_PRESETS, BillChoice } from "@/components/onboarding/presets";
import {
  BalanceStep,
  BillsStep,
  BudgetStep,
  DoneStep,
  RemindersPreview,
  SalaryStep,
  SummaryRow,
} from "@/components/onboarding/Steps";
import { GUTTER, SECTION_GAP, space, type } from "@/constants/design";

/**
 * First run, in the manner of Apple's Setup Assistant:
 * - Welcome, then three short pages on how the app works (each skippable);
 * - setup that turns answers into the user's real starting point: currency
 *   and balance (required), salary and payday, regular payments, a budget and
 *   reminders (each optional, and only shown when it applies);
 * - a summary, ending on the first real action.
 * Nothing is saved before the last screen, so Back and Skip are always safe.
 */

type StepId = "welcome" | "track" | "plan" | "private" | "balance" | "salary" | "bills" | "budget" | "reminders" | "done";

const EXPLAIN: StepId[] = ["track", "plan", "private"];
const SETUP: StepId[] = ["balance", "salary", "bills", "budget", "reminders"];

/** The steps for what the user has entered so far. */
const stepsFor = (hasSalary: boolean, hasBills: boolean): StepId[] => [
  "welcome",
  ...EXPLAIN,
  "balance",
  "salary",
  "bills",
  ...(hasSalary ? (["budget"] as StepId[]) : []),
  ...(hasSalary || hasBills ? (["reminders"] as StepId[]) : []),
  "done",
];

export default function OnboardingScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const currency = useCurrency();
  const categories  = useAppStore((s) => s.categories);
  const setCurrency = useAppStore((s) => s.setCurrency);
  const setLanguage = useAppStore((s) => s.setLanguage);

  const [step, setStep]       = useState<StepId>("welcome");
  const [forward, setForward] = useState(true);
  const [pickingCurrency, setPickingCurrency] = useState(false);

  const [balanceText, setBalanceText]   = useState("");
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [salaryText, setSalaryText]     = useState("");
  const [salaryError, setSalaryError]   = useState<string | null>(null);
  const [payday, setPayday]             = useState(() => new Date().getDate());
  const [bills, setBills]               = useState<Record<string, BillChoice>>({});
  const [billErrors, setBillErrors]     = useState<string[]>([]);
  const [applyBudget, setApplyBudget]   = useState(false);
  // Undefined: never asked here (the first repeating item asks later).
  const [reminders, setReminders]       = useState<boolean | undefined>();

  const read = (text: string, allowZero: boolean) => {
    const r = validateAmount(text, currency, { allowZero });
    return "amount" in r ? r.amount : null;
  };
  const balance = read(balanceText, true) ?? 0;
  const salary = salaryText.trim() ? read(salaryText, false) ?? 0 : 0;
  const hasBills = Object.keys(bills).length > 0;

  const steps = stepsFor(salary > 0, hasBills);
  const index = steps.indexOf(step);
  const setupSteps = steps.filter((s) => SETUP.includes(s));
  const setupIndex = setupSteps.indexOf(step);

  const suggestions = useMemo(
    () => (salary > 0 ? generateBudgetSuggestion({ income: salary, categories, transactions: [] }) : []),
    [salary, categories]
  );

  const go = (to: StepId, isForward = true) => {
    haptics.selection();
    Keyboard.dismiss();
    setForward(isForward);
    setStep(to);
  };
  const next = (after = steps) => go(after[after.indexOf(step) + 1]);
  const back = () => index > 0 && go(steps[index - 1], false);

  // Android's back button walks back through the steps.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (index === 0) return false;
      back();
      return true;
    });
    return () => sub.remove();
  });

  // ── Step actions ───────────────────────────────────────────────────────────

  const continueBalance = () => {
    const r = validateAmount(balanceText, currency, { allowZero: true });
    if ("error" in r) {
      haptics.error();
      setBalanceError(amountErrorText(t, r.error, currency));
      return;
    }
    next();
  };

  const continueSalary = () => {
    if (salaryText.trim()) {
      const r = validateAmount(salaryText, currency, { allowZero: false });
      if ("error" in r) {
        haptics.error();
        setSalaryError(amountErrorText(t, r.error, currency));
        return;
      }
    }
    next();
  };

  const skipSalary = () => {
    setSalaryText("");
    setSalaryError(null);
    next(stepsFor(false, hasBills));
  };

  const toggleBill = (id: string) =>
    setBills((current) => {
      const { [id]: existing, ...rest } = current;
      if (existing) return rest;
      const preset = BILL_PRESETS.find((p) => p.id === id)!;
      return { ...current, [id]: { amountText: "", day: preset.day, variable: preset.variable } };
    });

  const continueBills = () => {
    // A fixed payment needs its amount; a changing one is asked for each month.
    const missing = Object.entries(bills)
      .filter(([, c]) => !c.variable && !(read(c.amountText, false) ?? 0))
      .map(([id]) => id);
    setBillErrors(missing);
    if (missing.length) {
      haptics.error();
      return;
    }
    next();
  };

  const skipBills = () => {
    setBills({});
    setBillErrors([]);
    next(stepsFor(salary > 0, false));
  };

  const decideBudget = (apply: boolean) => {
    setApplyBudget(apply);
    next();
  };

  const decideReminders = async (on: boolean) => {
    setReminders(on ? await requestReminderPermission() : false);
    next();
  };

  // Everything is saved at once; completing onboarding swaps to the tabs.
  const finish = (route: "/add" | "/") => {
    const s = useAppStore.getState();
    for (const preset of BILL_PRESETS) {
      const c = bills[preset.id];
      if (!c) continue;
      const parent = s.categories.find((cat) => cat.subcategories.some((sub) => sub.id === preset.subcategoryId));
      s.saveRecurring({
        id: uuid(),
        kind: TransactionKind.EXPENSE,
        merchant: t(preset.nameKey),
        amount: read(c.amountText, true) ?? 0,
        variable: c.variable,
        categoryId: parent?.id,
        subcategoryId: parent ? preset.subcategoryId : undefined,
        note: "",
        frequency: "monthly",
        day: c.day,
        ask: true,
        paused: false,
        // This month's payment, if it was due already, is in today's balance.
        nextDate: firstAfter({ frequency: "monthly", day: c.day }, new Date()),
      });
    }
    if (applyBudget && suggestions.length) s.applyBudgetSuggestions(suggestions);
    if (reminders !== undefined) s.setRemindersEnabled(reminders);
    useSession.getState().setPendingRoute(route === "/add" ? "/add" : null);
    haptics.success();
    s.completeOnboarding(balance, salary > 0 ? { amount: salary, day: payday, name: t("incomeTypes.salary") } : undefined);
  };

  // ── Screens ────────────────────────────────────────────────────────────────

  const explain = (hero: React.ReactNode, key: "track" | "plan" | "private") => (
    <View style={styles.explain}>
      <View style={styles.hero}>{hero}</View>
      <View style={styles.copy}>
        <Text style={[type.title1, styles.center, { color: colors.text }]} accessibilityRole="header">
          {t(`onboarding.${key}.title`)}
        </Text>
        <Text style={[type.body, styles.center, { color: colors.textSecondary }]}>{t(`onboarding.${key}.body`)}</Text>
      </View>
    </View>
  );

  const setup = (heading: React.ReactNode, body: React.ReactNode) => (
    <ScrollView
      contentContainerStyle={styles.setup}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      {heading}
      {body}
    </ScrollView>
  );

  const summary: SummaryRow[] = [
    { key: "balance", icon: "wallet", color: colors.accent, text: t("onboarding.done.balance", { amount: formatMoney(balance, currency) }) },
    ...(salary > 0
      ? [{ key: "salary", icon: "income" as const, color: colors.success, text: t("onboarding.done.salary", { amount: formatMoney(salary, currency), day: payday }) }]
      : []),
    ...(hasBills ? [{ key: "bills", icon: "repeat" as const, color: "#5856D6", text: t("onboarding.done.bills", { count: Object.keys(bills).length }) }] : []),
    ...(applyBudget && suggestions.length
      ? [{ key: "budget", icon: "chart" as const, color: colors.warning, text: t("onboarding.done.budget", { count: suggestions.length }) }]
      : []),
    ...(reminders ? [{ key: "reminders", icon: "bell" as const, color: colors.destructive, text: t("onboarding.done.reminders") }] : []),
  ];

  let content: React.ReactNode;
  let footer: React.ComponentProps<typeof OnboardingFooter>;
  switch (step) {
    case "welcome":
      content = (
        <View style={styles.explain}>
          <View style={styles.hero}><WelcomeHero /></View>
          <View style={styles.copy}>
            <Text style={[type.largeTitle, styles.center, { color: colors.text }]} accessibilityRole="header">
              {t("onboarding.welcome.title")}
            </Text>
            <Text style={[type.body, styles.center, { color: colors.textSecondary }]}>{t("onboarding.welcome.body")}</Text>
          </View>
        </View>
      );
      footer = {
        primary: { title: t("onboarding.welcome.start"), onPress: () => next() },
        secondary: {
          // Switches to the other language; Settings has the full choice.
          title: i18n.language.startsWith("en") ? "Македонски" : "English",
          onPress: () => setLanguage(i18n.language.startsWith("en") ? "mk" : "en"),
        },
      };
      break;
    case "track":
      content = explain(<TrackHero />, "track");
      footer = { primary: { title: t("onboarding.next"), onPress: () => next() } };
      break;
    case "plan":
      content = explain(<PlanHero />, "plan");
      footer = { primary: { title: t("onboarding.next"), onPress: () => next() } };
      break;
    case "private":
      content = explain(<PrivateHero />, "private");
      footer = { primary: { title: t("onboarding.private.start"), onPress: () => next() } };
      break;
    case "balance":
      content = setup(
        <StepHeading icon="wallet" color={colors.accent} title={t("onboarding.balance.title")} body={t("onboarding.balance.body")} />,
        <BalanceStep
          text={balanceText}
          error={balanceError}
          onChange={(v) => { setBalanceText(v); setBalanceError(null); }}
          onPickCurrency={() => setPickingCurrency(true)}
        />
      );
      footer = { primary: { title: t("onboarding.continue"), onPress: continueBalance, disabled: !balanceText.trim() } };
      break;
    case "salary":
      content = setup(
        <StepHeading icon="income" color={colors.success} title={t("onboarding.salary.title")} body={t("onboarding.salary.body")} />,
        <SalaryStep
          text={salaryText}
          error={salaryError}
          onChange={(v) => { setSalaryText(v); setSalaryError(null); }}
          payday={payday}
          onPayday={setPayday}
        />
      );
      footer = { primary: { title: t("onboarding.continue"), onPress: continueSalary } };
      break;
    case "bills":
      content = setup(
        <StepHeading icon="repeat" color="#5856D6" title={t("onboarding.bills.title")} body={t("onboarding.bills.body")} />,
        <BillsStep
          choices={bills}
          errors={billErrors}
          onToggle={(id) => { toggleBill(id); setBillErrors((e) => e.filter((x) => x !== id)); }}
          onChange={(id, c) => { setBills((b) => ({ ...b, [id]: c })); setBillErrors((e) => e.filter((x) => x !== id)); }}
        />
      );
      footer = { primary: { title: t("onboarding.continue"), onPress: continueBills } };
      break;
    case "budget":
      content = setup(
        <StepHeading icon="chart" color={colors.warning} title={t("onboarding.budget.title")} body={t("onboarding.budget.body")} />,
        <BudgetStep income={salary} suggestions={suggestions} categories={categories} />
      );
      footer = {
        primary: { title: t("onboarding.budget.apply"), onPress: () => decideBudget(true) },
        secondary: { title: t("onboarding.notNow"), onPress: () => decideBudget(false) },
      };
      break;
    case "reminders":
      content = setup(
        <StepHeading icon="bell" color={colors.destructive} title={t("onboarding.reminders.title")} body={t("onboarding.reminders.body")} />,
        <RemindersPreview salary={salary} />
      );
      footer = {
        primary: { title: t("onboarding.reminders.turnOn"), onPress: () => void decideReminders(true) },
        secondary: { title: t("onboarding.reminders.later"), onPress: () => void decideReminders(false) },
      };
      break;
    case "done":
      content = setup(null, <DoneStep rows={summary} />);
      footer = {
        primary: { title: t("onboarding.done.addFirst"), onPress: () => finish("/add"), icon: "plus" },
        secondary: { title: t("onboarding.done.overview"), onPress: () => finish("/") },
      };
      break;
  }

  // Skip: explanation pages jump to setup; optional steps go on without their data.
  const onSkip =
    EXPLAIN.includes(step) ? () => go("balance")
    : step === "salary" ? skipSalary
    : step === "bills" ? skipBills
    : step === "budget" ? () => decideBudget(false)
    : step === "reminders" ? () => void decideReminders(false)
    : undefined;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <OnboardingTopBar
        onBack={index > 0 && step !== "done" ? back : undefined}
        onSkip={onSkip}
        dots={EXPLAIN.includes(step) ? { count: EXPLAIN.length, index: EXPLAIN.indexOf(step) } : undefined}
        progress={
          setupIndex >= 0
            ? { value: (setupIndex + 1) / setupSteps.length, current: setupIndex + 1, total: setupSteps.length }
            : undefined
        }
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* A new key per step: it slides in from the side the user is going. */}
        <Animated.View
          key={step}
          entering={(forward ? FadeInRight : FadeInLeft).duration(280)}
          style={styles.flex}
        >
          {content}
        </Animated.View>
        <OnboardingFooter {...footer} />
      </KeyboardAvoidingView>

      {pickingCurrency && (
        <CurrencyPicker
          selected={currency.code}
          onSelect={(code) => {
            setCurrency(code);
            // Typed amounts are read in the new currency; old errors no longer apply.
            setBalanceError(null);
            setPickingCurrency(false);
          }}
          onClose={() => setPickingCurrency(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex:    { flex: 1 },
  center:  { textAlign: "center" },
  explain: { flex: 1, paddingHorizontal: GUTTER },
  hero:    { flex: 1, justifyContent: "center" },
  copy:    { gap: space[3], paddingHorizontal: space[2], paddingBottom: space[4] },
  setup:   { paddingHorizontal: GUTTER, paddingTop: space[4], paddingBottom: space[8], gap: SECTION_GAP },
});
