import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { v4 as uuid } from "uuid";
import { RecurringRule, TransactionKind, dateKey } from "../../models";
import { useAppStore } from "../../store/useAppStore";
import { findRepeatSuggestions } from "../../services/repeatingSuggestions";
import { formatMoney } from "../../utils/money";
import { haptics } from "../../utils/haptics";
import { useTheme } from "@/hooks/useTheme";
import { useCurrency } from "@/hooks/useCurrency";
import { Icon } from "@/components/Icon";
import { RecurringEditor } from "./RecurringEditor";
import { corners, radius, space, tint, type } from "@/constants/design";

const INTRO = "repeating-intro";

/**
 * Teaches repeating transactions where they pay off, TipKit style: a
 * suggestion from the user's own history ("Kirija looks like it repeats"),
 * or, for someone with no repeating expenses yet, a one-time intro. One
 * card at a time; closed ones never come back.
 */
export function RepeatTips() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const currency = useCurrency();
  const transactions = useAppStore((s) => s.transactions);
  const recurring    = useAppStore((s) => s.recurring);
  const dismissed    = useAppStore((s) => s.dismissedTips);
  const dismissTip   = useAppStore((s) => s.dismissTip);
  const thisMonth    = useAppStore(() => dateKey(new Date()).slice(0, 7));
  const [editor, setEditor] = useState<RecurringRule | null>(null);

  const suggestion = useMemo(
    () => {
      // A built-in name covers what the user types today: "Кирија", not the saved "Rent".
      const named = recurring.map((r) => (r.nameKey ? { ...r, merchant: t(r.nameKey) } : r));
      return findRepeatSuggestions(transactions, named, dismissed, new Date())[0] ?? null;
    },
    // Re-checked when the data, the language or the month changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, recurring, dismissed, thisMonth, t]
  );
  const showIntro =
    !suggestion && !dismissed.includes(INTRO) && !recurring.some((r) => r.kind === TransactionKind.EXPENSE);

  if (!suggestion && !showIntro && !editor) return null;

  const close = (key: string) => {
    haptics.selection();
    dismissTip(key);
  };

  // Ids are made here, in the handler, never during render (KB-1).
  const setUp = () => {
    haptics.selection();
    setEditor(
      suggestion
        ? { id: uuid(), ...suggestion.rule }
        : {
            id: uuid(), kind: TransactionKind.EXPENSE, merchant: "", amount: 0, variable: false, note: "",
            frequency: "monthly", day: new Date().getDate(), ask: true, paused: false, nextDate: dateKey(new Date()),
          }
    );
  };

  const title = suggestion ? t("repeatTips.detectedTitle", { name: suggestion.rule.merchant }) : t("repeatTips.introTitle");
  const body = suggestion
    ? t(suggestion.rule.variable ? "repeatTips.detectedBodyVaries" : "repeatTips.detectedBody", {
        amount: formatMoney(suggestion.rule.amount, currency),
        day: suggestion.rule.day,
        count: suggestion.months,
      })
    : t("repeatTips.introBody");

  return (
    <>
      {(suggestion || showIntro) && (
        <View style={[styles.card, { backgroundColor: colors.card }]} accessibilityRole="summary">
          <View style={[styles.tile, { backgroundColor: tint(colors.accent, "subtle") }]}>
            <Icon name="repeat" size={18} color={colors.accent} />
          </View>
          <View style={styles.text}>
            <Text style={[type.headline, { color: colors.text }]}>{title}</Text>
            <Text style={[type.subheadline, { color: colors.textSecondary }]}>{body}</Text>
            <View style={styles.actions}>
              <Pressable onPress={setUp} hitSlop={8} accessibilityRole="button">
                <Text style={[type.subheadline, styles.action, { color: colors.accent }]}>{t("repeatTips.setUp")}</Text>
              </Pressable>
              {suggestion && (
                <Pressable onPress={() => close(suggestion.key)} hitSlop={8} accessibilityRole="button">
                  <Text style={[type.subheadline, { color: colors.textSecondary }]}>{t("repeatTips.notNow")}</Text>
                </Pressable>
              )}
            </View>
          </View>
          {!suggestion && (
            <Pressable
              onPress={() => close(INTRO)}
              hitSlop={12}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel={t("repeatTips.close")}
            >
              <Icon name="close" size={14} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>
      )}
      {editor && <RecurringEditor rule={editor} isNew onClose={() => setEditor(null)} />}
    </>
  );
}

const styles = StyleSheet.create({
  card:        { flexDirection: "row", gap: space[3], padding: space[4], ...corners(radius.lg) },
  tile:        { width: 36, height: 36, alignItems: "center", justifyContent: "center", ...corners(radius.sm) },
  text:        { flex: 1, gap: space[1] },
  actions:     { flexDirection: "row", gap: space[5], marginTop: space[2] },
  action:      { fontWeight: "600" },
  closeButton: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
});
