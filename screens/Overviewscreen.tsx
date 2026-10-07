import React, { useState, useEffect, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Animated, useWindowDimensions,
} from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/useAppStore";
import { useSession } from "../store/session";
import {
  balanceOf, expensesByCategory, leftoverOf, monthTotals, CategorySpend,
} from "../store/selectors";
import { categoryLabel } from "../models";
import { formatMoney } from "../utils/money";
import { formatMonthWide, monthKey, monthStart, previousMonthKey, shiftMonth } from "../utils/dates";
import { haptics } from "../utils/haptics";
import { useTheme } from "@/hooks/useTheme";
import { useMotion } from "@/hooks/useMotion";
import { Icon } from "@/components/Icon";
import { Section, Separator } from "@/components/ui/Section";
import { dataColor } from "@/constants/palette";
import { GUTTER, ROW_MIN, SECTION_GAP, corners, elevation, money, radius, space, type } from "@/constants/design";

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
  /** Replays the reveal when it changes (the selected month). */
  animKey: string;
  accessibilityLabel: string;
}

function DonutChart({ parts, total, currency, animKey, accessibilityLabel }: DonutChartProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { spring, reduceMotion } = useMotion();
  const [reveal] = useState(() => new Animated.Value(1));

  // One native-driver spring per month change; skipped with Reduce Motion.
  useEffect(() => {
    if (reduceMotion) return;
    reveal.setValue(0);
    spring(reveal, 1, "gentle").start();
    // spring is recreated each render; the month is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey, reduceMotion, reveal]);

  const size   = Math.min(width - GUTTER * 2 - space[10], 240);
  const ring   = size * 0.12;
  const r      = size / 2 - ring / 2 - 2;
  const center = size / 2;
  const hole   = size - ring * 2 - space[3];

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
    <View style={styles.donutWrapper} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Animated.View
        style={{
          width: size, height: size,
          opacity: reveal,
          transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
        }}
      >
        <Svg width={size} height={size}>
          <Circle cx={center} cy={center} r={r} fill="none" stroke={colors.fill} strokeWidth={ring} />
          {segments.map((s) =>
            s.endDeg - s.startDeg < 0.1 ? null : (
              <Path key={s.key} d={describeArc(center, center, r, ring, s.startDeg, s.endDeg)} fill={s.color} />
            )
          )}
        </Svg>
        <View style={[styles.donutHole, { width: hole, height: hole, top: center - hole / 2, left: center - hole / 2 }]} pointerEvents="none">
          <Text style={[type.footnote, { color: colors.textSecondary }]}>{t("overview.spent")}</Text>
          <Text style={[type.title3, money, { color: colors.text }]} adjustsFontSizeToFit numberOfLines={1}>
            {formatMoney(total, currency)}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── OverviewScreen ───────────────────────────────────────────────────────────
export default function OverviewScreen() {
  const { t, i18n } = useTranslation();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const currency = t("common.currency");

  const transactions      = useAppStore((s) => s.transactions);
  const categories        = useAppStore((s) => s.categories);
  const initialBalance    = useAppStore((s) => s.initialBalance);
  const lastRolloverMonth = useAppStore((s) => s.lastRolloverMonth);
  const markRolloverDone  = useAppStore((s) => s.markRolloverDone);
  const rolloverPrompted  = useSession((s) => s.rolloverPrompted);
  const setRolloverPrompted = useSession((s) => s.setRolloverPrompted);
  // Read through a selector so it is re-evaluated on every render;
  // React Compiler would cache a plain `new Date()` in render.
  const thisMonth         = useAppStore(() => monthKey(new Date()));

  const [selectedMonth, setSelectedMonth] = useState(thisMonth);

  const balance = useMemo(() => balanceOf(initialBalance, transactions), [initialBalance, transactions]);
  const totals  = useMemo(() => monthTotals(transactions, selectedMonth), [transactions, selectedMonth]);
  const parts   = useMemo(
    () => expensesByCategory(transactions, categories, selectedMonth),
    [transactions, categories, selectedMonth]
  );

  // ── Month rollover (D-1) ──────────────────────────────────────────────────
  // Nothing is written until the user chooses in the leftover sheet.
  const needsRollover = lastRolloverMonth === undefined || lastRolloverMonth < thisMonth;
  const leftover      = needsRollover ? leftoverOf(transactions, previousMonthKey(thisMonth), balance) : 0;

  useEffect(() => {
    if (!needsRollover) return;
    if (leftover === 0) markRolloverDone(thisMonth);
    else if (!rolloverPrompted) {
      setRolloverPrompted();
      router.push("/leftover");
    }
  }, [needsRollover, leftover, thisMonth, rolloverPrompted, markRolloverDone, setRolloverPrompted, router]);

  const handleShift = (delta: number) => {
    haptics.selection();
    setSelectedMonth((k) => monthKey(shiftMonth(monthStart(k), delta)));
  };

  const partLabel = (p: CategorySpend) => (p.category ? categoryLabel(p.category, t) : t("overview.uncategorized"));
  const partColor = (p: CategorySpend) => (p.category ? dataColor(p.category.colorHex, isDark) : colors.textTertiary);
  const donutSummary = parts.map((p) => `${partLabel(p)} ${formatMoney(p.amount, currency)}`).join(", ");
  const heroCard = [styles.hero, { backgroundColor: colors.card }, elevation.raised(isDark)];

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/settings")}
              hitSlop={8}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel={t("settings.title")}
            >
              <Icon name="gear" size={22} color={colors.accent} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Balance */}
        <View style={heroCard}>
          <Text style={[type.footnote, { color: colors.textSecondary }]}>{t("overview.currentBalance")}</Text>
          <Text
            style={[type.display, { color: balance < 0 ? colors.destructive : colors.text }]}
            adjustsFontSizeToFit
            numberOfLines={1}
          >
            {formatMoney(balance, currency)}
          </Text>
          <View style={styles.totalsRow}>
            {[
              { key: "income", icon: "income" as const, color: colors.success, value: totals.income, label: t("overview.income") },
              { key: "expenses", icon: "expense" as const, color: colors.destructive, value: totals.expenses, label: t("overview.expenses") },
              ...(totals.savings > 0
                ? [{ key: "saved", icon: "vault" as const, color: colors.vault, value: totals.savings, label: t("overview.saved") }]
                : []),
            ].map((item) => (
              <View key={item.key} style={styles.totalItem} accessible accessibilityLabel={`${item.label} ${formatMoney(item.value, currency)}`}>
                <Icon name={item.icon} size={16} color={item.color} />
                <Text style={[type.subheadline, money, { color: colors.textSecondary }]}>
                  {formatMoney(item.value, currency)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Month */}
        <View style={styles.monthPicker}>
          <Pressable onPress={() => handleShift(-1)} style={styles.chevron} accessibilityRole="button" accessibilityLabel={t("a11y.prevMonth")}>
            <Icon name="chevronBack" size={20} color={colors.accent} />
          </Pressable>
          <Text style={[type.headline, styles.monthText, { color: colors.text }]} accessibilityRole="header">
            {formatMonthWide(monthStart(selectedMonth), i18n.language)}
          </Text>
          <Pressable onPress={() => handleShift(1)} style={styles.chevron} accessibilityRole="button" accessibilityLabel={t("a11y.nextMonth")}>
            <Icon name="chevronForward" size={20} color={colors.accent} />
          </Pressable>
        </View>

        {totals.expenses === 0 ? (
          <View style={styles.empty}>
            <Icon name="chart" size={48} color={colors.placeholder} />
            <Text style={[type.title3, { color: colors.text }]}>{t("overview.noExpenses")}</Text>
            <Text style={[type.footnote, styles.emptySub, { color: colors.textSecondary }]}>{t("overview.noExpensesSub")}</Text>
          </View>
        ) : (
          <>
            <View style={heroCard}>
              <DonutChart
                parts={parts.map((p) => ({ key: p.category?.id ?? "none", color: partColor(p), amount: p.amount }))}
                total={totals.expenses}
                currency={currency}
                animKey={selectedMonth}
                accessibilityLabel={`${t("overview.spent")} ${formatMoney(totals.expenses, currency)}. ${donutSummary}`}
              />
            </View>
            <Section title={t("overview.byCategory")}>
              {parts.map((p, i) => {
                const pct = totals.expenses > 0 ? (p.amount / totals.expenses) * 100 : 0;
                return (
                  <View key={p.category?.id ?? "none"}>
                    <View style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: partColor(p) }]} />
                      <Text style={[type.body, styles.legendName, { color: colors.text }]} numberOfLines={1}>
                        {partLabel(p)}
                      </Text>
                      <Text style={[type.subheadline, money, { color: colors.textSecondary }]}>
                        {formatMoney(p.amount, currency)}
                      </Text>
                      <Text style={[type.footnote, money, styles.legendPct, { color: colors.textSecondary }]}>
                        {Math.round(pct)}%
                      </Text>
                    </View>
                    {i < parts.length - 1 && <Separator inset={space[4] + 12 + space[3]} />}
                  </View>
                );
              })}
            </Section>
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content:      { paddingHorizontal: GUTTER, paddingTop: space[2], paddingBottom: space[8], gap: SECTION_GAP },
  headerButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  hero:         { padding: space[5], gap: space[1], ...corners(radius.lg) },
  totalsRow:    { flexDirection: "row", flexWrap: "wrap", columnGap: space[5], rowGap: space[2], marginTop: space[2] },
  totalItem:    { flexDirection: "row", alignItems: "center", gap: space[1] + 2 },
  monthPicker:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: -space[2] },
  chevron:      { width: ROW_MIN, height: ROW_MIN, alignItems: "center", justifyContent: "center" },
  monthText:    { textTransform: "capitalize" },
  empty:        { alignItems: "center", paddingVertical: space[10] + space[5], gap: space[3] },
  emptySub:     { textAlign: "center", paddingHorizontal: space[8] },
  donutWrapper: { alignItems: "center", justifyContent: "center", paddingVertical: space[2] },
  donutHole:    { position: "absolute", alignItems: "center", justifyContent: "center", paddingHorizontal: space[2] },
  legendRow:    { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], minHeight: ROW_MIN },
  legendDot:    { width: 12, height: 12, borderRadius: 6 },
  legendName:   { flex: 1 },
  legendPct:    { minWidth: 40, textAlign: "right" },
});
