import { useEffect } from "react";
import { AppState } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { TransactionKind, dateKey, dayFromKey, followingDate, isDue } from "../models";
import { useAppStore } from "../store/useAppStore";
import { showToast } from "../store/session";
import { formatMoney, moneyFormat } from "../utils/money";
import { REMINDER_HOUR, Reminder, onReminderTapped, scheduleReminders, setUpReminders } from "../services/reminders";
import { ruleName } from "@/components/recurring/text";

/**
 * Runs once at the root while the app is open:
 * - adds repeating transactions that do not ask, when they are due (on launch
 *   and whenever the app comes back), with Undo;
 * - keeps the due-day reminders in step with the rules;
 * - opens the Overview when a reminder is tapped.
 */
export function useRepeating(): void {
  const { t, i18n } = useTranslation();
  const isOnboarded      = useAppStore((s) => s.isOnboarded);
  const recurring        = useAppStore((s) => s.recurring);
  const remindersEnabled = useAppStore((s) => s.remindersEnabled);
  const currencyCode     = useAppStore((s) => s.currency);

  useEffect(() => {
    void setUpReminders(t("repeating.channel"));
  }, [t]);

  useEffect(() => onReminderTapped(() => router.navigate("/")), []);

  useEffect(() => {
    if (!isOnboarded) return;
    const run = () => {
      const s = useAppStore.getState();
      const today = dateKey(new Date());
      const automatic = s.recurring.filter((r) => !r.ask && !r.variable && isDue(r, today));
      if (!automatic.length) return;
      const undo = s.addDueOccurrences(automatic.map((r) => r.id), today);
      if (!undo) return;
      showToast(
        t("repeating.autoAdded", { count: undo.transactionIds.length, name: ruleName(automatic[0], t) }),
        "repeat",
        undefined,
        { label: t("repeating.undo"), onPress: () => useAppStore.getState().undoRecurring(undo) }
      );
    };
    run();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") run();
    });
    return () => subscription.remove();
  }, [isOnboarded, t]);

  useEffect(() => {
    // Batched: editing a rule changes the list several times in a row.
    const timer = setTimeout(() => {
      if (!isOnboarded || !remindersEnabled) {
        void scheduleReminders([]);
        return;
      }
      const format = moneyFormat(currencyCode, i18n.language, t(`currency.label.${currencyCode}`));
      const today = dateKey(new Date());
      const reminders: Reminder[] = [];
      for (const rule of recurring) {
        if (rule.paused) continue;
        // The next two days it is due, from today on (missed ones are already on the Overview).
        let key = rule.nextDate;
        for (let guard = 0; key < today && guard < 40; guard++) key = followingDate(rule, key);
        for (const day of [key, followingDate(rule, key)]) {
          const date = dayFromKey(day);
          date.setHours(REMINDER_HOUR, 0, 0, 0);
          const amount = formatMoney(rule.amount, format);
          reminders.push({
            key: `${rule.id}:${day}`,
            title: ruleName(rule, t),
            body: rule.variable
              ? t("repeating.notifyVariable")
              : rule.kind === TransactionKind.INCOME
                ? t("repeating.notifyIncome", { amount })
                : t("repeating.notifyBody", { amount }),
            date,
          });
        }
      }
      void scheduleReminders(reminders);
    }, 500);
    return () => clearTimeout(timer);
  }, [recurring, remindersEnabled, isOnboarded, currencyCode, i18n.language, t]);
}
