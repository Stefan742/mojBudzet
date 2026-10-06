import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions, Animated, Modal, Alert,
} from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/useAppStore";
import { formatAmount, formatMonthWide, shiftMonth } from "../utils/helpers";
import { Category, TransactionKind } from "../models";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { v4 as uuid } from "uuid";
import { useTheme } from "@/hooks/useTheme";

const { width } = Dimensions.get("window");
const CHART_SIZE          = Math.min(width - 80, 260);
const RADIUS              = CHART_SIZE / 2 - 24;
const STROKE              = CHART_SIZE * 0.13;
const CX                  = CHART_SIZE / 2;
const CY                  = CHART_SIZE / 2;
const TAB_BAR_HEIGHT      = 72;
const TAB_BAR_BOTTOM_SAFE = 34;
const SHOWN_KEY           = "leftover_modal_shown";
const CARD_RADIUS         = 20;
const H_PAD               = 20;

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
  data: [Category, number][];
  total: number;
  currency: string;
  animTrigger: number;
}

function DonutChart({ data, total, currency, animTrigger }: DonutChartProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const [animValue, setAnimValue] = useState(0);

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    setAnimValue(0);
    const id = progress.addListener(({ value }) => setAnimValue(value));
    Animated.timing(progress, { toValue: 1, duration: 900, useNativeDriver: false }).start();
    return () => progress.removeListener(id);
  }, [animTrigger]);

  if (data.length === 0) return null;

  const GAP_DEG = data.length > 1 ? 2 : 0;
  let cumulativeDeg = 0;

  const segments: { cat: Category; startDeg: number; endDeg: number }[] = data.map(([cat, value]) => {
    const pct      = total > 0 ? value / total : 0;
    const fullSpan = pct * 360;
    const startDeg = cumulativeDeg + GAP_DEG / 2;
    // ── FIX: clamp до 359.99° за да не се совпаѓаат start и end точките
    //    кога има само 1 категорија (360° arc = невалиден SVG path → исчезнува)
    const endDeg   = Math.min(cumulativeDeg + fullSpan - GAP_DEG / 2, startDeg + 359.99);
    cumulativeDeg += fullSpan;
    return { cat, startDeg, endDeg };
  });

  const totalAnimDeg = animValue * 360;

  return (
    <View style={styles.donutWrapper}>
      <Svg width={CHART_SIZE} height={CHART_SIZE}>
        <Circle cx={CX} cy={CY} r={RADIUS} fill="none" stroke="#f0f0f0" strokeWidth={STROKE} />
        {segments.map(({ cat, startDeg, endDeg }) => {
          if (totalAnimDeg <= startDeg) return null;
          const clampedEnd = Math.min(endDeg, totalAnimDeg);
          if (clampedEnd - startDeg < 0.1) return null;
          const d = describeArc(CX, CY, RADIUS, STROKE, startDeg, clampedEnd);
          return <Path key={cat.id} d={d} fill={cat.colorHex} opacity={0.93} />;
        })}
      </Svg>
      <View
        style={[
          styles.donutHole,
          {
            width: CHART_SIZE * 0.52, height: CHART_SIZE * 0.52,
            borderRadius: (CHART_SIZE * 0.52) / 2,
            top: CY - (CHART_SIZE * 0.52) / 2,
            left: CX - (CHART_SIZE * 0.52) / 2,
            backgroundColor: colors.card,
          },
        ]}
        pointerEvents="none"
      >
        <Text style={[styles.donutLabel, { color: colors.textSecondary }]}>{t("overview.spent")}</Text>
        <Text style={[styles.donutAmount, { color: colors.text }]}>{formatAmount(total, currency)}</Text>
      </View>
    </View>
  );
}

// ─── Leftover Modal ───────────────────────────────────────────────────────────
interface LeftoverModalProps {
  visible: boolean;
  amount: number;
  currency: string;
  onCarryOver: () => void;
  onSaveToGoal: (goalId: string | null) => void;
  onDismiss: () => void;
}

