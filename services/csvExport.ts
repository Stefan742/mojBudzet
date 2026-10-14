import type { TFunction } from "i18next";
import { Category, SavingsGoal, Transaction, TransactionKind, categoryLabel, dateKey, isIncomeType } from "../models";
import { findCategory, findSubcategory } from "../store/selectors";
import type { MoneyFormat } from "../utils/money";

/**
 * The user's transactions as a spreadsheet (CSV) for Excel, Numbers or
 * Google Sheets: one row per transaction, newest first, headers in the app
 * language.
 *
 * - ";" between columns and a decimal comma, as spreadsheets set up for
 *   Macedonian (and most of Europe) expect; Numbers and Google Sheets detect it.
 * - A UTF-8 byte order mark first, so Excel shows Cyrillic correctly.
 * - Amounts as plain signed numbers (expenses and savings negative), without
 *   thousands dots, so a spreadsheet can add them up.
 * - Text that would start a formula (=, +, -, @) gets a leading apostrophe,
 *   so a merchant name can never run as one (CSV injection).
 */

const DELIMITER = ";";
const NEWLINE = "\r\n";
const BOM = String.fromCharCode(0xfeff);

/** A text cell: defused if it looks like a formula, quoted when needed. */
export function csvText(value: string): string {
  let v = value;
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** A number cell: "-15000", "-12,50". */
export function csvAmount(amount: number, decimals: 0 | 2): string {
  const sign = amount < 0 ? "-" : "";
  const value = Math.abs(Math.round(amount));
  if (decimals === 0) return `${sign}${value}`;
  return `${sign}${Math.floor(value / 100)},${String(value % 100).padStart(2, "0")}`;
}

export function buildTransactionsCsv(
  transactions: Transaction[],
  context: { categories: Category[]; savingsGoals: SavingsGoal[]; currency: MoneyFormat; t: TFunction }
): string {
  const { categories, savingsGoals, currency, t } = context;

  const typeOf = (tx: Transaction) =>
    tx.kind === TransactionKind.INCOME ? t("csv.income") : tx.kind === TransactionKind.SAVINGS ? t("csv.savings") : t("csv.expense");

  const nameOf = (tx: Transaction) => {
    if (tx.kind === TransactionKind.SAVINGS) {
      const goal = savingsGoals.find((g) => g.id === tx.goalId);
      return goal ? t("history.savedToGoal", { name: goal.name }) : t("history.savedToVault");
    }
    return tx.merchant || (isIncomeType(tx.incomeType) ? t(`incomeTypes.${tx.incomeType}`) : "");
  };

  const header = ["date", "type", "name", "category", "subcategory", "incomeSource", "amount", "currency", "note", "repeating"]
    .map((k) => csvText(t(`csv.${k}`)));

  const rows = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((tx) => {
      const expense = tx.kind === TransactionKind.EXPENSE;
      const cat = expense ? findCategory(categories, tx.categoryId) : undefined;
      const sub = expense ? findSubcategory(categories, tx.categoryId, tx.subcategoryId) : undefined;
      const signed = tx.kind === TransactionKind.INCOME ? tx.amount : -tx.amount;
      return [
        dateKey(new Date(tx.date)),
        csvText(typeOf(tx)),
        csvText(nameOf(tx)),
        csvText(cat ? categoryLabel(cat, t) : ""),
        csvText(sub ? categoryLabel(sub, t) : ""),
        csvText(tx.kind === TransactionKind.INCOME && isIncomeType(tx.incomeType) ? t(`incomeTypes.${tx.incomeType}`) : ""),
        csvAmount(signed, currency.decimals),
        currency.code,
        csvText(tx.note ?? ""),
        tx.recurringId ? csvText(t("csv.yes")) : "",
      ];
    });

  return BOM + [header, ...rows].map((cells) => cells.join(DELIMITER)).join(NEWLINE) + NEWLINE;
}
