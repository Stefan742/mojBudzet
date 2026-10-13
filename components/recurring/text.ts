import type { TFunction } from "i18next";
import { RecurringRule, dayFromKey, dueCount } from "../../models";
import { dateLocale } from "../../utils/dates";

/** "1 Oct": short enough for a row next to an amount and a button. */
const shortDate = (key: string, language: string) =>
  dayFromKey(key).toLocaleDateString(dateLocale(language), { day: "numeric", month: "short" });

/** The rule's name: what the user typed, or the income source ("Salary"). */
export const ruleName = (rule: RecurringRule, t: TFunction): string =>
  rule.merchant.trim() || (rule.incomeType ? t(`incomeTypes.${rule.incomeType}`) : t("repeating.untitled"));

/** "Today", "Since 1 Oct", plus "1 more due" after missed months. */
export const dueLabel = (rule: RecurringRule, todayKey: string, language: string, t: TFunction): string => {
  const when = rule.nextDate === todayKey ? t("repeating.today") : t("repeating.since", { date: shortDate(rule.nextDate, language) });
  const more = dueCount(rule, todayKey) - 1;
  return more > 0 ? `${when} · ${t("repeating.moreDue", { count: more })}` : when;
};

/** "Tomorrow", "In 4 days". */
export const upcomingLabel = (rule: RecurringRule, todayKey: string, t: TFunction): string => {
  const days = Math.round((dayFromKey(rule.nextDate).getTime() - dayFromKey(todayKey).getTime()) / 86_400_000);
  return days === 1 ? t("repeating.tomorrow") : t("repeating.inDays", { count: days });
};

/** "Monthly · day 1 · asks first", "Yearly · 1 March · automatic", "Paused". */
export const scheduleLabel = (rule: RecurringRule, language: string, t: TFunction): string => {
  if (rule.paused) return t("repeating.paused");
  const when =
    rule.frequency === "yearly"
      ? t("repeating.yearlyOn", {
          date: dayFromKey(rule.nextDate).toLocaleDateString(dateLocale(language), { day: "numeric", month: "long" }),
        })
      : t("repeating.monthlyOn", { day: rule.day });
  return `${when} · ${rule.ask || rule.variable ? t("repeating.asks") : t("repeating.automatic")}`;
};

/** "October 2026" for a monthly rule's occurrence, "2027" for a yearly one. */
export const periodLabel = (rule: RecurringRule, language: string): string => {
  const date = dayFromKey(rule.nextDate);
  return rule.frequency === "yearly"
    ? String(date.getFullYear())
    : date.toLocaleDateString(dateLocale(language), { month: "long", year: "numeric" });
};
