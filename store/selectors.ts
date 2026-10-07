/**
 * Pure derived values. Components select the raw arrays from the store and
 * compute with these (in useMemo or directly in a selector that returns a
 * number), so they re-render when the data changes.
 */
import { Category, Subcategory, Transaction, TransactionKind } from "../models";
import { monthKey, previousMonthKey } from "../utils/dates";

export const transactionMonth = (t: Transaction): string => monthKey(new Date(t.date));

/** Opening balance + income − expenses − money moved into savings. */
export const balanceOf = (initialBalance: number, transactions: Transaction[]): number => {
  let balance = initialBalance;
  for (const t of transactions) {
    balance += t.kind === TransactionKind.INCOME ? t.amount : -t.amount;
  }
  return balance;
};

export interface MonthTotals {
  income: number;
  expenses: number;
  /** Moved into savings this month; not spending. */
  savings: number;
}

export const monthTotals = (transactions: Transaction[], month: string): MonthTotals => {
  const totals: MonthTotals = { income: 0, expenses: 0, savings: 0 };
  for (const t of transactions) {
    if (transactionMonth(t) !== month) continue;
    if (t.kind === TransactionKind.INCOME) totals.income += t.amount;
    else if (t.kind === TransactionKind.EXPENSE) totals.expenses += t.amount;
    else totals.savings += t.amount;
  }
  return totals;
};

export interface CategorySpend {
  /** null: no category, or the category was deleted. */
  category: Category | null;
  amount: number;
}

/**
 * Expenses per category for a month, largest first. Uncategorized expenses
 * are one entry with `category: null`, so the parts always add up to the
 * month's expense total.
 */
export const expensesByCategory = (
  transactions: Transaction[],
  categories: Category[],
  month: string
): CategorySpend[] => {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const sums = new Map<string | null, number>();
  for (const t of transactions) {
    if (t.kind !== TransactionKind.EXPENSE || transactionMonth(t) !== month) continue;
    const key = t.categoryId && byId.has(t.categoryId) ? t.categoryId : null;
    sums.set(key, (sums.get(key) ?? 0) + t.amount);
  }
  return [...sums.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([id, amount]) => ({ category: id ? byId.get(id)! : null, amount }))
    .sort((a, b) => b.amount - a.amount);
};

/** Share of a budget limit at which the app starts warning (U-14). */
export const BUDGET_WARN_AT = 0.8;

export const spentInCategory = (
  transactions: Transaction[],
  categoryId: string,
  month: string
): number => {
  let sum = 0;
  for (const t of transactions) {
    if (t.kind === TransactionKind.EXPENSE && t.categoryId === categoryId && transactionMonth(t) === month) {
      sum += t.amount;
    }
  }
  return sum;
};

/**
 * What is left of a month: its income minus expenses and savings, never
 * more than the current balance and never negative.
 */
export const leftoverOf = (transactions: Transaction[], month: string, balance: number): number => {
  const { income, expenses, savings } = monthTotals(transactions, month);
  return Math.max(0, Math.min(balance, income - expenses - savings));
};

/**
 * The month-start decision (D-1). null: nothing to settle (already done this
 * month). 0: due, but nothing was left, so it is settled without asking.
 * Above 0: ask the user. Only the month before `thisMonth` counts; earlier
 * unsettled months simply stayed in the balance.
 */
export const pendingLeftover = (
  lastRolloverMonth: string | undefined,
  thisMonth: string,
  transactions: Transaction[],
  balance: number
): number | null => {
  if (lastRolloverMonth !== undefined && lastRolloverMonth >= thisMonth) return null;
  return leftoverOf(transactions, previousMonthKey(thisMonth), balance);
};

export const findCategory = (categories: Category[], id?: string): Category | undefined =>
  id ? categories.find((c) => c.id === id) : undefined;

export const findSubcategory = (
  categories: Category[],
  categoryId?: string,
  subcategoryId?: string
): Subcategory | undefined =>
  subcategoryId ? findCategory(categories, categoryId)?.subcategories.find((s) => s.id === subcategoryId) : undefined;
