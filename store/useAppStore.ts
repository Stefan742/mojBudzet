import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  PersistedState,
  Category,
  Transaction,
  TransactionKind,
  SavingsGoal,
  monthKey,
  withIncomeFrom,
} from "../models";
import { defaultCategories } from "../models/Category";
import {
  STORE_VERSION,
  migratePersistedState,
  refreshDefaultCategories,
} from "./migrations";
import i18n from "../i18n";
import { v4 as uuid } from "uuid";

const STORAGE_KEY = "budget_state";

// Derived values (balance, totals, spent per category) live in ./selectors as
// pure functions, so components subscribe to the data they read (Q-2).

interface Actions {
  completeOnboarding: (balance: number, monthlyIncome?: number) => void;
  setInitialBalance: (balance: number) => void;
  /** Sets the monthly income from the current month onward (whole MKD). */
  setMonthlyIncome: (amount: number) => void;

  addTransaction: (t: Transaction) => void;
  updateTransaction: (t: Transaction) => void;
  /** Deleting a SAVINGS transaction also takes the money back out of its pot. */
  deleteTransaction: (id: string) => void;

  /** A limit of 0 removes the budget. */
  setBudget: (categoryId: string, limit: number) => void;
  applyBudgetSuggestions: (
    suggestions: { categoryId: string; suggestedMonthlyLimit: number }[]
  ) => void;

  addCategory: (c: Category) => void;
  updateCategory: (c: Category) => void;
  /** Also removes its budget; its transactions become uncategorized. */
  deleteCategory: (id: string) => void;

  addGoal: (g: SavingsGoal) => void;
  updateGoal: (g: SavingsGoal) => void;
  /** The goal's saved money moves to the vault; nothing is lost. */
  deleteGoal: (id: string) => void;
  /**
   * Moves money from the balance into savings: a goal, or the vault when
   * goalId is null. Recorded as a SAVINGS transaction, so the balance and the
   * savings always agree.
   */
  saveFromBalance: (amount: number, goalId: string | null, note: string) => void;
  /** Moves money between pots; capped at what the vault holds. */
  transferFromVault: (amount: number, goalId: string) => void;

  /** Marks a month's leftover as handled so the prompt is not shown again. */
  markRolloverDone: (month: string) => void;

  setTheme: (theme: "light" | "dark" | "system") => void;
  /** null follows the device language. */
  setLanguage: (lang: string | null) => void;

  /** Deletes all data and returns to onboarding. */
  resetAll: () => void;
}

export type AppStoreState = PersistedState & Actions;

const initialState: PersistedState = {
  isOnboarded: false,
  initialBalance: 0,
  incomeSchedule: [],
  categories: defaultCategories,
  transactions: [],
  budgets: [],
  savingsGoals: [],
  vaultAmount: 0,
  theme: "system",
  language: null,
  lastRolloverMonth: undefined,
};

const PERSISTED_KEYS = Object.keys(initialState) as (keyof PersistedState)[];

/** Only the saved data, without the action functions. */
const pickPersisted = (s: AppStoreState): PersistedState =>
  Object.fromEntries(PERSISTED_KEYS.map((k) => [k, s[k]])) as unknown as PersistedState;

const deviceLanguage = (): string => i18n.options.lng ?? "mk";

