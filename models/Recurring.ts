import { TransactionKind, type IncomeType } from "./Transaction";

/**
 * A repeating transaction: rent, a bill, a subscription, the salary. Each
 * occurrence is either added (as a normal transaction, dated on its own day)
 * or skipped, by the user or, when `ask` is off, automatically.
 */
export type RepeatFrequency = "monthly" | "yearly";

export interface RecurringRule {
  id: string;
  kind: TransactionKind.EXPENSE | TransactionKind.INCOME;
  /** Shown name, and the merchant of the transactions it adds. */
  merchant: string;
  /** Smallest unit of the app currency. When `variable`, the last amount (a hint). */
  amount: number;
  /** The amount differs every time (electricity, water): always asked for. */
  variable: boolean;
  categoryId?: string;
  subcategoryId?: string;
  incomeType?: IncomeType;
  note: string;
  frequency: RepeatFrequency;
  /** Day of the month, 1–31; months that are shorter use their last day. */
  day: number;
  /** Month, 0–11, for yearly rules. */
  month?: number;
  /** Ask before adding (default). Off: added automatically when due. */
  ask: boolean;
  paused: boolean;
  /** The first occurrence not yet added or skipped, "YYYY-MM-DD" (local). */
  nextDate: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" for the local day of `date`. */
export const dateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Noon (local) of a "YYYY-MM-DD" day: safe from time-zone edges. */
export const dayFromKey = (key: string): Date => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};

const daysIn = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

/** The rule's occurrence in the given month (monthly) or year (yearly). */
const occurrenceKey = (rule: Pick<RecurringRule, "frequency" | "day" | "month">, year: number, month: number): string => {
  const m = rule.frequency === "yearly" ? rule.month ?? month : month;
  return dateKey(new Date(year, m, Math.min(rule.day, daysIn(year, m)), 12));
};

/** The occurrence after the one on `key`: next month, or next year. */
export const followingDate = (rule: Pick<RecurringRule, "frequency" | "day" | "month">, key: string): string => {
  const d = dayFromKey(key);
  return rule.frequency === "yearly"
    ? occurrenceKey(rule, d.getFullYear() + 1, d.getMonth())
    : occurrenceKey(rule, d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear(), (d.getMonth() + 1) % 12);
};

/** The first occurrence strictly after `date` (the period of `date` counts as done). */
export const firstAfter = (rule: Pick<RecurringRule, "frequency" | "day" | "month">, date: Date): string => {
  const today = dateKey(date);
  const here = occurrenceKey(rule, date.getFullYear(), date.getMonth());
  return here > today ? here : followingDate(rule, here);
};

/** Whether the rule has an occurrence waiting on `todayKey`. */
export const isDue = (rule: RecurringRule, todayKey: string): boolean => !rule.paused && rule.nextDate <= todayKey;

/** How many occurrences are waiting: more than one after months without opening the app. */
export const dueCount = (rule: RecurringRule, todayKey: string): number => {
  if (!isDue(rule, todayKey)) return 0;
  let n = 0;
  for (let key = rule.nextDate; key <= todayKey && n < 36; key = followingDate(rule, key)) n++;
  return n;
};

/** What the rule amounts to per month, for planning (yearly ones spread over 12). */
export const monthlyEquivalent = (rule: RecurringRule): number =>
  rule.frequency === "yearly" ? Math.round(rule.amount / 12) : rule.amount;

/** Planned monthly income: the active repeating income (the salary). */
export const plannedMonthlyIncome = (rules: RecurringRule[]): number =>
  rules
    .filter((r) => r.kind === TransactionKind.INCOME && !r.paused)
    .reduce((sum, r) => sum + monthlyEquivalent(r), 0);
