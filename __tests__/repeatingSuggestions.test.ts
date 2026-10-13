import { RecurringRule, Transaction, TransactionKind } from "../models";
import { findRepeatSuggestions } from "../services/repeatingSuggestions";

let n = 0;
const tx = (merchant: string, amount: number, month: number, day: number, over: Partial<Transaction> = {}): Transaction => ({
  id: String(++n),
  kind: TransactionKind.EXPENSE,
  merchant,
  amount,
  date: new Date(2026, month, day, 12).toISOString(),
  note: "",
  source: "Рачно",
  ...over,
});
const today = new Date(2026, 9, 13); // 13 October 2026
const find = (txs: Transaction[], rules: RecurringRule[] = [], dismissed: string[] = []) =>
  findRepeatSuggestions(txs, rules, dismissed, today);

describe("findRepeatSuggestions", () => {
  it("suggests a payment made once a month, two months in a row", () => {
    const [s] = find([
      tx("Kirija", 15000, 8, 1, { categoryId: "cat-needs", subcategoryId: "sub-bills" }),
      tx("KIRIJA", 15000, 9, 2, { categoryId: "cat-needs", subcategoryId: "sub-bills" }),
    ]);
    expect(s.months).toBe(2);
    expect(s.rule).toMatchObject({
      merchant: "KIRIJA", amount: 15000, variable: false, day: 2, frequency: "monthly", ask: true,
      categoryId: "cat-needs", subcategoryId: "sub-bills", nextDate: "2026-11-02",
    });
  });

  it("treats a bill that differs a little as a changing amount, and counts the streak", () => {
    const [s] = find([tx("EVN", 3500, 7, 12), tx("EVN", 3800, 8, 13), tx("EVN", 3912, 9, 13)]);
    expect(s.months).toBe(3);
    expect(s.rule.variable).toBe(true);
  });

  it("finds a repeating income too", () => {
    const [s] = find([
      tx("Firma DOO", 60000, 8, 10, { kind: TransactionKind.INCOME, incomeType: "salary" }),
      tx("Firma DOO", 60000, 9, 10, { kind: TransactionKind.INCOME, incomeType: "salary" }),
    ]);
    expect(s.rule).toMatchObject({ kind: TransactionKind.INCOME, incomeType: "salary" });
  });

  it("ignores places visited many times a month", () => {
    expect(find([tx("Vero", 900, 8, 3), tx("Vero", 1200, 8, 20), tx("Vero", 800, 9, 4), tx("Vero", 950, 9, 18)])).toEqual([]);
  });

  it("ignores different days, very different amounts, gaps and a single month", () => {
    expect(find([tx("A", 1000, 8, 1), tx("A", 1000, 9, 20)])).toEqual([]);
    expect(find([tx("B", 1000, 8, 5), tx("B", 2000, 9, 5)])).toEqual([]);
    expect(find([tx("C", 1000, 7, 5), tx("C", 1000, 9, 5)])).toEqual([]);
    expect(find([tx("D", 1000, 9, 5)])).toEqual([]);
  });

  it("skips what is already repeating, added by a rule, dismissed, or too old", () => {
    const pair = [tx("Netflix", 620, 8, 17), tx("Netflix", 620, 9, 17)];
    const rule = { id: "r", kind: TransactionKind.EXPENSE, merchant: "NETFLIX" } as RecurringRule;
    expect(find(pair, [rule])).toEqual([]);
    expect(find(pair, [], [`${TransactionKind.EXPENSE}:netflis`])).toHaveLength(1); // a different key
    expect(find(pair, [], [find(pair)[0].key])).toEqual([]);
    expect(find([tx("E", 500, 8, 1, { recurringId: "x" }), tx("E", 500, 9, 1, { recurringId: "x" })])).toEqual([]);
    expect(find([tx("F", 500, 4, 1), tx("F", 500, 5, 1)])).toEqual([]);
  });
});