export const useAppStore = create<AppStoreState>()(
  persist(
    (set, get) => ({
      ...initialState,

      completeOnboarding: (balance, monthlyIncome = 0) =>
        set((s) => ({
          initialBalance: balance,
          isOnboarded: true,
          // Nothing to roll over for the month the user starts in.
          lastRolloverMonth: monthKey(new Date()),
          incomeSchedule:
            monthlyIncome > 0
              ? withIncomeFrom(s.incomeSchedule, monthKey(new Date()), monthlyIncome)
              : s.incomeSchedule,
        })),

      setInitialBalance: (balance) => set({ initialBalance: balance }),

      setMonthlyIncome: (amount) =>
        set((s) => ({
          incomeSchedule: withIncomeFrom(s.incomeSchedule, monthKey(new Date()), amount),
        })),

      addTransaction: (t) =>
        set((s) => ({ transactions: [{ ...t, amount: Math.round(t.amount) }, ...s.transactions] })),

      updateTransaction: (t) =>
        set((s) => ({
          transactions: s.transactions.map((x) =>
            x.id === t.id ? { ...t, amount: Math.round(t.amount) } : x
          ),
        })),

      deleteTransaction: (id) =>
        set((s) => {
          const tx = s.transactions.find((x) => x.id === id);
          const transactions = s.transactions.filter((x) => x.id !== id);
          if (!tx || tx.kind !== TransactionKind.SAVINGS) return { transactions };
          const goal = tx.goalId ? s.savingsGoals.find((g) => g.id === tx.goalId) : undefined;
          if (goal) {
            return {
              transactions,
              savingsGoals: s.savingsGoals.map((g) =>
                g.id === goal.id ? { ...g, currentAmount: Math.max(0, g.currentAmount - tx.amount) } : g
              ),
            };
          }
          return { transactions, vaultAmount: Math.max(0, s.vaultAmount - tx.amount) };
        }),

      setBudget: (categoryId, limit) =>
        set((s) => {
          const rest = s.budgets.filter((b) => b.categoryId !== categoryId);
          if (limit <= 0) return { budgets: rest };
          const existing = s.budgets.find((b) => b.categoryId === categoryId);
          return {
            budgets: [
              ...rest,
              { id: existing?.id ?? uuid(), categoryId, monthlyLimit: Math.round(limit) },
            ],
          };
        }),

      applyBudgetSuggestions: (suggestions) => {
        const { setBudget } = get();
        for (const s of suggestions) {
          if (s.suggestedMonthlyLimit > 0) setBudget(s.categoryId, s.suggestedMonthlyLimit);
        }
      },

      addCategory: (c) =>
        set((s) => {
          // Ids must be unique: chip selection, edit, delete and budgets all key on them.
          const idTaken = s.categories.some((x) => x.id === c.id);
          return { categories: [...s.categories, idTaken ? { ...c, id: uuid() } : c] };
        }),

      updateCategory: (c) =>
        set((s) => ({
          categories: s.categories.map((x) => (x.id === c.id ? c : x)),
        })),

      deleteCategory: (id) =>
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          budgets: s.budgets.filter((b) => b.categoryId !== id),
          transactions: s.transactions.map((t) =>
            t.categoryId === id ? { ...t, categoryId: undefined, subcategoryId: undefined } : t
          ),
        })),

      addGoal: (g) =>
        set((s) => ({
          savingsGoals: [...s.savingsGoals.filter((x) => x.id !== g.id), g],
        })),

      updateGoal: (g) =>
        set((s) => ({
          savingsGoals: s.savingsGoals.map((x) => (x.id === g.id ? g : x)),
        })),

      deleteGoal: (id) =>
        set((s) => {
          const goal = s.savingsGoals.find((g) => g.id === id);
          return {
            savingsGoals: s.savingsGoals.filter((g) => g.id !== id),
            vaultAmount: s.vaultAmount + (goal?.currentAmount ?? 0),
            // Its history stays, now counted as vault money.
            transactions: s.transactions.map((t) => (t.goalId === id ? { ...t, goalId: undefined } : t)),
          };
        }),

      saveFromBalance: (amount, goalId, note) =>
        set((s) => {
          const value = Math.round(amount);
          if (value <= 0) return {};
          if (goalId && !s.savingsGoals.some((g) => g.id === goalId)) return {};
          const tx: Transaction = {
            id: uuid(),
            date: new Date().toISOString(),
            merchant: "",
            amount: value,
            kind: TransactionKind.SAVINGS,
            goalId: goalId ?? undefined,
            note,
            source: "Рачно",
          };
          return {
            transactions: [tx, ...s.transactions],
            ...(goalId
              ? {
                  savingsGoals: s.savingsGoals.map((g) =>
                    g.id === goalId ? { ...g, currentAmount: g.currentAmount + value } : g
                  ),
                }
              : { vaultAmount: s.vaultAmount + value }),
          };
        }),

      transferFromVault: (amount, goalId) =>
        set((s) => {
          const goal = s.savingsGoals.find((g) => g.id === goalId);
          if (!goal) return {};
          const transfer = Math.min(Math.round(amount), s.vaultAmount);
          if (transfer <= 0) return {};
          return {
            vaultAmount: s.vaultAmount - transfer,
            savingsGoals: s.savingsGoals.map((g) =>
              g.id === goalId ? { ...g, currentAmount: g.currentAmount + transfer } : g
            ),
          };
        }),

      markRolloverDone: (month) => set({ lastRolloverMonth: month }),

      setTheme: (theme) => set({ theme }),

      setLanguage: (lang) => {
        i18n.changeLanguage(lang ?? deviceLanguage());
        set({ language: lang });
      },

      resetAll: () => {
        set({ ...initialState });
        i18n.changeLanguage(deviceLanguage());
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: STORE_VERSION,
      // Only data is saved, never the action functions (D-3).
      partialize: pickPersisted,
      migrate: (persisted, version) =>
        migratePersistedState(persisted, version, { newId: uuid, now: new Date() }) as AppStoreState,
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<PersistedState>;
        return {
          ...current,
          ...saved,
          categories: refreshDefaultCategories(saved.categories ?? current.categories),
        };
      },
      // Apply the saved language before the first screen renders (B-3).
      onRehydrateStorage: () => (state) => {
        if (state?.language) i18n.changeLanguage(state.language);
      },
    }
  )
);

/** The data that is saved on the device, for export (R-11). */
export const persistedSnapshot = (): PersistedState => pickPersisted(useAppStore.getState());
