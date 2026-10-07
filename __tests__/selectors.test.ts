import { Category, Transaction, TransactionKind } from "../models";
import {
  balanceOf,
  expensesByCategory,
  leftoverOf,
  monthTotals,
  pendingLeftover,
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

describe("pendingLeftover: the 1st of the month (D-1)", () => {
  // Local dates, as the app records them.
  const sep = (day: number) => new Date(2026, 8, day, 12);
  const income  = (amount: number, d: Date) => tx(TransactionKind.INCOME, amount, d);
  const expense = (amount: number, d: Date) => tx(TransactionKind.EXPENSE, amount, d);
  const saving  = (amount: number, d: Date) => tx(TransactionKind.SAVINGS, amount, d);
  const sepMonth = [income(60000, sep(1)), expense(30000, sep(10)), expense(11500, sep(20))];

  it("asks about what last month left", () => {
    expect(pendingLeftover("2026-09", "2026-10", sepMonth, 100000)).toBe(18500);
  });

  it("asks nothing once this month is settled", () => {
    expect(pendingLeftover("2026-10", "2026-10", sepMonth, 100000)).toBeNull();
  });

  it("is due on the first launch after an update that added the field", () => {
    expect(pendingLeftover(undefined, "2026-10", sepMonth, 100000)).toBe(18500);
  });

  it("settles without asking when the month was overspent", () => {
    const over = [income(20000, sep(1)), expense(25000, sep(2))];
    expect(pendingLeftover("2026-09", "2026-10", over, 100000)).toBe(0);
  });

  it("settles without asking when nothing happened last month", () => {
    expect(pendingLeftover("2026-09", "2026-10", [], 100000)).toBe(0);
  });

  it("counts money already moved to savings as used", () => {
    expect(pendingLeftover("2026-09", "2026-10", [...sepMonth, saving(8500, sep(25))], 100000)).toBe(10000);
  });

  it("never offers more than the balance holds", () => {
    expect(pendingLeftover("2026-09", "2026-10", sepMonth, 8500)).toBe(8500);
  });

  it("offers nothing when the balance is negative", () => {
    expect(pendingLeftover("2026-09", "2026-10", sepMonth, -11500)).toBe(0);
  });

  it("only looks at last month after months without opening the app", () => {
    const aug = [income(40000, new Date(2026, 7, 1, 12)), expense(30000, new Date(2026, 7, 5, 12))];
    expect(pendingLeftover("2026-07", "2026-10", [...aug, ...sepMonth], 100000)).toBe(18500);
  });

  it("crosses the year: in January it asks about December", () => {
    const dec = [income(50000, new Date(2026, 11, 1, 12)), expense(20000, new Date(2026, 11, 31, 23, 30))];
    expect(pendingLeftover("2026-12", "2027-01", dec, 100000)).toBe(30000);
  });

  it("counts a late-evening transaction on the last day in that month", () => {
    const late = [income(10000, new Date(2026, 8, 30, 23, 59))];
    expect(pendingLeftover("2026-09", "2026-10", late, 100000)).toBe(10000);
  });

  it("ignores the planned monthly income from Settings; only recorded income counts", () => {
    // Only expenses were recorded in September.
    expect(pendingLeftover("2026-09", "2026-10", [expense(30000, sep(10))], 100000)).toBe(0);
  });
});
