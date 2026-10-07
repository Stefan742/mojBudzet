import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/useAppStore";
import { showToast } from "../store/session";
import { balanceOf, leftoverOf } from "../store/selectors";
import { formatMoney } from "../utils/money";
import { formatMonthWide, monthKey, monthStart, previousMonthKey } from "../utils/dates";
import { haptics } from "../utils/haptics";
import { useTheme } from "@/hooks/useTheme";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/Button";
import { PressableRow } from "@/components/ui/Pressables";
import { Section, Separator } from "@/components/ui/Section";
import { dataColor } from "@/constants/palette";
import { GUTTER, ROW_MIN, corners, money, radius, space, tint, type } from "@/constants/design";

/**
 * Month-end leftover, as a native form sheet (DESIGN.md §3.9). Nothing is
 * written until the user chooses (D-1). "Later" or swiping the sheet away
 * asks again on the next launch.
 */
export default function LeftoverSheet() {
  const { t, i18n } = useTranslation();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const currency = t("common.currency");

  const transactions     = useAppStore((s) => s.transactions);
  const initialBalance   = useAppStore((s) => s.initialBalance);
  const savingsGoals     = useAppStore((s) => s.savingsGoals);
  const markRolloverDone = useAppStore((s) => s.markRolloverDone);
  const saveFromBalance  = useAppStore((s) => s.saveFromBalance);
  const thisMonth        = useAppStore(() => monthKey(new Date()));

  const [step, setStep]                     = useState<"choice" | "pick">("choice");
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  const pendingMonth = previousMonthKey(thisMonth);
  const leftover = leftoverOf(transactions, pendingMonth, balanceOf(initialBalance, transactions));
  const monthLabel = formatMonthWide(monthStart(pendingMonth), i18n.language);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const carryOver = () => {
    markRolloverDone(thisMonth);
    haptics.success();
    showToast(t("leftover.toastCarried"));
    close();
  };

  const save = (goalId: string | null) => {
    saveFromBalance(leftover, goalId, "");
    markRolloverDone(thisMonth);
    haptics.success();
    const goal = savingsGoals.find((g) => g.id === goalId);
    showToast(t("leftover.toastSaved", { name: goal?.name ?? t("leftover.vault") }));
    close();
  };

  const radio = (selected: boolean) => (
    <View style={[styles.radio, { borderColor: selected ? colors.accent : colors.separator, backgroundColor: selected ? colors.accent : "transparent" }]}>
      {selected && <Icon name="check" size={13} color={colors.onAccent} />}
    </View>
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.surfaceRaised }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {step === "choice" ? (
        <>
          <View style={[styles.badge, { backgroundColor: tint(colors.accent, "subtle") }]}>
            <Icon name="wallet" size={28} color={colors.accent} />
          </View>
          <Text style={[type.title2, styles.center, { color: colors.text }]} accessibilityRole="header">
            {t("leftover.title")}
          </Text>
          <Text style={[type.subheadline, styles.center, { color: colors.textSecondary }]}>
            {t("leftover.subtitle", { month: monthLabel })}
          </Text>
          <Text style={[type.title1, money, styles.center, styles.amount, { color: colors.accent }]} adjustsFontSizeToFit numberOfLines={1}>
            {formatMoney(leftover, currency)}
          </Text>
          <Text style={[type.footnote, styles.center, { color: colors.textSecondary }]}>{t("leftover.question")}</Text>
          <View style={styles.actions}>
            <Button
              title={t("leftover.save")}
              icon="save"
              onPress={() => (savingsGoals.length > 0 ? setStep("pick") : save(null))}
            />
            <Button
              title={t("leftover.carryOver")}
              variant="tinted"
              onPress={carryOver}
              accessibilityHint={t("leftover.carryOverHint")}
            />
            <Button title={t("leftover.later")} variant="plain" onPress={close} />
          </View>
        </>
      ) : (
        <>
          <Text style={[type.title2, { color: colors.text }]} accessibilityRole="header">
            {t("leftover.whereToSave")}
          </Text>
          <Section cardStyle={{ backgroundColor: colors.background }}>
            <PressableRow
              style={styles.row}
              onPress={() => { haptics.selection(); setSelectedGoalId(null); }}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedGoalId === null }}
            >
              <View style={[styles.tile, { backgroundColor: colors.vaultBg }]}>
                <Icon name="vault" size={16} color={colors.vault} />
              </View>
              <View style={styles.rowText}>
                <Text style={[type.body, { color: colors.text }]}>{t("leftover.vault")}</Text>
                <Text style={[type.footnote, { color: colors.textSecondary }]}>{t("leftover.vaultDesc")}</Text>
              </View>
              {radio(selectedGoalId === null)}
            </PressableRow>
            {savingsGoals.map((g) => (
              <View key={g.id}>
                <Separator inset={space[4] + 32 + space[3]} />
                <PressableRow
                  style={styles.row}
                  onPress={() => { haptics.selection(); setSelectedGoalId(g.id); }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedGoalId === g.id }}
                >
                  <View style={[styles.tile, { backgroundColor: tint(dataColor(g.colorHex, isDark), "soft") }]}>
                    <Icon name="flag" size={16} color={dataColor(g.colorHex, isDark)} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={[type.body, { color: colors.text }]} numberOfLines={1}>{g.name}</Text>
                    <Text style={[type.footnote, money, { color: colors.textSecondary }]}>
                      {formatMoney(g.currentAmount, currency)} / {formatMoney(g.targetAmount, currency)}
                    </Text>
                  </View>
                  {radio(selectedGoalId === g.id)}
                </PressableRow>
              </View>
            ))}
          </Section>
          <View style={styles.actions}>
            <Button title={t("leftover.confirm")} onPress={() => save(selectedGoalId)} />
            <Button title={t("leftover.back")} variant="plain" onPress={() => setStep("choice")} />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: GUTTER, paddingTop: space[8], gap: space[3] },
  center:  { textAlign: "center" },
  badge:   { width: 56, height: 56, alignSelf: "center", alignItems: "center", justifyContent: "center", marginBottom: space[2], ...corners(radius.lg) },
  amount:  { marginVertical: space[2] },
  actions: { gap: space[2], marginTop: space[4] },
  row:     { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[2], minHeight: ROW_MIN + 12 },
  rowText: { flex: 1 },
  tile:    { width: 32, height: 32, alignItems: "center", justifyContent: "center", ...corners(radius.sm) },
  radio:   { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});
