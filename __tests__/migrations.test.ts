import { dedupeCategoryIds, migratePersistedState, refreshDefaultCategories } from "../store/migrations";
import { defaultCategories } from "../models/Category";
import type { Category } from "../models";

const base = { colorHex: "#9C27B0", iconName: "tag", subcategories: [] };
const cat = (id: string, name: string): Category => ({ id, name, ...base });

describe("dedupeCategoryIds", () => {
  it("keeps the first id, re-ids differing duplicates and drops exact clones", () => {
    let n = 0;
    const out = dedupeCategoryIds(
      [cat("food", "Food"), cat("X", "Gym"), cat("X", "Pets"), cat("X", "Gym"), cat("Y", "Solo")],
      () => `new-${++n}`
    );
    expect(out.map((c) => [c.id, c.name])).toEqual([
      ["food", "Food"],
      ["X", "Gym"],
      ["new-1", "Pets"],
      ["Y", "Solo"],
    ]);
  });

  it("leaves clean data untouched", () => {
    const clean = [cat("a", "A"), cat("b", "B")];
    expect(dedupeCategoryIds(clean, () => "unused")).toEqual(clean);
  });
});

describe("migratePersistedState to v2", () => {
  const now = new Date(2026, 9, 6);
  const v1 = {
    isOnboarded: true,
    initialBalance: 1500.5,
    currency: "МКД",
    language: "en",
    vaultAmount: 99.6,
    categories: [
      { ...defaultCategories[0] , nameKey: undefined },
      { id: "custom", name: "Gym", colorHex: "#000", iconName: "tag", subcategories: [] },
    ],
    budgets: [
      { id: "b1", categoryId: "custom", monthlyLimit: 1000.4 },
      { id: "b2", categoryId: "gone", monthlyLimit: 500 },
      { id: "b3", categoryId: "cat-needs", monthlyLimit: 0 },
    ],
    transactions: [{ id: "t1", amount: 12.5, kind: "Трошок", date: now.toISOString(), merchant: "", note: "", source: "Рачно" }],
    savingsGoals: [{ id: "g1", name: "Trip", targetAmount: 1000.7, currentAmount: 10.2, colorHex: "#000" }],
    incomeSchedule: [],
    theme: "system",
  };
  const out = migratePersistedState(v1, 1, { newId: () => "x", now });

  it("rounds every amount to whole denars", () => {
    expect(out.initialBalance).toBe(1501);
    expect(out.vaultAmount).toBe(100);
    expect(out.transactions?.[0].amount).toBe(13);
    expect(out.savingsGoals?.[0]).toMatchObject({ targetAmount: 1001, currentAmount: 10 });
  });

  it("drops budgets of deleted categories and empty limits", () => {
    expect(out.budgets).toEqual([{ id: "b1", categoryId: "custom", monthlyLimit: 1000 }]);
  });

  it("marks untouched built-in names for translation and leaves custom ones", () => {
    expect(out.categories?.[0].nameKey).toBe("categories.cat-needs");
    expect(out.categories?.[0].subcategories[0].nameKey).toBe("subcategories.sub-food");
    expect(out.categories?.[1].nameKey).toBeUndefined();
  });

  it("starts the rollover from the current month, keeps language, replaces the old currency text", () => {
    expect(out.lastRolloverMonth).toBe("2026-10");
    expect(out.language).toBe("en");
    // v2 dropped the old display string; v4 brings the field back as a code.
    expect(out.currency).toBe("MKD");
  });
});

describe("refreshDefaultCategories (D-6)", () => {
  it("adds new built-in keywords without losing saved ones", () => {
    const saved = {
      ...defaultCategories[0],
      subcategories: [{ ...defaultCategories[0].subcategories[0], keywords: ["my-shop"] }],
    };
    const [refreshed] = refreshDefaultCategories([saved]);
    const keywords = refreshed.subcategories[0].keywords;
    expect(keywords).toContain("my-shop");
    expect(keywords).toContain("vero");
  });
});

describe("migratePersistedState to v3 (palette)", () => {
  it("maps Material colours of categories and goals to iOS system colours", () => {
    const out = migratePersistedState(
      {
        categories: [{ id: "a", name: "A", colorHex: "#4caf50", iconName: "cart", subcategories: [] },
                     { id: "b", name: "B", colorHex: "#123456", iconName: "cart", subcategories: [] }],
        savingsGoals: [{ id: "g", name: "G", targetAmount: 1, currentAmount: 0, colorHex: "#00BCD4" }],
      },
      2,
      { newId: () => "x", now: new Date(2026, 9, 7) }
    );
    expect(out.categories?.map((c) => c.colorHex)).toEqual(["#34C759", "#123456"]);
    expect(out.savingsGoals?.[0].colorHex).toBe("#30B0C7");
  });
});

describe("migratePersistedState to v4 (currencies)", () => {
  const deps = { newId: () => "x", now: new Date(2026, 9, 13) };

  it("sets MKD and leaves every amount as it was", () => {
    const saved = {
      initialBalance: 20000,
      vaultAmount: 500,
      transactions: [{ id: "t", amount: 1250 }],
      budgets: [{ id: "b", categoryId: "c", monthlyLimit: 9000 }],
    };
    const out = migratePersistedState(saved, 3, deps);
    expect(out.currency).toBe("MKD");
    expect(out).toMatchObject(saved);
  });

  it("keeps a valid currency and replaces an unknown one", () => {
    expect(migratePersistedState({ currency: "EUR" }, 3, deps).currency).toBe("EUR");
    expect(migratePersistedState({ currency: "XYZ" }, 3, deps).currency).toBe("MKD");
  });
});
