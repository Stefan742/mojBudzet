// Stored values are kept as they are for compatibility with saved data;
// show them through i18n (history.kind.*, history.source.*), never raw.
export enum TransactionKind {
  EXPENSE = "Трошок",
  INCOME = "Приход",
  /** Money moved from the balance into savings (vault or a goal). Not spending. */
  SAVINGS = "Штедење",
}

export type TransactionSource = "Рачно" | "QR" | "Банка";

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

  /** For SAVINGS: the goal the money went to; undefined means the vault. */
  goalId?: string;

  note: string;

  source: TransactionSource;
}
