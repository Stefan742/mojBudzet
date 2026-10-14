import React from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Category, categoryLabel } from "../../models";
import type { BudgetSuggestion } from "../../services/budgetSuggestionEngine";
import { formatMoney } from "../../utils/money";
import { haptics } from "../../utils/haptics";
import { useTheme } from "@/hooks/useTheme";
import { amountKeyboard, useCurrency } from "@/hooks/useCurrency";
import { Icon, type IconName } from "@/components/Icon";
import { CategoryIcon } from "@/components/CategoryIcon";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { PressableScale, PressableRow } from "@/components/ui/Pressables";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Section, Separator } from "@/components/ui/Section";
import { dataColor } from "@/constants/palette";
import { ROW_MIN, corners, elevation, inputType, money, radius, space, tint, type } from "@/constants/design";
import { BILL_PRESETS, BillChoice } from "./presets";

// ─── Balance ──────────────────────────────────────────────────────────────────

/** The currency, and the money there is today, typed big. */
export function BalanceStep({
  text,
  error,
  onChange,
  onPickCurrency,
}: {
  text: string;
  error: string | null;
  onChange: (v: string) => void;
  onPickCurrency: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const currency = useCurrency();
  return (
    <View style={styles.stack}>
      <Section>
        <PressableRow style={styles.row} onPress={onPickCurrency} accessibilityRole="button">
          <Text style={[type.body, styles.flex, { color: colors.text }]}>{t("settings.currency")}</Text>
          <Text style={[type.body, { color: colors.textSecondary }]} numberOfLines={1}>
            {t(`currency.name.${currency.code}`)}
          </Text>
          <Icon name="chevronForward" size={14} color={colors.textTertiary} />
        </PressableRow>
      </Section>
      <Section footer={error ?? t("onboarding.balance.hint")} footerColor={error ? colors.destructive : undefined}>
        {/* The number centred on its own line, the currency under it (as Apple Cash). */}
        <View style={styles.bigAmountBox}>
          <TextInput
            style={[inputType(type.display), money, styles.bigAmount, { color: colors.text }]}
            value={text}
            onChangeText={onChange}
            placeholder="0"
            placeholderTextColor={colors.placeholder}
            keyboardType={amountKeyboard(currency)}
            autoFocus
            accessibilityLabel={t("onboarding.balance.title")}
          />
          <Text style={[type.subheadline, { color: colors.textSecondary }]}>{currency.label}</Text>
        </View>
      </Section>
    </View>
  );
}

// ─── Day of the month ─────────────────────────────────────────────────────────

/** A month grid, 1–31, like a calendar without weekdays. */
export function DayPicker({ value, onChange, label }: { value: number; onChange: (d: number) => void; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.days} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
        const selected = d === value;
        return (
          <Pressable
            key={d}
            onPress={() => {
              if (!selected) haptics.selection();
              onChange(d);
            }}
            style={styles.dayCell}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={String(d)}
          >
            <View style={[styles.dayDot, selected && { backgroundColor: colors.accent }]}>
              <Text style={[type.body, money, { color: selected ? "#FFFFFF" : colors.text, fontWeight: selected ? "600" : "400" }]}>{d}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Salary ───────────────────────────────────────────────────────────────────

export function SalaryStep({
  text,
  error,
  onChange,
  payday,
  onPayday,
}: {
  text: string;
  error: string | null;
  onChange: (v: string) => void;
  payday: number;
  onPayday: (d: number) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const currency = useCurrency();
  return (
    <View style={styles.stack}>
      <Section footer={error} footerColor={colors.destructive}>
        <View style={styles.row}>
          <Text style={[type.body, { color: colors.text }]}>{t("onboarding.salary.amount")}</Text>
          <TextInput
            style={[inputType(type.title3), money, styles.inlineAmount, { color: colors.text }]}
            value={text}
            onChangeText={onChange}
            placeholder="0"
            placeholderTextColor={colors.placeholder}
            keyboardType={amountKeyboard(currency)}
            accessibilityLabel={t("onboarding.salary.amount")}
          />
          <Text style={[type.body, { color: colors.textSecondary }]}>{currency.label}</Text>
        </View>
      </Section>
      <Section title={t("onboarding.salary.payday")} footer={t("onboarding.salary.paydayHint", { day: payday })}>
        <DayPicker value={payday} onChange={onPayday} label={t("onboarding.salary.payday")} />
      </Section>
    </View>
  );
}

// ─── Regular payments ─────────────────────────────────────────────────────────

export function BillsStep({
  choices,
  errors,
  onToggle,
  onChange,
}: {
  choices: Record<string, BillChoice>;
  /** Preset ids whose amount is missing. */
  errors: string[];
  onToggle: (id: string) => void;
  onChange: (id: string, choice: BillChoice) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const currency = useCurrency();
  const chosen = BILL_PRESETS.filter((p) => choices[p.id]);

  return (
    <View style={styles.stack}>
      <View style={styles.tiles}>
        {BILL_PRESETS.map((p) => {
          const selected = !!choices[p.id];
          return (
            // The cell takes the width: PressableScale styles its inner view only.
            <View key={p.id} style={styles.billCell}>
              <PressableScale
                onPress={() => {
                  haptics.selection();
                  onToggle(p.id);
                }}
                style={[
                  styles.billTile,
                  { backgroundColor: colors.card, borderColor: selected ? colors.accent : "transparent" },
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={t(p.nameKey)}
              >
                <View style={[styles.billIcon, { backgroundColor: tint(p.color, "soft") }]}>
                  <Icon name={p.icon} size={18} color={p.color} />
                </View>
                <Text style={[type.subheadline, styles.flex, { color: colors.text, fontWeight: "600" }]} numberOfLines={2}>
                  {t(p.nameKey)}
                </Text>
                {selected && <Icon name="checkCircle" size={20} color={colors.accent} />}
              </PressableScale>
            </View>
          );
        })}
      </View>

      {chosen.map((p) => {
        const c = choices[p.id];
        const missing = errors.includes(p.id);
        return (
          <Animated.View key={p.id} entering={FadeInDown.duration(250)}>
            <Section
              title={t(p.nameKey)}
              footer={missing ? t("onboarding.bills.amountRequired") : null}
              footerColor={colors.destructive}
            >
              <View style={styles.row}>
                <Text style={[type.body, { color: colors.text }]}>{t("add.amount")}</Text>
                <TextInput
                  style={[inputType(type.body), money, styles.inlineAmount, { color: colors.text }]}
                  value={c.amountText}
                  onChangeText={(v) => onChange(p.id, { ...c, amountText: v })}
                  placeholder={c.variable ? t("onboarding.bills.usual") : "0"}
                  placeholderTextColor={colors.placeholder}
                  keyboardType={amountKeyboard(currency)}
                        accessibilityLabel={`${t(p.nameKey)}, ${t("add.amount")}`}
                />
                <Text style={[type.body, { color: colors.textSecondary }]}>{currency.label}</Text>
              </View>
              <Separator />
              <View style={styles.row}>
                <Text style={[type.body, styles.flex, { color: colors.text }]}>{t("onboarding.bills.day")}</Text>
                <Stepper
                  value={c.day}
                  onChange={(day) => onChange(p.id, { ...c, day })}
                  label={`${t(p.nameKey)}, ${t("onboarding.bills.day")}`}
                />
              </View>
              <Separator />
              <View style={styles.row}>
                <Text style={[type.body, styles.flex, { color: colors.text }]}>{t("repeating.variable")}</Text>
                <View style={styles.switchSlot}>
                  <Switch
                    value={c.variable}
                    onValueChange={(variable) => onChange(p.id, { ...c, variable })}
                    trackColor={{ true: colors.success }}
                    accessibilityLabel={`${t(p.nameKey)}, ${t("repeating.variable")}`}
                  />
                </View>
              </View>
            </Section>
          </Animated.View>
        );
      })}
    </View>
  );
}

/** − 15 +, wrapping round the month. */
function Stepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const step = (delta: number) => {
    haptics.selection();
    onChange(((value - 1 + delta + 31) % 31) + 1);
  };
  return (
    <View
      style={styles.stepper}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: t("onboarding.dayOfMonth", { day: value }) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === "increment" ? 1 : -1)}
    >
      {(["-", "+"] as const).map((sign) => (
        <React.Fragment key={sign}>
          {sign === "+" && (
            <Text style={[type.body, money, styles.stepperValue, { color: colors.text }]}>{t("onboarding.dayOfMonth", { day: value })}</Text>
          )}
          <Pressable onPress={() => step(sign === "+" ? 1 : -1)} hitSlop={6} style={[styles.stepperButton, { backgroundColor: colors.fill }]}>
            <Text style={[type.headline, { color: colors.accent }]}>{sign === "+" ? "+" : "−"}</Text>
          </Pressable>
        </React.Fragment>
      ))}
    </View>
  );
}

// ─── Budget ───────────────────────────────────────────────────────────────────

export function BudgetStep({
  income,
  suggestions,
  categories,
}: {
  income: number;
  suggestions: BudgetSuggestion[];
  categories: Category[];
}) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const currency = useCurrency();
  return (
    <Section footer={t("onboarding.budget.footer")}>
      {suggestions.map((s, i) => {
        const cat = categories.find((c) => c.id === s.categoryId);
        if (!cat) return null;
        const color = dataColor(cat.colorHex, isDark);
        const share = income > 0 ? s.suggestedMonthlyLimit / income : 0;
        return (
          <Animated.View key={s.categoryId} entering={FadeInDown.delay(i * 90).duration(300)}>
            {i > 0 && <Separator inset={space[4] + 32 + space[3]} />}
            <View style={styles.budgetRow} accessible accessibilityLabel={`${categoryLabel(cat, t)}, ${Math.round(share * 100)}%, ${formatMoney(s.suggestedMonthlyLimit, currency)}`}>
              <View style={[styles.budgetTile, { backgroundColor: tint(color, "soft") }]}>
                <CategoryIcon iconName={cat.iconName} size={16} color={color} />
              </View>
              <View style={styles.flex}>
                <View style={styles.budgetLine}>
                  <Text style={[type.body, styles.flex, { color: colors.text }]} numberOfLines={1}>{categoryLabel(cat, t)}</Text>
                  <Text style={[type.subheadline, money, { color: colors.textSecondary }]}>{Math.round(share * 100)}%</Text>
                  <Text style={[type.headline, money, { color: colors.text }]}>{formatMoney(s.suggestedMonthlyLimit, currency)}</Text>
                </View>
                <ProgressBar progress={share} color={color} />
              </View>
            </View>
          </Animated.View>
        );
      })}
    </Section>
  );
}

// ─── Reminders ────────────────────────────────────────────────────────────────

/** What a reminder will look like: two notifications as iOS shows them. */
export function RemindersPreview({ salary }: { salary: number }) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const currency = useCurrency();
  const banner = (title: string, body: string) => (
    <GlassSurface style={styles.banner} tinted>
      <View style={[styles.bannerIcon, { backgroundColor: colors.success }]}>
        <Icon name="money" size={16} color="#FFFFFF" />
      </View>
      <View style={styles.flex}>
        <View style={styles.bannerTop}>
          <Text style={[type.subheadline, styles.flex, { color: colors.text, fontWeight: "600" }]} numberOfLines={1}>{title}</Text>
          <Text style={[type.caption, { color: colors.textSecondary }]}>09:00</Text>
        </View>
        <Text style={[type.subheadline, { color: colors.text }]} numberOfLines={2}>{body}</Text>
      </View>
    </GlassSurface>
  );
  return (
    <View style={styles.bannerStage} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {salary > 0 && (
        <View style={[styles.bannerBehind, { backgroundColor: colors.card }, elevation.raised(isDark)]}>
          <Text style={[type.footnote, { color: colors.textSecondary }]} numberOfLines={1}>
            {t("incomeTypes.salary")} · {t("repeating.notifyIncome", { amount: formatMoney(salary, currency) })}
          </Text>
        </View>
      )}
      <Animated.View entering={FadeInDown.springify().damping(16)} style={[corners(radius.xl), elevation.floating(isDark)]}>
        {banner(t("onboarding.bills.rent"), t("repeating.notifyBody", { amount: formatMoney(15000, currency) }))}
      </Animated.View>
    </View>
  );
}

// ─── Done ─────────────────────────────────────────────────────────────────────

export interface SummaryRow {
  key: string;
  icon: IconName;
  color: string;
  text: string;
}

export function DoneStep({ rows }: { rows: SummaryRow[] }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.doneStack}>
      <Animated.View entering={ZoomIn.springify().damping(12)} style={[styles.doneMark, { backgroundColor: colors.success }]}>
        <Icon name="check" size={44} color="#FFFFFF" />
      </Animated.View>
      <Text style={[type.largeTitle, styles.centerText, { color: colors.text }]} accessibilityRole="header">
        {t("onboarding.done.title")}
      </Text>
      <Animated.View entering={FadeIn.delay(200).duration(300)} style={styles.fullWidth}>
        <Section footer={t("onboarding.done.footer")}>
          {rows.map((r, i) => (
            <View key={r.key}>
              {i > 0 && <Separator inset={space[4] + 29 + space[3]} />}
              <View style={styles.row}>
                <View style={[styles.summaryTile, { backgroundColor: r.color }]}>
                  <Icon name={r.icon} size={15} color="#FFFFFF" />
                </View>
                <Text style={[type.body, styles.flex, { color: colors.text }]}>{r.text}</Text>
              </View>
            </View>
          ))}
        </Section>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex:          { flex: 1 },
  fullWidth:     { alignSelf: "stretch" },
  centerText:    { textAlign: "center" },
  stack:         { gap: space[6] },
  row:           { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], minHeight: ROW_MIN + 4 },
  bigAmountBox:  { alignItems: "center", paddingHorizontal: space[4], paddingTop: space[3], paddingBottom: space[4] },
  bigAmount:     { alignSelf: "stretch", textAlign: "center", paddingVertical: space[2] },
  inlineAmount:  { flex: 1, minWidth: 0, textAlign: "right", paddingVertical: space[3] },
  days:          { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: space[2], paddingVertical: space[2] },
  dayCell:       { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 3 },
  dayDot:        { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  tiles:         { flexDirection: "row", flexWrap: "wrap", gap: space[3] },
  billCell:      { width: "48%", flexGrow: 1 },
  billTile:      { flexDirection: "row", alignItems: "center", gap: space[3], padding: space[3], minHeight: 64, borderWidth: 2, ...corners(radius.lg) },
  billIcon:      { width: 36, height: 36, alignItems: "center", justifyContent: "center", ...corners(radius.sm) },
  switchSlot:    { width: 64, height: 40, alignItems: "center", justifyContent: "center" },
  stepper:       { flexDirection: "row", alignItems: "center", gap: space[3] },
  stepperButton: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  stepperValue:  { minWidth: 56, textAlign: "center" },
  budgetRow:     { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3] },
  budgetTile:    { width: 32, height: 32, alignItems: "center", justifyContent: "center", ...corners(radius.sm) },
  budgetLine:    { flexDirection: "row", alignItems: "baseline", gap: space[2], marginBottom: space[2] },
  bannerStage:   { alignSelf: "stretch", paddingTop: space[6], paddingHorizontal: space[1] },
  bannerBehind:  { position: "absolute", top: 0, left: space[6], right: space[6], paddingHorizontal: space[4], paddingVertical: space[2], ...corners(radius.lg) },
  banner:        { flexDirection: "row", alignItems: "center", gap: space[3], padding: space[3], ...corners(radius.xl) },
  bannerIcon:    { width: 36, height: 36, alignItems: "center", justifyContent: "center", ...corners(9) },
  bannerTop:     { flexDirection: "row", alignItems: "center", gap: space[2] },
  doneStack:     { alignItems: "center", gap: space[5] },
  doneMark:      { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", marginTop: space[6] },
  summaryTile:   { width: 29, height: 29, alignItems: "center", justifyContent: "center", ...corners(7) },
});
