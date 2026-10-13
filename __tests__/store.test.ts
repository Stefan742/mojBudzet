import { useAppStore, persistedSnapshot } from "../store/useAppStore";
import { balanceOf, leftoverOf, monthTotals } from "../store/selectors";
import { buildExport } from "../store/backup";
import { STORE_VERSION } from "../store/migrations";
import { TransactionKind, monthKey } from "../models";
import { monthEnd } from "../utils/dates";

// Hoisted above the imports by babel-jest.
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const store = () => useAppStore.getState();
const balance = () => balanceOf(store().initialBalance, store().transactions);

beforeEach(() => {
  store().resetAll();
  store().completeOnboarding(10000, 30000);
});

describe("money moves keep balance and savings in agreement (D-5)", () => {
  it("saving to the vault moves money out of the balance", () => {
    store().saveFromBalance(2500, null, "");
    expect(balance()).toBe(7500);
    expect(store().vaultAmount).toBe(2500);
    // Savings are not spending.
    expect(monthTotals(store().transactions, monthKey(new Date())).expenses).toBe(0);
  });

  it("adding to a goal is not capped at the target", () => {
    store().addGoal({ id: "g", name: "Trip", targetAmount: 1000, currentAmount: 900, colorHex: "#000" });
    store().saveFromBalance(500, "g", "");
    expect(store().savingsGoals[0].currentAmount).toBe(1400);
    expect(balance()).toBe(9500);
  });

  it("deleting a savings transaction puts the money back", () => {
    store().addGoal({ id: "g", name: "Trip", targetAmount: 1000, currentAmount: 0, colorHex: "#000" });
    store().saveFromBalance(300, "g", "");
    const tx = store().transactions.find((t) => t.kind === TransactionKind.SAVINGS)!;
    store().deleteTransaction(tx.id);
    expect(store().savingsGoals[0].currentAmount).toBe(0);
    expect(balance()).toBe(10000);
  });

  it("deleting a goal moves its money to the vault", () => {
    store().addGoal({ id: "g", name: "Trip", targetAmount: 1000, currentAmount: 0, colorHex: "#000" });
    store().saveFromBalance(400, "g", "");
    store().deleteGoal("g");
    expect(store().vaultAmount).toBe(400);
    expect(store().savingsGoals).toHaveLength(0);
    expect(balance()).toBe(9600);
  });

  it("vault transfers are capped at what the vault holds", () => {
    store().addGoal({ id: "g", name: "Trip", targetAmount: 1000, currentAmount: 0, colorHex: "#000" });
    store().saveFromBalance(200, null, "");
    store().transferFromVault(999, "g");
    expect(store().vaultAmount).toBe(0);
    expect(store().savingsGoals[0].currentAmount).toBe(200);
  });
});

