export enum TransactionKind {
  EXPENSE = "Трошок",
  INCOME = "Приход",
}

export interface Transaction {
  id: string;

  date: string;

  merchant: string;

  amount: number;

  kind: TransactionKind;

  categoryId?: string;

  subcategoryId?: string;

  note: string;

  source: "Рачно" | "QR" | "Банка";
}