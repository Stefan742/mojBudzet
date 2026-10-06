import { Category, Transaction, TransactionKind } from "../models";
import {
  balanceOf,
  expensesByCategory,
  leftoverOf,
  monthTotals,
  spentInCategory,
} from "../store/selectors";

const food: Category = { id: "food", name: "Food", colorHex: "#000", iconName: "cart", subcategories: [] };
let n = 0;
const tx = (kind: TransactionKind, amount: number, date: Date, categoryId?: string): Transaction => ({
  id: String(++n),
  kind,
  amount,
  date: date.toISOString(),
  merchant: "m",
  note: "",
  source: "Рачно",
  categoryId,
});

const oct = (day: number) => new Date(2026, 9, day, 12);
const sep = (day: number) => new Date(2026, 8, day, 12);

const txs = [
  tx(TransactionKind.INCOME, 30000, oct(1)),
  tx(TransactionKind.EXPENSE, 1200, oct(2), "food"),
  tx(TransactionKind.EXPENSE, 800, oct(3)), // uncategorized
  tx(TransactionKind.EXPENSE, 500, oct(4), "deleted-category"),
  tx(TransactionKind.SAVINGS, 5000, oct(5)),
  tx(TransactionKind.EXPENSE, 9999, sep(30), "food"),
];

describe("balanceOf", () => {
  it("adds income and subtracts expenses and savings", () => {
    expect(balanceOf(10000, txs)).toBe(10000 + 30000 - 1200 - 800 - 500 - 5000 - 9999);
  });
});

describe("monthTotals", () => {
  it("keeps savings out of expenses", () => {
    expect(monthTotals(txs, "2026-10")).toEqual({ income: 30000, expenses: 2500, savings: 5000 });
  });
});

describe("expensesByCategory (B-11)", () => {
  const parts = expensesByCategory(txs, [food], "2026-10");

  it("puts uncategorized and deleted-category expenses in one null entry, largest first", () => {
    expect(parts).toEqual([
      { category: null, amount: 1300 },
      { category: food, amount: 1200 },
    ]);
  });

  it("adds up to the month's expense total", () => {
    const sum = parts.reduce((s, p) => s + p.amount, 0);
    expect(sum).toBe(monthTotals(txs, "2026-10").expenses);
  });
});

describe("spentInCategory", () => {
  it("only counts that category in that month", () => {
    expect(spentInCategory(txs, "food", "2026-10")).toBe(1200);
    expect(spentInCategory(txs, "food", "2026-09")).toBe(9999);
  });
});

describe("leftoverOf (D-1)", () => {
  it("is the month's income minus expenses and savings", () => {
    expect(leftoverOf(txs, "2026-10", 1_000_000)).toBe(30000 - 2500 - 5000);
  });

  it("never exceeds the balance and is never negative", () => {
    expect(leftoverOf(txs, "2026-10", 1000)).toBe(1000);
    expect(leftoverOf(txs, "2026-09", 50000)).toBe(0);
  });
});
