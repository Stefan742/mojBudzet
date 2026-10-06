import React, { useState, useEffect, useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Animated, Modal, useWindowDimensions,
} from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppStore } from "../store/useAppStore";
import {
  balanceOf, expensesByCategory, leftoverOf, monthTotals, CategorySpend,
} from "../store/selectors";
import { categoryLabel } from "../models";
import { formatMoney } from "../utils/money";
import { formatMonthWide, monthKey, monthStart, previousMonthKey, shiftMonth } from "../utils/dates";
import { useTheme } from "@/hooks/useTheme";
import { MIN_TOUCH, useTabBarSpace } from "@/constants/layout";

const CARD_RADIUS = 20;
const H_PAD       = 20;

function describeArc(
  cx: number, cy: number, r: number, stroke: number,
  startAngle: number, endAngle: number
): string {
  const toRad   = (deg: number) => (deg * Math.PI) / 180;
  const startRad = toRad(startAngle - 90);
  const endRad   = toRad(endAngle - 90);
  const outerR   = r + stroke / 2;
  const innerR   = r - stroke / 2;
  const x1o = cx + outerR * Math.cos(startRad);
  const y1o = cy + outerR * Math.sin(startRad);
  const x2o = cx + outerR * Math.cos(endRad);
  const y2o = cy + outerR * Math.sin(endRad);
  const x1i = cx + innerR * Math.cos(endRad);
  const y1i = cy + innerR * Math.sin(endRad);
  const x2i = cx + innerR * Math.cos(startRad);
  const y2i = cy + innerR * Math.sin(startRad);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${x1o} ${y1o}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o} ${y2o}`,
    `L ${x1i} ${y1i}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i} ${y2i}`,
    "Z",
  ].join(" ");
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────
interface DonutChartProps {
  parts: { key: string; color: string; amount: number }[];
  total: number;
  currency: string;
  /** Replays the reveal animation when it changes (the selected month). */
  animKey: string;
  accessibilityLabel: string;
}

function DonutChart({ parts, total, currency, animKey, accessibilityLabel }: DonutChartProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [reveal] = useState(() => new Animated.Value(1));

  // One native-driver animation per month change; no per-frame re-render (P-3).
  useEffect(() => {
    if (reduceMotion) return;
    reveal.setValue(0);
    Animated.timing(reveal, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, [animKey, reduceMotion, reveal]);

  const size   = Math.min(width - 80, 260);
  const radius = size / 2 - 24;
  const stroke = size * 0.13;
  const center = size / 2;
  const hole   = size * 0.52;

  const GAP_DEG = parts.length > 1 ? 2 : 0;
  const segments: (DonutChartProps["parts"][number] & { startDeg: number; endDeg: number })[] = [];
  for (let i = 0, start = 0; i < parts.length; i++) {
    const fullSpan = total > 0 ? (parts[i].amount / total) * 360 : 0;
    const startDeg = start + GAP_DEG / 2;
    // A full 360° arc has identical start and end points and draws nothing.
    const endDeg = Math.min(start + fullSpan - GAP_DEG / 2, startDeg + 359.99);
    segments.push({ ...parts[i], startDeg, endDeg });
    start += fullSpan;
  }

  return (
    <View
      style={styles.donutWrapper}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View
        style={{
          width: size, height: size,
          opacity: reveal,
          transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
        }}
      >
        <Svg width={size} height={size}>
          <Circle cx={center} cy={center} r={radius} fill="none" stroke={colors.separator} strokeWidth={stroke} />
          {segments.map((s) =>
            s.endDeg - s.startDeg < 0.1 ? null : (
              <Path
                key={s.key}
                d={describeArc(center, center, radius, stroke, s.startDeg, s.endDeg)}
                fill={s.color}
                opacity={0.93}
              />
            )
          )}
        </Svg>
        {/* Centred over the SVG by construction, on any screen width (B-15). */}
        <View
          style={[
            styles.donutHole,
            {
              width: hole, height: hole, borderRadius: hole / 2,
              top: center - hole / 2, left: center - hole / 2,
              backgroundColor: colors.card,
            },
          ]}
          pointerEvents="none"
        >
          <Text style={[styles.donutLabel, { color: colors.textSecondary }]}>{t("overview.spent")}</Text>
          <Text style={[styles.donutAmount, { color: colors.text }]} adjustsFontSizeToFit numberOfLines={1}>
            {formatMoney(total, currency)}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Leftover Modal ───────────────────────────────────────────────────────────
interface LeftoverModalProps {
  visible: boolean;
  amount: number;
  monthLabel: string;
  currency: string;
  onCarryOver: () => void;
  onSave: (goalId: string | null) => void;
  onLater: () => void;
}

function LeftoverModal({
  visible, amount, monthLabel, currency, onCarryOver, onSave, onLater,
}: LeftoverModalProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const savingsGoals = useAppStore((s) => s.savingsGoals);

  const [step, setStep]                     = useState<"choice" | "pick_goal">("choice");
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  const handleSavePressed = () => {
    if (savingsGoals.length > 0) setStep("pick_goal");
    else onSave(null);
  };

  const close = (action: () => void) => {
    setStep("choice");
    setSelectedGoalId(null);
    action();
  };

  const renderCheck = (selected: boolean) => (
    <View style={[
      modalStyles.checkCircle,
      { borderColor: colors.separator, backgroundColor: colors.card },
      selected && { backgroundColor: colors.accent, borderColor: colors.accent },
    ]}>
      {selected && <Ionicons name="checkmark" size={14} color={colors.onAccent} />}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => close(onLater)}>
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
          {step === "choice" ? (
            <>
              <View style={[modalStyles.iconBadge, { backgroundColor: colors.accent + "22" }]}>
                <Ionicons name="wallet-outline" size={28} color={colors.accent} />
              </View>
              <Text style={[modalStyles.title, { color: colors.text }]} accessibilityRole="header">
                {t("leftover.title")}
              </Text>
              <Text style={[modalStyles.subtitle, { color: colors.textSecondary }]}>
                {t("leftover.subtitle", { month: monthLabel })}
              </Text>
              <View style={[modalStyles.amountPill, { backgroundColor: colors.accent + "18" }]}>
                <Text style={[modalStyles.amountText, { color: colors.accent }]}>
                  {formatMoney(amount, currency)}
                </Text>
              </View>
              <Text style={[modalStyles.question, { color: colors.textSecondary }]}>{t("leftover.question")}</Text>
              <TouchableOpacity
                style={[modalStyles.btn, { backgroundColor: colors.accent }]}
                onPress={handleSavePressed}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Ionicons name="save-outline" size={18} color={colors.onAccent} style={{ marginRight: 8 }} />
                <Text style={[modalStyles.btnText, { color: colors.onAccent }]}>{t("leftover.save")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modalStyles.btn, { backgroundColor: colors.accent + "18", borderWidth: 1.5, borderColor: colors.accent }]}
                onPress={() => close(onCarryOver)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityHint={t("leftover.carryOverHint")}
              >
                <Ionicons name="arrow-forward-circle-outline" size={18} color={colors.accent} style={{ marginRight: 8 }} />
                <Text style={[modalStyles.btnText, { color: colors.accent }]}>{t("leftover.carryOver")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => close(onLater)} style={modalStyles.skipBtn} accessibilityRole="button">
                <Text style={[modalStyles.skipText, { color: colors.textSecondary }]}>{t("leftover.later")}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => setStep("choice")}
                style={modalStyles.backBtn}
                accessibilityRole="button"
              >
                <Ionicons name="chevron-back" size={20} color={colors.accent} />
                <Text style={[modalStyles.backText, { color: colors.accent }]}>{t("leftover.back")}</Text>
              </TouchableOpacity>
              <Text style={[modalStyles.title, { color: colors.text }]} accessibilityRole="header">
                {t("leftover.whereToSave")}
              </Text>
              <ScrollView style={modalStyles.goalList} showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                  style={[
                    modalStyles.goalRow,
                    { backgroundColor: colors.inputBg, borderColor: "transparent" },
                    selectedGoalId === null && { backgroundColor: colors.accent + "18", borderColor: colors.accent },
                  ]}
                  onPress={() => setSelectedGoalId(null)}
                  activeOpacity={0.7}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedGoalId === null }}
                >
                  <View style={[modalStyles.goalIconBox, { backgroundColor: colors.vaultBg }]}>
                    <Ionicons name="lock-closed" size={18} color={colors.vault} />
                  </View>
                  <View style={modalStyles.goalInfo}>
                    <Text style={[modalStyles.goalName, { color: colors.text }]}>{t("leftover.vault")}</Text>
                    <Text style={[modalStyles.goalProgress, { color: colors.textTertiary }]}>
                      {t("leftover.vaultDesc")}
                    </Text>
                  </View>
                  {renderCheck(selectedGoalId === null)}
                </TouchableOpacity>

                {savingsGoals.map((g) => {
                  const isSelected = selectedGoalId === g.id;
                  const pct = g.targetAmount > 0 ? Math.min((g.currentAmount / g.targetAmount) * 100, 100) : 0;
                  return (
                    <TouchableOpacity
                      key={g.id}
                      style={[
                        modalStyles.goalRow,
                        { backgroundColor: colors.inputBg, borderColor: "transparent" },
                        isSelected && { backgroundColor: colors.accent + "18", borderColor: colors.accent },
                      ]}
                      onPress={() => setSelectedGoalId(g.id)}
                      activeOpacity={0.7}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <View style={[modalStyles.goalIconBox, { backgroundColor: g.colorHex + "22" }]}>
                        <View style={[modalStyles.goalDot, { backgroundColor: g.colorHex }]} />
                      </View>
                      <View style={modalStyles.goalInfo}>
                        <Text style={[modalStyles.goalName, { color: colors.text }]}>{g.name}</Text>
                        <Text style={[modalStyles.goalProgress, { color: colors.textTertiary }]}>
                          {formatMoney(g.currentAmount, currency)} / {formatMoney(g.targetAmount, currency)}
                        </Text>
                        <View style={[modalStyles.progressTrack, { backgroundColor: colors.separator }]}>
                          <View style={[modalStyles.progressFill, { width: `${pct}%`, backgroundColor: g.colorHex }]} />
                        </View>
                      </View>
                      {renderCheck(isSelected)}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity
                style={[modalStyles.btn, { backgroundColor: colors.accent, marginTop: 12 }]}
                onPress={() => close(() => onSave(selectedGoalId))}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.onAccent} style={{ marginRight: 8 }} />
                <Text style={[modalStyles.btnText, { color: colors.onAccent }]}>{t("leftover.confirm")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => close(onLater)} style={modalStyles.skipBtn} accessibilityRole="button">
                <Text style={[modalStyles.skipText, { color: colors.textSecondary }]}>{t("leftover.later")}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── OverviewScreen ───────────────────────────────────────────────────────────
export default function OverviewScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomSpace = useTabBarSpace();
  const currency = t("common.currency");

  const transactions      = useAppStore((s) => s.transactions);
  const categories        = useAppStore((s) => s.categories);
  const initialBalance    = useAppStore((s) => s.initialBalance);
  const lastRolloverMonth = useAppStore((s) => s.lastRolloverMonth);
  const markRolloverDone  = useAppStore((s) => s.markRolloverDone);
  const saveFromBalance   = useAppStore((s) => s.saveFromBalance);
  // Read through a selector so it is re-evaluated on every render;
  // React Compiler would cache a plain `new Date()` in render.
  const thisMonth         = useAppStore(() => monthKey(new Date()));

  const [selectedMonth, setSelectedMonth]     = useState(thisMonth);
  const [rolloverDeferred, setRolloverDeferred] = useState(false);

  const balance = useMemo(() => balanceOf(initialBalance, transactions), [initialBalance, transactions]);
  const totals  = useMemo(() => monthTotals(transactions, selectedMonth), [transactions, selectedMonth]);
  const parts   = useMemo(
    () => expensesByCategory(transactions, categories, selectedMonth),
    [transactions, categories, selectedMonth]
  );

  // ── Month rollover (D-1) ──────────────────────────────────────────────────
  // Nothing is written until the user chooses. "Carry over" keeps the money in
  // the balance; "Save" moves last month's leftover into savings; "Later" asks
  // again on the next launch.
  const pendingMonth  = previousMonthKey(thisMonth);
  const needsRollover = lastRolloverMonth === undefined || lastRolloverMonth < thisMonth;
  const leftover      = needsRollover ? leftoverOf(transactions, pendingMonth, balance) : 0;

  useEffect(() => {
    if (needsRollover && leftover === 0) markRolloverDone(thisMonth);
  }, [needsRollover, leftover, thisMonth, markRolloverDone]);

  const handleShift = (delta: number) =>
    setSelectedMonth((k) => monthKey(shiftMonth(monthStart(k), delta)));

  const language       = i18n.language;
  const selectedLabel  = formatMonthWide(monthStart(selectedMonth), language);
  const pendingLabel   = formatMonthWide(monthStart(pendingMonth), language);
  const partLabel      = (p: CategorySpend) => (p.category ? categoryLabel(p.category, t) : t("overview.uncategorized"));
  const partColor      = (p: CategorySpend) => p.category?.colorHex ?? colors.textTertiary;
  const donutSummary   = parts.map((p) => `${partLabel(p)} ${formatMoney(p.amount, currency)}`).join(", ");
  const cardStyle      = [styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow }];

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]} accessibilityRole="header">
          {t("overview.title")}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomSpace }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={cardStyle}>
          <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>{t("overview.currentBalance")}</Text>
          <Text
            style={[styles.balance, { color: balance < 0 ? colors.destructive : colors.text }]}
            adjustsFontSizeToFit
            numberOfLines={1}
          >
            {formatMoney(balance, currency)}
          </Text>
          <View style={styles.incomeRow}>
            <View style={styles.incomeItem} accessible accessibilityLabel={`${t("overview.income")} ${formatMoney(totals.income, currency)}`}>
              <Ionicons name="arrow-down-circle" size={16} color={colors.success} />
              <Text style={[styles.incomeText, { color: colors.textSecondary }]}>
                {formatMoney(totals.income, currency)}
              </Text>
            </View>
            <View style={styles.incomeItem} accessible accessibilityLabel={`${t("overview.expenses")} ${formatMoney(totals.expenses, currency)}`}>
              <Ionicons name="arrow-up-circle" size={16} color={colors.destructive} />
              <Text style={[styles.incomeText, { color: colors.textSecondary }]}>
                {formatMoney(totals.expenses, currency)}
              </Text>
            </View>
            {totals.savings > 0 && (
              <View style={styles.incomeItem} accessible accessibilityLabel={`${t("overview.saved")} ${formatMoney(totals.savings, currency)}`}>
                <Ionicons name="lock-closed" size={14} color={colors.vault} />
                <Text style={[styles.incomeText, { color: colors.textSecondary }]}>
                  {formatMoney(totals.savings, currency)}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.monthPicker}>
          <TouchableOpacity
            onPress={() => handleShift(-1)}
            style={styles.chevron}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.prevMonth")}
          >
            <Ionicons name="chevron-back" size={22} color={colors.accent} />
          </TouchableOpacity>
          <Text style={[styles.monthText, { color: colors.text }]} accessibilityRole="header">
            {selectedLabel}
          </Text>
          <TouchableOpacity
            onPress={() => handleShift(1)}
            style={styles.chevron}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.nextMonth")}
          >
            <Ionicons name="chevron-forward" size={22} color={colors.accent} />
          </TouchableOpacity>
        </View>

        {totals.expenses === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="pie-chart-outline" size={56} color={colors.separator} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("overview.noExpenses")}</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>{t("overview.noExpensesSub")}</Text>
          </View>
        ) : (
          <>
            <View style={cardStyle}>
              <DonutChart
                parts={parts.map((p) => ({ key: p.category?.id ?? "none", color: partColor(p), amount: p.amount }))}
                total={totals.expenses}
                currency={currency}
                animKey={selectedMonth}
                accessibilityLabel={`${t("overview.spent")} ${formatMoney(totals.expenses, currency)}. ${donutSummary}`}
              />
            </View>
            <View style={cardStyle}>
              {parts.map((p, i) => {
                const pct = totals.expenses > 0 ? (p.amount / totals.expenses) * 100 : 0;
                return (
                  <View key={p.category?.id ?? "none"}>
                    <View style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: partColor(p) }]} />
                      <Text style={[styles.legendName, { color: colors.text }]} numberOfLines={1}>
                        {partLabel(p)}
                      </Text>
                      <Text style={[styles.legendAmount, { color: colors.textSecondary }]}>
                        {formatMoney(p.amount, currency)}
                      </Text>
                      <Text style={[styles.legendPct, { color: colors.textSecondary }]}>
                        {Math.round(pct)}%
                      </Text>
                    </View>
                    {i < parts.length - 1 && (
                      <View style={[styles.divider, { backgroundColor: colors.separator }]} />
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <LeftoverModal
        visible={needsRollover && leftover > 0 && !rolloverDeferred}
        amount={leftover}
        monthLabel={pendingLabel}
        currency={currency}
        onCarryOver={() => markRolloverDone(thisMonth)}
        onSave={(goalId) => {
          saveFromBalance(leftover, goalId, "");
          markRolloverDone(thisMonth);
        }}
        onLater={() => setRolloverDeferred(true)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center", alignItems: "center", paddingHorizontal: 24,
  },
  card: {
    borderRadius: 24, padding: 24, width: "100%", maxHeight: "80%",
    shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 8 },
    elevation: 12, alignItems: "center",
  },
  iconBadge:   { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title:       { fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: 6 },
  subtitle:    { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 20 },
  amountPill:  { borderRadius: 50, paddingHorizontal: 24, paddingVertical: 10, marginBottom: 16 },
  amountText:  { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  question:    { fontSize: 14, textAlign: "center", marginBottom: 20 },
  btn:         { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 14, marginBottom: 10, minHeight: MIN_TOUCH },
  btnText:     { fontSize: 16, fontWeight: "600" },
  skipBtn:     { marginTop: 4, minHeight: MIN_TOUCH, minWidth: 88, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  skipText:    { fontSize: 15 },
  backBtn:     { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginBottom: 12, minHeight: MIN_TOUCH },
  backText:    { fontSize: 15, marginLeft: 2 },
  goalList:    { width: "100%", maxHeight: 300 },
  goalRow:     { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 14, marginBottom: 8, borderWidth: 1.5 },
  goalIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 12 },
  goalDot:     { width: 14, height: 14, borderRadius: 7 },
  goalInfo:    { flex: 1, marginRight: 10 },
  goalName:    { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  goalProgress:{ fontSize: 12, marginBottom: 5 },
  progressTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill:  { height: 4, borderRadius: 2 },
  checkCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});

const styles = StyleSheet.create({
  root:        { flex: 1 },
  header:      { paddingHorizontal: H_PAD, paddingTop: 8, paddingBottom: 4 },
  headerTitle: { fontSize: 34, fontWeight: "700", letterSpacing: 0.3 },
  scroll:      { flex: 1 },
  content:     { paddingHorizontal: H_PAD, paddingTop: 16, gap: 16 },
  card:        { borderRadius: CARD_RADIUS, padding: 20, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  cardLabel:   { fontSize: 13, marginBottom: 4, fontWeight: "400" },
  balance:     { fontSize: 38, fontWeight: "700", letterSpacing: -0.5 },
  incomeRow:   { flexDirection: "row", flexWrap: "wrap", gap: 20, marginTop: 12 },
  incomeItem:  { flexDirection: "row", alignItems: "center", gap: 6 },
  incomeText:  { fontSize: 14, fontWeight: "500" },
  monthPicker: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chevron:     { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center" },
  monthText:   { fontSize: 17, fontWeight: "600", textTransform: "capitalize" },
  empty:       { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle:  { fontSize: 20, fontWeight: "600" },
  emptySub:    { fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  donutWrapper: { alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  donutHole:   { position: "absolute", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  donutLabel:  { fontSize: 12, marginBottom: 2 },
  donutAmount: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  legendRow:   { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  legendDot:   { width: 11, height: 11, borderRadius: 6 },
  legendName:  { fontSize: 15, fontWeight: "400", flex: 1 },
  legendAmount:{ fontSize: 14, fontWeight: "500" },
  legendPct:   { fontSize: 13, minWidth: 38, textAlign: "right" },
  divider:     { height: StyleSheet.hairlineWidth, marginLeft: 21 },
});
