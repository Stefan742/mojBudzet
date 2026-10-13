import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { RecurringRule, TransactionKind, dateKey, dayFromKey, isDue } from "../../models";
import { useAppStore } from "../../store/useAppStore";
import { showToast } from "../../store/session";
import { findCategory } from "../../store/selectors";
import { formatMoney } from "../../utils/money";
import { haptics } from "../../utils/haptics";
import { useTheme } from "@/hooks/useTheme";
import { useCurrency } from "@/hooks/useCurrency";
import { Icon } from "@/components/Icon";
import { CategoryIcon } from "@/components/CategoryIcon";
import { PressableRow, PressableScale } from "@/components/ui/Pressables";
import { Section, Separator } from "@/components/ui/Section";
import { dataColor } from "@/constants/palette";
import { ROW_MIN, corners, money, radius, space, tint, type } from "@/constants/design";
import { dueLabel, ruleName, upcomingLabel } from "./text";

const TILE = 32;
const UPCOMING_DAYS = 7;

/**
 * Overview card for repeating transactions: what is due now, with a one-tap
 * Add (or Received for income), and what comes in the next week. Renders
 * nothing when there is neither.
 */
export function DueSection() {
  const { t, i18n } = useTranslation();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const currency = useCurrency();
  const recurring = useAppStore((s) => s.recurring);
  const categories = useAppStore((s) => s.categories);
  // Through a selector so it is fresh on every render (React Compiler caches plain values).
  const today = useAppStore(() => dateKey(new Date()));

  const weekAhead = dateKey(new Date(dayFromKey(today).getTime() + UPCOMING_DAYS * 86_400_000));
  const due = recurring.filter((r) => isDue(r, today)).sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  const upcoming = recurring
    .filter((r) => !r.paused && r.nextDate > today && r.nextDate <= weekAhead)
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  // "Add all" only for amounts that are known; changing ones need a number.
  const fixedDue = due.filter((r) => !r.variable && r.amount > 0);

  if (!due.length && !upcoming.length) return null;

  const undoAction = (undo: ReturnType<ReturnType<typeof useAppStore.getState>["addRecurringOccurrence"]>) =>
    undo ? { label: t("repeating.undo"), onPress: () => useAppStore.getState().undoRecurring(undo) } : undefined;

  const openSheet = (rule: RecurringRule) => router.push({ pathname: "/due", params: { id: rule.id } });

  const quickAdd = (rule: RecurringRule) => {
    if (rule.variable || rule.amount <= 0) {
      openSheet(rule);
      return;
    }
    const undo = useAppStore.getState().addRecurringOccurrence(rule.id);
    haptics.success();
    showToast(t("repeating.added", { name: ruleName(rule, t) }), "checkCircle", undefined, undoAction(undo));
  };

  const addAll = () => {
    const undo = useAppStore.getState().addDueOccurrences(fixedDue.map((r) => r.id), today);
    if (!undo) return;
    haptics.success();
    showToast(t("repeating.addedMany", { count: undo.transactionIds.length }), "checkCircle", undefined, undoAction(undo));
  };

  const tile = (rule: RecurringRule) => {
    if (rule.kind === TransactionKind.INCOME) {
      return (
        <View style={[styles.tile, { backgroundColor: colors.successBg }]}>
          <Icon name="income" size={16} color={colors.success} />
        </View>
      );
    }
    const cat = findCategory(categories, rule.categoryId);
    const color = cat ? dataColor(cat.colorHex, isDark) : colors.textSecondary;
    return (
      <View style={[styles.tile, { backgroundColor: cat ? tint(color, "soft") : colors.fill }]}>
        {cat ? <CategoryIcon iconName={cat.iconName} size={16} color={color} /> : <Icon name="repeat" size={16} color={color} />}
      </View>
    );
  };

  const amountText = (rule: RecurringRule) => {
    if (rule.variable) return rule.amount > 0 ? `≈ ${formatMoney(rule.amount, currency)}` : t("repeating.varies");
    return `${rule.kind === TransactionKind.INCOME ? "+" : ""}${formatMoney(rule.amount, currency)}`;
  };

  return (
    <View style={styles.wrap}>
      {due.length > 0 && (
        <View>
          <View style={styles.header}>
            <Text style={[type.sectionHeader, { color: colors.textSecondary }]} accessibilityRole="header">
              {t("repeating.dueNow", { count: due.length })}
            </Text>
            {fixedDue.length > 1 && (
              <Pressable onPress={addAll} hitSlop={8} accessibilityRole="button">
                <Text style={[type.subheadline, { color: colors.accent }]}>{t("repeating.addAll")}</Text>
              </Pressable>
            )}
          </View>
          <Section>
            {due.map((rule, i) => {
              const income = rule.kind === TransactionKind.INCOME;
              const name = ruleName(rule, t);
              return (
                <View key={rule.id}>
                  {i > 0 && <Separator inset={space[4] + TILE + space[3]} />}
                  {/* The row and its button are siblings, so each is its own tap target
                      (and VoiceOver element) instead of a button inside a button. */}
                  <View style={styles.dueRow}>
                    <PressableRow
                      style={[styles.row, styles.rowMain]}
                      onPress={() => openSheet(rule)}
                      accessibilityRole="button"
                      accessibilityLabel={`${name}, ${dueLabel(rule, today, i18n.language, t)}, ${amountText(rule)}`}
                      accessibilityHint={t("repeating.rowHint")}
                    >
                      {tile(rule)}
                      {/* Amount on the name line, so the date line gets the full width. */}
                      <View style={styles.text}>
                        <View style={styles.titleLine}>
                          <Text style={[type.body, styles.name, { color: colors.text }]} numberOfLines={1}>{name}</Text>
                          <Text
                            style={[type.subheadline, money, { color: income ? colors.success : rule.variable ? colors.textSecondary : colors.text }]}
                            numberOfLines={1}
                          >
                            {amountText(rule)}
                          </Text>
                        </View>
                        <Text style={[type.footnote, { color: colors.textSecondary }]} numberOfLines={1}>
                          {dueLabel(rule, today, i18n.language, t)}
                        </Text>
                      </View>
                    </PressableRow>
                    <PressableScale
                      onPress={() => quickAdd(rule)}
                      style={[styles.pill, { backgroundColor: tint(colors.accent, "subtle") }]}
                      accessibilityRole="button"
                      accessibilityLabel={`${income ? t("repeating.received") : t("repeating.add")} ${name}`}
                    >
                      <Text style={[type.subheadline, styles.pillText, { color: colors.accent }]}>
                        {income ? t("repeating.received") : t("repeating.add")}
                      </Text>
                    </PressableScale>
                  </View>
                </View>
              );
            })}
          </Section>
        </View>
      )}

      {upcoming.length > 0 && (
        <Section title={t("repeating.comingUp")}>
          {upcoming.map((rule, i) => (
            <View key={rule.id}>
              {i > 0 && <Separator inset={space[4] + TILE + space[3]} />}
              <View style={styles.row} accessible accessibilityLabel={`${ruleName(rule, t)}, ${upcomingLabel(rule, today, t)}, ${amountText(rule)}`}>
                {tile(rule)}
                <View style={styles.text}>
                  <Text style={[type.body, { color: colors.text }]} numberOfLines={1}>{ruleName(rule, t)}</Text>
                  <Text style={[type.footnote, { color: colors.textSecondary }]}>{upcomingLabel(rule, today, t)}</Text>
                </View>
                <Text style={[type.subheadline, money, { color: colors.textSecondary }]} numberOfLines={1}>{amountText(rule)}</Text>
              </View>
            </View>
          ))}
        </Section>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:     { gap: space[6] },
  header:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space[4], marginBottom: space[2] },
  row:      { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[2], minHeight: ROW_MIN + 12 },
  dueRow:   { flexDirection: "row", alignItems: "center", paddingRight: space[4] },
  rowMain:  { flex: 1, paddingRight: space[3] },
  tile:     { width: TILE, height: TILE, alignItems: "center", justifyContent: "center", ...corners(radius.sm) },
  text:     { flex: 1, minWidth: 0, gap: 2 },
  titleLine: { flexDirection: "row", alignItems: "baseline", gap: space[2] },
  name:     { flex: 1, minWidth: 0 },
  pill:     { paddingHorizontal: space[3], minHeight: 30, justifyContent: "center", ...corners(radius.pill) },
  pillText: { fontWeight: "600" },
});
