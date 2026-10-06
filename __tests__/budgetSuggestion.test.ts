import {
  buildEffectiveRatios,
  computeRollingAverages,
  generateBudgetSuggestion,
} from "../services/budgetSuggestionEngine";
import { Category, Transaction, TransactionKind } from "../models";

const cat = (id: string, bucket: Category["bucket"]): Category => ({
  id, name: id, colorHex: "#000", iconName: "pricetag", subcategories: [], bucket,
});
const expense = (categoryId: string, amount: number, date: Date): Transaction => ({
  id: `${categoryId}-${date.toISOString()}`, kind: TransactionKind.EXPENSE, amount, categoryId,
  date: date.toISOString(), merchant: "m", note: "", source: "Рачно",
});

const today = new Date(2026, 9, 6); // 6 October 2026

describe("computeRollingAverages (D-11)", () => {
  it("ignores the current, partial month", () => {
    const avg = computeRollingAverages(
      [expense("food", 3000, new Date(2026, 6, 10)), expense("food", 9000, new Date(2026, 9, 2))],
      today
    );
    // July, August, September count; October (partial) does not.
    expect(avg.get("food")).toBe(1000);
  });

  it("does not average over months before the first transaction", () => {
    const avg = computeRollingAverages([expense("food", 3000, new Date(2026, 8, 10))], today);
    expect(avg.get("food")).toBe(3000);
  });

  it("returns nothing for a brand-new user", () => {
    expect(computeRollingAverages([expense("food", 500, new Date(2026, 9, 1))], today).size).toBe(0);
  });
});

describe("buildEffectiveRatios (D-11)", () => {
  it("gives the shares of empty buckets to the others", () => {
    const r = buildEffectiveRatios(new Set(["needs", "wants"]));
    expect(r.needs + r.wants).toBeCloseTo(1);
    expect(r.needs / r.wants).toBeCloseTo(2);
    expect(r.savings).toBe(0);
  });
});

describe("generateBudgetSuggestion", () => {
  it("splits the whole income when only some buckets have categories", () => {
    const out = generateBudgetSuggestion({
      income: 30000,
      categories: [cat("n", "needs"), cat("w", "wants")],
      referenceDate: today,
    });
    expect(out.reduce((s, x) => s + x.suggestedMonthlyLimit, 0)).toBe(30000);
    expect(out.every((x) => Number.isInteger(x.suggestedMonthlyLimit))).toBe(true);
  });
});