describe("categories and budgets", () => {
  it("deleting a category removes its budget and uncategorizes its transactions (D-8)", () => {
    store().setBudget("cat-needs", 5000);
    store().addTransaction({
      id: "t", date: new Date().toISOString(), merchant: "Vero", amount: 100,
      kind: TransactionKind.EXPENSE, categoryId: "cat-needs", note: "", source: "Рачно",
    });
    store().deleteCategory("cat-needs");
    expect(store().budgets).toHaveLength(0);
    expect(store().transactions[0].categoryId).toBeUndefined();
  });

  it("a limit of 0 removes the budget", () => {
    store().setBudget("cat-needs", 5000);
    store().setBudget("cat-needs", 0);
    expect(store().budgets).toHaveLength(0);
  });

  it("a category with a taken id gets a new id (KB-1)", () => {
    const draft = { id: "same", name: "A", colorHex: "#000", iconName: "pricetag", subcategories: [] };
    store().addCategory(draft);
    store().addCategory({ ...draft, name: "B" });
    const ids = store().categories.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("onboarding and rollover", () => {
  it("records income from this month and skips the first rollover", () => {
    expect(store().incomeSchedule).toEqual([{ effectiveFrom: monthKey(new Date()), amount: 30000 }]);
    expect(store().lastRolloverMonth).toBe(monthKey(new Date()));
  });

  it("amounts are stored as whole denars", () => {
    store().addTransaction({
      id: "t", date: new Date().toISOString(), merchant: "x", amount: 10.6,
      kind: TransactionKind.EXPENSE, note: "", source: "Рачно",
    });
    expect(store().transactions[0].amount).toBe(11);
  });
});

describe("persistence (D-3)", () => {
  it("saves data only, never the action functions", () => {
    const { partialize } = useAppStore.persist.getOptions();
    const saved = partialize!(store()) as Record<string, unknown>;
    expect(Object.values(saved).some((v) => typeof v === "function")).toBe(false);
    expect(saved).toHaveProperty("transactions");
    expect(saved).toHaveProperty("language");
  });
});

describe("export (R-11)", () => {
  it("contains all saved data and the store version", () => {
    store().saveFromBalance(100, null, "");
    const parsed = JSON.parse(buildExport(persistedSnapshot(), new Date(2026, 9, 6)));
    expect(parsed.app).toBe("mojbudzet");
    expect(parsed.storeVersion).toBe(STORE_VERSION);
    expect(parsed.data.currency).toBe("MKD");
    expect(parsed.data.vaultAmount).toBe(100);
    expect(parsed.data.transactions).toHaveLength(1);
  });
});

describe("persisted through the sharded storage", () => {
  it("rehydrates the same data", async () => {
    store().addTransaction({
      id: "t1", date: new Date(2025, 5, 1).toISOString(), merchant: "old", amount: 50,
      kind: TransactionKind.EXPENSE, note: "", source: "Рачно",
    });
    store().saveFromBalance(70, null, "");
    const before = persistedSnapshot();
    // Let the async persist writes finish, then load from storage again.
    await new Promise((r) => setTimeout(r, 0));
    await useAppStore.persist.rehydrate();
    expect(persistedSnapshot().transactions).toEqual(before.transactions);
    expect(persistedSnapshot().vaultAmount).toBe(70);
  });
});

describe("income has a source, expenses have categories", () => {
  const base = { date: new Date().toISOString(), merchant: "x", amount: 100, note: "", source: "Рачно" as const };

  it("drops a category from income and keeps its source", () => {
    store().addTransaction({ ...base, id: "i", kind: TransactionKind.INCOME, incomeType: "salary", categoryId: "cat-needs", subcategoryId: "sub-food" });
    const tx = store().transactions.find((t) => t.id === "i")!;
    expect(tx.incomeType).toBe("salary");
    expect(tx.categoryId).toBeUndefined();
    expect(tx.subcategoryId).toBeUndefined();
  });

  it("drops the source when an income is edited into an expense", () => {
    store().addTransaction({ ...base, id: "e", kind: TransactionKind.INCOME, incomeType: "gift" });
    const tx = store().transactions.find((t) => t.id === "e")!;
    store().updateTransaction({ ...tx, kind: TransactionKind.EXPENSE, categoryId: "cat-needs" });
    const edited = store().transactions.find((t) => t.id === "e")!;
    expect(edited.incomeType).toBeUndefined();
    expect(edited.categoryId).toBe("cat-needs");
  });
});

describe("saving last month's leftover on the 1st (D-1)", () => {
  const add = (id: string, kind: TransactionKind, amount: number, date: Date) =>
    store().addTransaction({ id, kind, amount, date: date.toISOString(), merchant: "x", note: "", source: "Рачно" });

  it("counts as last month's saving, so this month's leftover is not reduced", () => {
    add("sep-in", TransactionKind.INCOME, 60000, new Date(2026, 8, 1, 12));
    add("sep-out", TransactionKind.EXPENSE, 31500, new Date(2026, 8, 10, 12));
    store().saveFromBalance(leftoverOf(store().transactions, "2026-09", balance()), null, "", monthEnd("2026-09"));
    add("oct-in", TransactionKind.INCOME, 60000, new Date(2026, 9, 1, 12));
    add("oct-out", TransactionKind.EXPENSE, 40000, new Date(2026, 9, 10, 12));

    expect(store().vaultAmount).toBe(28500);
    expect(leftoverOf(store().transactions, "2026-09", balance())).toBe(0);
    expect(leftoverOf(store().transactions, "2026-10", balance())).toBe(20000);
  });
});

describe("app currency", () => {
  const spend = () =>
    store().addTransaction({ id: "t", kind: TransactionKind.EXPENSE, amount: 100, date: new Date().toISOString(), merchant: "x", note: "", source: "Рачно" });

  it("starts in MKD", () => {
    expect(store().currency).toBe("MKD");
  });

  it("keeps the typed numbers when switching before any transaction", () => {
    // beforeEach: opening balance 10 000 MKD, income 30 000 MKD.
    store().setBudget("cat-needs", 9000);
    store().addGoal({ id: "g", name: "Trip", targetAmount: 50000, currentAmount: 1000, colorHex: "#000" });
    store().setCurrency("EUR");
    expect(store().currency).toBe("EUR");
    expect(store().initialBalance).toBe(1_000_000); // 10 000,00 EUR in cents
    expect(store().incomeSchedule[0].amount).toBe(3_000_000);
    expect(store().budgets[0].monthlyLimit).toBe(900_000);
    expect(store().savingsGoals[0]).toMatchObject({ targetAmount: 5_000_000, currentAmount: 100_000 });

    store().setCurrency("RSD");
    expect(store().initialBalance).toBe(10000);
    expect(store().budgets[0].monthlyLimit).toBe(9000);
  });

  it("is fixed once there is a transaction", () => {
    spend();
    store().setCurrency("EUR");
    expect(store().currency).toBe("MKD");
    expect(store().initialBalance).toBe(10000);
  });

  it("goes back to MKD when all data is deleted", () => {
    store().setCurrency("EUR");
    store().resetAll();
    expect(store().currency).toBe("MKD");
  });
});
