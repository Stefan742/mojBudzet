import { IncomeType, Transaction, TransactionKind, dateKey } from "../models";
import { monthKey, monthStart, shiftMonth } from "../utils/dates";

/**
 * History filters: type, category (or income source), period and amount.
 * Pure, so the screen and the tests agree on what is shown.
 */

export type KindFilter = "all" | "expense" | "income" | "savings";
export type PeriodFilter = "all" | "thisMonth" | "lastMonth" | "last3Months" | "thisYear" | "custom";

/** Expenses without a category (or whose category was deleted). */
export const UNCATEGORIZED = "__uncategorized__";

export interface HistoryFilter {
  kind: KindFilter;
  /** A category id, UNCATEGORIZED, or undefined for any. Applies to expenses. */
  categoryId?: string;
  subcategoryId?: string;
  /** Applies to income. */
  incomeType?: IncomeType;
  period: PeriodFilter;
  /** "YYYY-MM-DD", inclusive; only for a custom period. */
  from?: string;
  to?: string;
  /** Smallest unit of the app currency, inclusive. */
  minAmount?: number;
  maxAmount?: number;
}

export const NO_FILTER: HistoryFilter = { kind: "all", period: "all" };

const KIND: Record<Exclude<KindFilter, "all">, TransactionKind> = {
  expense: TransactionKind.EXPENSE,
  income: TransactionKind.INCOME,
  savings: TransactionKind.SAVINGS,
};

const lastDayKey = (month: string) => dateKey(new Date(shiftMonth(monthStart(month), 1).getTime() - 1));

/** The days a period covers, inclusive; undefined ends are open. */
export function periodRange(f: Pick<HistoryFilter, "period" | "from" | "to">, today: Date): { from?: string; to?: string } {
  const thisMonth = monthKey(today);
  switch (f.period) {
    case "thisMonth":
      return { from: `${thisMonth}-01`, to: lastDayKey(thisMonth) };
    case "lastMonth": {
      const last = monthKey(shiftMonth(monthStart(thisMonth), -1));
      return { from: `${last}-01`, to: lastDayKey(last) };
    }
    case "last3Months":
      return { from: `${monthKey(shiftMonth(monthStart(thisMonth), -2))}-01`, to: dateKey(today) };
    case "thisYear":
      return { from: `${today.getFullYear()}-01-01`, to: `${today.getFullYear()}-12-31` };
    case "custom":
      return { from: f.from, to: f.to };
    default:
      return {};
  }
}

/** How many kinds of filter are on (for the badge on the filter button). */
export function activeFilterCount(f: HistoryFilter): number {
  return [
    f.kind !== "all",
    f.categoryId !== undefined || f.incomeType !== undefined,
    f.period !== "all",
    f.minAmount !== undefined || f.maxAmount !== undefined,
  ].filter(Boolean).length;
}

export function filterTransactions(
  transactions: Transaction[],
  f: HistoryFilter,
  context: { categoryIds: Set<string>; today: Date }
): Transaction[] {
  const { from, to } = periodRange(f, context.today);
  return transactions.filter((t) => {
    if (f.kind !== "all" && t.kind !== KIND[f.kind]) return false;
    if (f.categoryId !== undefined) {
      if (t.kind !== TransactionKind.EXPENSE) return false;
      const known = t.categoryId !== undefined && context.categoryIds.has(t.categoryId);
      if (f.categoryId === UNCATEGORIZED ? known : t.categoryId !== f.categoryId) return false;
      if (f.subcategoryId !== undefined && t.subcategoryId !== f.subcategoryId) return false;
    }
    if (f.incomeType !== undefined && (t.kind !== TransactionKind.INCOME || t.incomeType !== f.incomeType)) return false;
    const day = dateKey(new Date(t.date));
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (f.minAmount !== undefined && t.amount < f.minAmount) return false;
    if (f.maxAmount !== undefined && t.amount > f.maxAmount) return false;
    return true;
  });
}

export interface HistoryTotals {
  count: number;
  expenses: number;
  income: number;
  savings: number;
}

/** What the shown transactions add up to. */
export function totalsOf(transactions: Transaction[]): HistoryTotals {
  const totals: HistoryTotals = { count: transactions.length, expenses: 0, income: 0, savings: 0 };
  for (const t of transactions) {
    if (t.kind === TransactionKind.INCOME) totals.income += t.amount;
    else if (t.kind === TransactionKind.EXPENSE) totals.expenses += t.amount;
    else totals.savings += t.amount;
  }
  return totals;
}
