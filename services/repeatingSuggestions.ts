import { RecurringRule, Transaction, TransactionKind, firstAfter, monthKey } from "../models";
import { previousMonthKey } from "../utils/dates";
import { merchantKey } from "./categorizer/normalize";

/**
 * Finds transactions that look like they repeat, to suggest making them
 * repeating: the same place about once a month, in two months in a row,
 * around the same day and for about the same amount. Groceries (many visits
 * a month) never qualify; neither does anything already repeating or
 * dismissed. Entirely from the user's own data, on the device.
 */

export interface RepeatSuggestion {
  /** Stable id for "Not now": kind and merchant key. */
  key: string;
  /** A ready-to-edit rule (without id: one is made when the user accepts). */
  rule: Omit<RecurringRule, "id">;
  /** Months in a row it was seen. */
  months: number;
}

/** Allowed difference between the two months, as a share of the latest amount. */
const AMOUNT_TOLERANCE = 0.25;
/** Allowed difference in day of the month. */
const DAY_TOLERANCE = 5;

const suggestionKey = (kind: TransactionKind, key: string) => `${kind}:${key}`;

export function findRepeatSuggestions(
  transactions: Transaction[],
  rules: RecurringRule[],
  dismissed: string[],
  today: Date
): RepeatSuggestion[] {
  const covered = new Set(rules.map((r) => suggestionKey(r.kind, merchantKey(r.merchant))));
  const thisMonth = monthKey(today);
  const oldest = previousMonthKey(previousMonthKey(thisMonth));

  // Per kind and merchant: the transactions of each month.
  const groups = new Map<string, Map<string, Transaction[]>>();
  for (const t of transactions) {
    if (t.recurringId || (t.kind !== TransactionKind.EXPENSE && t.kind !== TransactionKind.INCOME)) continue;
    const month = monthKey(new Date(t.date));
    if (month < oldest || month > thisMonth) continue;
    const key = merchantKey(t.merchant);
    if (!key) continue;
    const id = suggestionKey(t.kind, key);
    const byMonth = groups.get(id) ?? new Map<string, Transaction[]>();
    byMonth.set(month, [...(byMonth.get(month) ?? []), t]);
    groups.set(id, byMonth);
  }

  const suggestions: RepeatSuggestion[] = [];
  for (const [id, byMonth] of groups) {
    if (covered.has(id) || dismissed.includes(id)) continue;
    const months = [...byMonth.keys()].sort().reverse();
    const latestMonth = months[0];
    const earlier = byMonth.get(previousMonthKey(latestMonth));
    const latestTxs = byMonth.get(latestMonth)!;
    // Exactly one a month: rent, not the supermarket.
    if (!earlier || earlier.length !== 1 || latestTxs.length !== 1) continue;
    const [latest, before] = [latestTxs[0], earlier[0]];
    const latestDay = new Date(latest.date).getDate();
    if (Math.abs(latestDay - new Date(before.date).getDate()) > DAY_TOLERANCE) continue;
    if (Math.abs(latest.amount - before.amount) > latest.amount * AMOUNT_TOLERANCE) continue;

    let streak = 2;
    for (let m = previousMonthKey(previousMonthKey(latestMonth)); byMonth.get(m)?.length === 1; m = previousMonthKey(m)) streak++;

    const shape = { frequency: "monthly" as const, day: latestDay };
    suggestions.push({
      key: id,
      months: streak,
      rule: {
        kind: latest.kind as RecurringRule["kind"],
        merchant: latest.merchant.trim(),
        amount: latest.amount,
        // Bills that differ a little each month are asked for each time.
        variable: latest.amount !== before.amount,
        categoryId: latest.categoryId,
        subcategoryId: latest.subcategoryId,
        incomeType: latest.incomeType,
        note: "",
        ...shape,
        ask: true,
        paused: false,
        nextDate: firstAfter(shape, new Date(latest.date)),
      },
    });
  }
  // The steadiest first.
  return suggestions.sort((a, b) => b.months - a.months);
}
