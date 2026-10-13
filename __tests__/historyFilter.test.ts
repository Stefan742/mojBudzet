import { Transaction, TransactionKind } from "../models";
import {
  HistoryFilter,
  NO_FILTER,
  UNCATEGORIZED,
  activeFilterCount,
  filterTransactions,
  periodRange,
  totalsOf,
} from "../services/historyFilter";

let n = 0;
const tx = (kind: TransactionKind, amount: number, month: number, day: number, over: Partial<Transaction> = {}): Transaction => ({
  id: String(++n),
  kind,
  amount,
  date: new Date(2026, month, day, 12).toISOString(),
  merchant: "x",
  note: "",
  source: "Рачно",
  ...over,
});
const E = TransactionKind.EXPENSE;
const today = new Date(2026, 9, 13); // 13 October 2026
const categoryIds = new Set(["cat-needs", "cat-wants"]);

const food = tx(E, 1200, 8, 5, { categoryId: "cat-needs", subcategoryId: "sub-food" });
const bills = tx(E, 15000, 8, 1, { categoryId: "cat-needs", subcategoryId: "sub-bills" });
const shoes = tx(E, 4000, 9, 2, { categoryId: "cat-wants", subcategoryId: "sub-shopping" });
const loose = tx(E, 300, 9, 10);
const orphan = tx(E, 500, 9, 11, { categoryId: "deleted" });
const salary = tx(TransactionKind.INCOME, 60000, 9, 1, { incomeType: "salary" });
const gift = tx(TransactionKind.INCOME, 2000, 6, 20, { incomeType: "gift" });
const saved = tx(TransactionKind.SAVINGS, 5000, 9, 12);
const all = [food, bills, shoes, loose, orphan, salary, gift, saved];

const run = (f: Partial<HistoryFilter>) =>
  filterTransactions(all, { ...NO_FILTER, ...f }, { categoryIds, today }).map((t) => t.id);
const ids = (...txs: Transaction[]) => txs.map((t) => t.id);

describe("filterTransactions", () => {
  it("shows everything without a filter", () => {
    expect(run({})).toEqual(ids(...all));
  });

  it("filters by type", () => {
    expect(run({ kind: "income" })).toEqual(ids(salary, gift));
    expect(run({ kind: "savings" })).toEqual(ids(saved));
  });

  it("filters by category and subcategory, expenses only", () => {
    expect(run({ categoryId: "cat-needs" })).toEqual(ids(food, bills));
    expect(run({ categoryId: "cat-needs", subcategoryId: "sub-food" })).toEqual(ids(food));
  });

  it("counts deleted categories as uncategorized", () => {
    expect(run({ categoryId: UNCATEGORIZED })).toEqual(ids(loose, orphan));
  });

  it("filters income by source", () => {
    expect(run({ incomeType: "salary" })).toEqual(ids(salary));
  });

  it("filters by period, including a custom range", () => {
    expect(run({ period: "thisMonth" })).toEqual(ids(shoes, loose, orphan, salary, saved));
    expect(run({ period: "lastMonth" })).toEqual(ids(food, bills));
    expect(run({ period: "custom", from: "2026-09-02", to: "2026-10-02" })).toEqual(ids(food, shoes, salary));
    expect(run({ period: "custom", to: "2026-07-31" })).toEqual(ids(gift));
  });

  it("filters by amount, both ends inclusive", () => {
    expect(run({ minAmount: 4000, maxAmount: 15000 })).toEqual(ids(bills, shoes, saved));
  });

  it("combines filters: food in September", () => {
    expect(run({ categoryId: "cat-needs", subcategoryId: "sub-food", period: "lastMonth" })).toEqual(ids(food));
  });
});

describe("periodRange", () => {
  it("covers whole months, the last three months and the year", () => {
    expect(periodRange({ period: "thisMonth" }, today)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(periodRange({ period: "lastMonth" }, new Date(2026, 0, 15))).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(periodRange({ period: "last3Months" }, today)).toEqual({ from: "2026-08-01", to: "2026-10-13" });
    expect(periodRange({ period: "thisYear" }, today)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(periodRange({ period: "all" }, today)).toEqual({});
  });
});

describe("activeFilterCount and totalsOf", () => {
  it("counts each kind of filter once", () => {
    expect(activeFilterCount(NO_FILTER)).toBe(0);
    expect(activeFilterCount({ ...NO_FILTER, categoryId: "c", subcategoryId: "s", period: "thisMonth", minAmount: 1 })).toBe(3);
  });

  it("adds up what is shown", () => {
    expect(totalsOf([food, bills, salary, saved])).toEqual({ count: 4, expenses: 16200, income: 60000, savings: 5000 });
  });
});