function LeftoverModal({
  visible, amount, currency, onCarryOver, onSaveToGoal, onDismiss,
}: LeftoverModalProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const savingsGoals = useAppStore((s) => s.savingsGoals);

  const [step, setStep]               = useState<"choice" | "pick_goal">("choice");
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) { setStep("choice"); setSelectedGoalId(null); }
  }, [visible]);

  const handleSavePressed = () => {
    if (savingsGoals.length > 0) setStep("pick_goal");
    else onSaveToGoal(null);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.card, { backgroundColor: colors.card, shadowColor: colors.text }]}>
          {step === "choice" ? (
            <>
              <View style={[modalStyles.iconBadge, { backgroundColor: colors.accent + "22" }]}>
                <Ionicons name="wallet-outline" size={28} color={colors.accent} />
              </View>
              <Text style={[modalStyles.title, { color: colors.text }]}>{t("leftover.title")}</Text>
              <Text style={[modalStyles.subtitle, { color: colors.textSecondary }]}>{t("leftover.subtitle")}</Text>
              <View style={[modalStyles.amountPill, { backgroundColor: colors.accent + "18" }]}>
                <Text style={[modalStyles.amountText, { color: colors.accent }]}>
                  {formatAmount(amount, currency)}
                </Text>
              </View>
              <Text style={[modalStyles.question, { color: colors.textSecondary }]}>{t("leftover.question")}</Text>
              <TouchableOpacity
                style={[modalStyles.btn, { backgroundColor: colors.accent }]}
                onPress={handleSavePressed}
                activeOpacity={0.8}
              >
                <Ionicons name="save-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={[modalStyles.btnText, { color: "#fff" }]}>{t("leftover.save")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modalStyles.btn, { backgroundColor: colors.accent + "18", borderWidth: 1.5, borderColor: colors.accent }]}
                onPress={onCarryOver}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-forward-circle-outline" size={18} color={colors.accent} style={{ marginRight: 8 }} />
                <Text style={[modalStyles.btnText, { color: colors.accent }]}>{t("leftover.carryOver")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onDismiss} style={modalStyles.skipBtn}>
                <Text style={[modalStyles.skipText, { color: colors.textTertiary }]}>{t("leftover.later")}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={() => setStep("choice")} style={modalStyles.backBtn}>
                <Ionicons name="chevron-back" size={20} color={colors.accent} />
                <Text style={[modalStyles.backText, { color: colors.accent }]}>{t("leftover.back")}</Text>
              </TouchableOpacity>
              <Text style={[modalStyles.title, { color: colors.text }]}>{t("leftover.whereToSave")}</Text>
              <Text style={[modalStyles.subtitle, { color: colors.textSecondary }]}>
                {t("leftover.whereToSave")}{" "}
                <Text style={{ fontWeight: "700", color: colors.text }}>{t("leftover.vault")}</Text>{" "}
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
                >
                  <View style={[modalStyles.goalIconBox, { backgroundColor: "#FFF7ED" }]}>
                    <Ionicons name="lock-closed" size={18} color="#F97316" />
                  </View>
                  <View style={modalStyles.goalInfo}>
                    <Text style={[modalStyles.goalName, { color: colors.text }]}>{t("leftover.vault")}</Text>
                    <Text style={[modalStyles.goalProgress, { color: colors.textTertiary }]}>
                      {t("leftover.vaultDesc")}
                    </Text>
                  </View>
                  <View style={[
                    modalStyles.checkCircle,
                    { borderColor: colors.separator, backgroundColor: colors.card },
                    selectedGoalId === null && { backgroundColor: colors.accent, borderColor: colors.accent },
                  ]}>
                    {selectedGoalId === null && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                </TouchableOpacity>

                {savingsGoals.map((g) => {
                  const isSelected = selectedGoalId === g.id;
                  const pct = g.targetAmount > 0
                    ? Math.min((g.currentAmount / g.targetAmount) * 100, 100)
                    : 0;
                  return (
                    <TouchableOpacity
                      key={g.id}
                      style={[
                        modalStyles.goalRow,
                        { backgroundColor: colors.inputBg, borderColor: "transparent" },
                        isSelected && { backgroundColor: colors.accent + "18", borderColor: colors.accent },
                      ]}
                      onPress={() => setSelectedGoalId(isSelected ? null : g.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[modalStyles.goalIconBox, { backgroundColor: g.colorHex + "22" }]}>
                        <View style={[modalStyles.goalDot, { backgroundColor: g.colorHex }]} />
                      </View>
                      <View style={modalStyles.goalInfo}>
                        <Text style={[modalStyles.goalName, { color: colors.text }]}>{g.name}</Text>
                        <Text style={[modalStyles.goalProgress, { color: colors.textTertiary }]}>
                          {formatAmount(g.currentAmount, currency)} / {formatAmount(g.targetAmount, currency)}
                        </Text>
                        <View style={[modalStyles.progressTrack, { backgroundColor: colors.separator }]}>
                          <View style={[modalStyles.progressFill, { width: `${pct}%`, backgroundColor: g.colorHex }]} />
                        </View>
                      </View>
                      <View style={[
                        modalStyles.checkCircle,
                        { borderColor: colors.separator, backgroundColor: colors.card },
                        isSelected && { backgroundColor: colors.accent, borderColor: colors.accent },
                      ]}>
                        {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity
                style={[modalStyles.btn, { backgroundColor: colors.accent, marginTop: 12 }]}
                onPress={() => onSaveToGoal(selectedGoalId)}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={[modalStyles.btnText, { color: "#fff" }]}>{t("leftover.confirm")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onDismiss} style={modalStyles.skipBtn}>
                <Text style={[modalStyles.skipText, { color: colors.textTertiary }]}>{t("leftover.later")}</Text>
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
  const { t } = useTranslation();
  const { colors } = useTheme();

  const transactions   = useAppStore((s) => s.transactions);
  const categories     = useAppStore((s) => s.categories);
  const savingsGoals   = useAppStore((s) => s.savingsGoals);
  const initialBalance = useAppStore((s) => s.initialBalance);
  const currency       = useAppStore((s) => s.currency);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const updateGoal     = useAppStore((s) => s.updateGoal);
  const addToVault     = useAppStore((s) => s.addToVault);

  const [selectedMonth, setSelectedMonth]           = useState(new Date());
  const [animTrigger, setAnimTrigger]               = useState(0);
  const [leftoverModalVisible, setLeftoverModalVisible] = useState(false);
  const leftoverRef = useRef<number>(0);
  const insets      = useSafeAreaInsets();

  const currentBalance = useMemo(
    () => initialBalance + transactions.reduce(
      (acc, tx) => acc + (tx.kind === TransactionKind.INCOME ? tx.amount : -tx.amount), 0
    ),
    [initialBalance, transactions]
  );

  const totalIncome = useMemo(
    () => transactions
      .filter((tx) => {
        if (tx.kind !== TransactionKind.INCOME) return false;
        const d = new Date(tx.date);
        return d.getFullYear() === selectedMonth.getFullYear() && d.getMonth() === selectedMonth.getMonth();
      })
      .reduce((sum, tx) => sum + tx.amount, 0),
    [transactions, selectedMonth]
  );

  const totalExpenses = useMemo(
    () => transactions
      .filter((tx) => {
        if (tx.kind !== TransactionKind.EXPENSE) return false;
        const d = new Date(tx.date);
        return d.getFullYear() === selectedMonth.getFullYear() && d.getMonth() === selectedMonth.getMonth();
      })
      .reduce((sum, tx) => sum + tx.amount, 0),
    [transactions, selectedMonth]
  );

  const data = useMemo((): [Category, number][] => {
    const filtered = transactions.filter((tx) => {
      if (tx.kind !== TransactionKind.EXPENSE) return false;
      const d = new Date(tx.date);
      return d.getFullYear() === selectedMonth.getFullYear() && d.getMonth() === selectedMonth.getMonth();
    });
    return categories
      .map((c): [Category, number] => {
        const sum = filtered
          .filter((tx) => tx.categoryId === c.id)
          .reduce((acc, tx) => acc + tx.amount, 0);
        return [c, sum];
      })
      .filter(([, sum]) => sum > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [transactions, categories, selectedMonth]);

  const totalMonth = useMemo(() => data.reduce((sum, [, v]) => sum + v, 0), [data]);

  useEffect(() => {
    const now = new Date();
    if (now.getDate() !== 1 || currentBalance <= 0) return;
    const monthKey = `${SHOWN_KEY}_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (!(globalThis as any)[monthKey]) {
      (globalThis as any)[monthKey] = true;
      leftoverRef.current = currentBalance;
      addTransaction({
        id: uuid(), amount: currentBalance, kind: TransactionKind.EXPENSE,
        date: new Date().toISOString(), note: t("leftover.carryMsg"),
        merchant: "", source: "Рачно", categoryId: undefined, subcategoryId: undefined,
      });
      setLeftoverModalVisible(true);
    }
  }, []);

  useFocusEffect(useCallback(() => { setAnimTrigger((n) => n + 1); }, []));

  const handleShift = (delta: number) => {
    setSelectedMonth((d) => shiftMonth(d, delta));
    setAnimTrigger((n) => n + 1);
  };

  const handleCarryOver = useCallback(() => {
    const leftover = leftoverRef.current;
    addTransaction({
      id: uuid(), amount: leftover, kind: TransactionKind.INCOME,
      date: new Date().toISOString(), note: t("leftover.carryMsg"),
      merchant: "", source: "Рачно", categoryId: undefined, subcategoryId: undefined,
    });
    setLeftoverModalVisible(false);
    Alert.alert(t("leftover.carryAlert"), `${formatAmount(leftover, currency)} ${t("leftover.carryMsg")}`);
  }, [currency, addTransaction, t]);

  const handleSaveToGoal = useCallback((goalId: string | null) => {
    const leftover = leftoverRef.current;
    if (goalId) {
      const goal = savingsGoals.find((g) => g.id === goalId);
      if (goal) updateGoal({ ...goal, currentAmount: goal.currentAmount + leftover });
      Alert.alert(t("leftover.savedAlert"), `${formatAmount(leftover, currency)} ${t("leftover.savedMsg")}`);
    } else {
      addToVault(leftover);
      Alert.alert(t("leftover.vaultAlert"), `${formatAmount(leftover, currency)} ${t("leftover.vaultMsg")}`);
    }
    setLeftoverModalVisible(false);
  }, [currency, savingsGoals, updateGoal, addToVault, t]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("overview.title")}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_SAFE + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.text }]}>
          <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>{t("overview.currentBalance")}</Text>
          <Text style={[styles.balance, { color: currentBalance < 0 ? colors.destructive : colors.text }]}>
            {formatAmount(currentBalance, currency)}
          </Text>
          <View style={styles.incomeRow}>
            <View style={styles.incomeItem}>
              <Ionicons name="arrow-down-circle" size={16} color={colors.success} />
              <Text style={[styles.incomeText, { color: colors.textSecondary }]}>
                {formatAmount(totalIncome, currency)}
              </Text>
            </View>
            <View style={styles.incomeItem}>
              <Ionicons name="arrow-up-circle" size={16} color={colors.destructive} />
              <Text style={[styles.incomeText, { color: colors.textSecondary }]}>
                {formatAmount(totalExpenses, currency)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.monthPicker}>
          <TouchableOpacity onPress={() => handleShift(-1)} style={styles.chevron}>
            <Ionicons name="chevron-back" size={20} color={colors.accent} />
          </TouchableOpacity>
          <Text style={[styles.monthText, { color: colors.text }]}>{formatMonthWide(selectedMonth)}</Text>
          <TouchableOpacity onPress={() => handleShift(1)} style={styles.chevron}>
            <Ionicons name="chevron-forward" size={20} color={colors.accent} />
          </TouchableOpacity>
        </View>

        {data.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="pie-chart-outline" size={56} color={colors.separator} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("overview.noExpenses")}</Text>
            <Text style={[styles.emptySub, { color: colors.textTertiary }]}>{t("overview.noExpensesSub")}</Text>
          </View>
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.text }]}>
              <DonutChart data={data} total={totalMonth} currency={currency} animTrigger={animTrigger} />
            </View>
            <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.text }]}>
              {data.map(([cat, value], i) => {
                const pct = totalMonth > 0 ? (value / totalMonth) * 100 : 0;
                return (
                  <View key={cat.id}>
                    <View style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: cat.colorHex }]} />
                      <Text style={[styles.legendName, { color: colors.text }]}>{cat.name}</Text>
                      <View style={{ flex: 1 }} />
                      <Text style={[styles.legendAmount, { color: colors.textSecondary }]}>
                        {formatAmount(value, currency)}
                      </Text>
                      <Text style={[styles.legendPct, { color: colors.textTertiary }]}>
                        {Math.round(pct)}%
                      </Text>
                    </View>
                    {i < data.length - 1 && (
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
        visible={leftoverModalVisible}
        amount={leftoverRef.current}
        currency={currency}
        onCarryOver={handleCarryOver}
        onSaveToGoal={handleSaveToGoal}
        onDismiss={() => setLeftoverModalVisible(false)}
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
  btn:         { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 14, marginBottom: 10 },
  btnText:     { fontSize: 16, fontWeight: "600" },
  skipBtn:     { marginTop: 4, paddingVertical: 8 },
  skipText:    { fontSize: 14 },
  backBtn:     { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginBottom: 12 },
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
  incomeRow:   { flexDirection: "row", gap: 20, marginTop: 12 },
  incomeItem:  { flexDirection: "row", alignItems: "center", gap: 6 },
  incomeText:  { fontSize: 14, fontWeight: "500" },
  monthPicker: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 },
  chevron:     { padding: 8 },
  monthText:   { fontSize: 17, fontWeight: "600" },
  empty:       { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle:  { fontSize: 20, fontWeight: "600" },
  emptySub:    { fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  donutWrapper: { alignItems: "center", justifyContent: "center", paddingVertical: 8, position: "relative" },
  donutHole:   { position: "absolute", alignItems: "center", justifyContent: "center", elevation: 2, marginLeft: 27, marginTop: 8 },
  donutLabel:  { fontSize: 12, marginBottom: 2 },
  donutAmount: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  legendRow:   { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  legendDot:   { width: 11, height: 11, borderRadius: 6 },
  legendName:  { fontSize: 15, fontWeight: "400" },
  legendAmount:{ fontSize: 14, fontWeight: "500" },
  legendPct:   { fontSize: 13, width: 38, textAlign: "right" },
  divider:     { height: StyleSheet.hairlineWidth, marginLeft: 21 },
});