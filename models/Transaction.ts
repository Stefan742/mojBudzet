// Stored values are kept as they are for compatibility with saved data;
// show them through i18n (history.kind.*, history.source.*), never raw.
export enum TransactionKind {
  EXPENSE = "Трошок",
  INCOME = "Приход",
  /** Money moved from the balance into savings (vault or a goal). Not spending. */
  SAVINGS = "Штедење",
}

export type TransactionSource = "Рачно" | "QR" | "Банка";

/**
 * Where income came from. Income uses this short fixed list instead of the
 * categories, which are spending buckets for the budget. Shown through
 * incomeTypes.* in i18n.
 */
export const INCOME_TYPES = ["salary", "freelance", "pension", "gift", "refund", "other"] as const;
export type IncomeType = (typeof INCOME_TYPES)[number];

export const isIncomeType = (v: unknown): v is IncomeType =>
  typeof v === "string" && (INCOME_TYPES as readonly string[]).includes(v);

export interface Transaction {
  id: string;

  /** ISO timestamp. */
  date: string;

  merchant: string;

  /** Whole MKD, always positive; `kind` gives the direction. */
  amount: number;

  kind: TransactionKind;

  categoryId?: string;

  subcategoryId?: string;

  /** For INCOME only: where it came from. */
  incomeType?: IncomeType;

  /** For SAVINGS: the goal the money went to; undefined means the vault. */
  goalId?: string;

  note: string;

  source: TransactionSource;
}

/**
 * Whole-MKD amount, and the fields that belong to the kind: income has a
 * source and no category, everything else no source.
 */
export function normalizeTransaction(t: Transaction): Transaction {
  const amount = Math.round(t.amount);
  if (t.kind === TransactionKind.INCOME) {
    return { ...t, amount, categoryId: undefined, subcategoryId: undefined };
  }
  return { ...t, amount, incomeType: undefined };
}
