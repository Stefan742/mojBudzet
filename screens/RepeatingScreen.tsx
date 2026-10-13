import React, { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { v4 as uuid } from "uuid";
import { RecurringRule, TransactionKind, dateKey } from "../models";
import { useAppStore } from "../store/useAppStore";
import { formatMoney } from "../utils/money";
import { remindersBlocked, requestReminderPermission } from "../services/reminders";
import { useTheme } from "@/hooks/useTheme";
import { useCurrency } from "@/hooks/useCurrency";
import { Icon } from "@/components/Icon";
import { PressableRow } from "@/components/ui/Pressables";
import { Section, Separator } from "@/components/ui/Section";
import { RecurringEditor } from "@/components/recurring/RecurringEditor";
import { ruleName, scheduleLabel } from "@/components/recurring/text";
import { GUTTER, ROW_MIN, SECTION_GAP, corners, money, space, type } from "@/constants/design";

/** Settings › Repeating: every repeating transaction, the reminders switch, and the editor. */
export default function RepeatingScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const currency = useCurrency();
  const recurring           = useAppStore((s) => s.recurring);
  const remindersEnabled    = useAppStore((s) => s.remindersEnabled);
  const setRemindersEnabled = useAppStore((s) => s.setRemindersEnabled);
  const { edit } = useLocalSearchParams<{ edit?: string }>();

  // Opened from a due sheet's "Edit repeating": start in that rule's editor.
  const [editor, setEditor] = useState<{ rule: RecurringRule; isNew: boolean } | null>(() => {
    const rule = edit ? useAppStore.getState().recurring.find((r) => r.id === edit) : undefined;
    return rule ? { rule, isNew: false } : null;
  });
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let alive = true;
    void remindersBlocked().then((b) => alive && setBlocked(b));
    return () => { alive = false; };
  }, [remindersEnabled]);

  const toggleReminders = async (on: boolean) => {
    setRemindersEnabled(on);
    if (on && !(await requestReminderPermission())) setBlocked(await remindersBlocked());
  };

  // Ids are made here, in the handler, never during render (KB-1).
  const openNew = () =>
    setEditor({
      rule: {
        id: uuid(), kind: TransactionKind.EXPENSE, merchant: "", amount: 0, variable: false, note: "",
        frequency: "monthly", day: new Date().getDate(), ask: true, paused: false, nextDate: dateKey(new Date()),
      },
      isNew: true,
    });

  const groups = [
    { key: "expense", title: t("repeating.expenses"), rules: recurring.filter((r) => r.kind === TransactionKind.EXPENSE) },
    { key: "income", title: t("repeating.income"), rules: recurring.filter((r) => r.kind === TransactionKind.INCOME) },
  ].filter((g) => g.rules.length > 0);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={openNew} hitSlop={8} style={styles.headerButton} accessibilityRole="button" accessibilityLabel={t("repeating.newTitle")}>
              <Icon name="plus" size={22} color={colors.accent} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
      >
        <Section footer={blocked ? t("repeating.remindersBlocked") : t("repeating.remindersFooter")} footerColor={blocked ? colors.destructive : undefined}>
          <View style={styles.row}>
            <View style={[styles.tile, { backgroundColor: "#FF3B30" }]}>
              <Icon name="bell" size={16} color="#FFFFFF" />
            </View>
            <Text style={[type.body, styles.flex, { color: colors.text }]}>{t("repeating.reminders")}</Text>
            <View style={styles.switchSlot}>
              <Switch
                value={remindersEnabled && !blocked}
                onValueChange={(on) => void toggleReminders(on)}
                trackColor={{ true: colors.success }}
                accessibilityLabel={t("repeating.reminders")}
              />
            </View>
          </View>
          {blocked && (
            <>
              <Separator />
              <PressableRow style={styles.row} onPress={() => void Linking.openSettings()} accessibilityRole="link">
                <Text style={[type.body, { color: colors.accent }]}>{t("repeating.openSettings")}</Text>
              </PressableRow>
            </>
          )}
        </Section>

        {groups.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="repeat" size={44} color={colors.placeholder} />
            <Text style={[type.title3, { color: colors.text }]}>{t("repeating.empty")}</Text>
            <Text style={[type.footnote, styles.emptySub, { color: colors.textSecondary }]}>{t("repeating.emptySub")}</Text>
          </View>
        ) : (
          groups.map((g) => (
            <Section key={g.key} title={g.title}>
              {g.rules.map((rule, i) => (
                <View key={rule.id}>
                  {i > 0 && <Separator />}
                  <PressableRow
                    style={styles.row}
                    onPress={() => setEditor({ rule, isNew: false })}
                    accessibilityRole="button"
                    accessibilityHint={t("a11y.editHint")}
                  >
                    <View style={styles.flex}>
                      <Text style={[type.body, { color: rule.paused ? colors.textSecondary : colors.text }]} numberOfLines={1}>
                        {ruleName(rule, t)}
                      </Text>
                      <Text style={[type.footnote, { color: colors.textSecondary }]} numberOfLines={1}>
                        {scheduleLabel(rule, i18n.language, t)}
                      </Text>
                    </View>
                    <Text style={[type.subheadline, money, { color: rule.paused ? colors.textSecondary : colors.text }]}>
                      {rule.variable && rule.amount > 0 ? "≈ " : ""}
                      {rule.variable && rule.amount === 0 ? t("repeating.varies") : formatMoney(rule.amount, currency)}
                    </Text>
                    <Icon name="chevronForward" size={14} color={colors.textTertiary} />
                  </PressableRow>
                </View>
              ))}
            </Section>
          ))
        )}
      </ScrollView>

      {editor && <RecurringEditor rule={editor.rule} isNew={editor.isNew} onClose={() => setEditor(null)} />}
    </>
  );
}

const styles = StyleSheet.create({
  flex:         { flex: 1 },
  content:      { paddingHorizontal: GUTTER, paddingTop: space[2], paddingBottom: space[8], gap: SECTION_GAP },
  headerButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  row:          { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[2], minHeight: ROW_MIN + 8 },
  tile:         { width: 29, height: 29, alignItems: "center", justifyContent: "center", ...corners(7) },
  switchSlot:   { width: 64, height: 40, alignItems: "center", justifyContent: "center" },
  empty:        { alignItems: "center", paddingVertical: space[10], gap: space[3] },
  emptySub:     { textAlign: "center", paddingHorizontal: space[8] },
});
