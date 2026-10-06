import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  PersistedState,
  Category,
  Transaction,
  TransactionKind,
  CategoryBudget,
  SavingsGoal,
  monthKey,
  withIncomeFrom,
} from "../models";
import { defaultCategories } from "../models/Category";
import { dedupeCategoryIds } from "./migrations";
import { v4 as uuid } from "uuid";

const STORAGE_KEY = "budget_state";

interface ComputedActions {
  currentBalance: () => number;
  totalExpenses: () => number;
  totalIncome: () => number;
  category: (id?: string) => Category | undefined;
  subcategory: (
    categoryId?: string,
    subId?: string
  ) => { id: string; name: string; keywords: string[] } | undefined;
  expensesByCategory: (month?: Date) => [Category, number][];
  monthlySpent: (categoryId: string, month?: Date) => number;
}

interface MutationActions {
  completeOnboarding: (balance: number, monthlyIncome?: number) => void;
  addTransaction: (t: Transaction) => void;
  updateTransaction: (t: Transaction) => void;
  deleteTransaction: (id: string) => void;
  setBudget: (categoryId: string, limit: number) => void;
  addCategory: (c: Category) => void;
  updateCategory: (c: Category) => void;
  deleteCategory: (id: string) => void;
  addGoal: (g: SavingsGoal) => void;
  updateGoal: (g: SavingsGoal) => void;
  deleteGoal: (id: string) => void;
  setInitialBalance: (balance: number) => void;
  /** Sets the monthly income from the current month onward (whole MKD). */
  setMonthlyIncome: (amount: number) => void;
  applyBudgetSuggestions: (
    suggestions: { categoryId: string; suggestedMonthlyLimit: number }[]
  ) => void;
  // ── Сеф ──────────────────────────────────────────────────────────────────
  addToVault: (amount: number) => void;
  transferFromVault: (amount: number, goalId: string) => void;
  setVaultAmount: (amount: number) => void;
  // ── DARK MODE ─────────────────────────────────────────────────────────────
  setTheme: (theme: "light" | "dark" | "system") => void;
  // ── LANGUAGE ─────────────────────────────────────────────────────────────
  setLanguage: (lang: string) => void;
}

export type AppStoreState = PersistedState &
  { language: string } &
  ComputedActions &
  MutationActions;

const initialState: PersistedState & { language: string } = {
  isOnboarded: false,
  initialBalance: 0,
  incomeSchedule: [],
  categories: defaultCategories,
  transactions: [],
  budgets: [],
  savingsGoals: [],
  currency: "МКД",
  vaultAmount: 0,
  theme: "system",
  language: "mk",
};

export const useAppStore = create<AppStoreState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ─── Computed ────────────────────────────────────────────────────────

      currentBalance: () => {
        const { initialBalance, transactions } = get();
        return (
          initialBalance +
          transactions.reduce(
            (acc, t) =>
              acc + (t.kind === TransactionKind.INCOME ? t.amount : -t.amount),
            0
          )
        );
      },

      totalExpenses: () =>
        get()
          .transactions.filter((t) => t.kind === TransactionKind.EXPENSE)
          .reduce((sum, t) => sum + t.amount, 0),

      totalIncome: () =>
        get()
          .transactions.filter((t) => t.kind === TransactionKind.INCOME)
          .reduce((sum, t) => sum + t.amount, 0),

      category: (id?: string) => {
        if (!id) return undefined;
        return get().categories.find((c) => c.id === id);
      },

      subcategory: (categoryId?: string, subId?: string) => {
        const cat = get().category(categoryId);
        if (!cat || !subId) return undefined;
        return cat.subcategories.find((s) => s.id === subId);
      },

      expensesByCategory: (month?: Date) => {
        const { transactions, categories } = get();
        const filtered = transactions.filter((t) => {
          if (t.kind !== TransactionKind.EXPENSE) return false;
          if (month) {
            const d = new Date(t.date);
            return (
              d.getFullYear() === month.getFullYear() &&
              d.getMonth() === month.getMonth()
            );
          }
          return true;
        });

        return categories
          .map((c): [Category, number] => {
            const sum = filtered
              .filter((t) => t.categoryId === c.id)
              .reduce((acc, t) => acc + t.amount, 0);
            return [c, sum];
          })
          .filter(([, sum]) => sum > 0)
          .sort((a, b) => b[1] - a[1]);
      },

      monthlySpent: (categoryId: string, month: Date = new Date()) => {
        return get()
          .transactions.filter((t) => {
            const d = new Date(t.date);
            return (
              t.kind === TransactionKind.EXPENSE &&
              t.categoryId === categoryId &&
              d.getFullYear() === month.getFullYear() &&
              d.getMonth() === month.getMonth()
            );
          })
          .reduce((sum, t) => sum + t.amount, 0);
      },

      // ─── Mutations ───────────────────────────────────────────────────────

      completeOnboarding: (balance: number, monthlyIncome = 0) =>
        set((s) => ({
          initialBalance: balance,
          isOnboarded: true,
          incomeSchedule:
            monthlyIncome > 0
              ? withIncomeFrom(s.incomeSchedule, monthKey(new Date()), monthlyIncome)
              : s.incomeSchedule,
        })),

      setInitialBalance: (balance: number) =>
        set({ initialBalance: balance }),

      setMonthlyIncome: (amount: number) =>
        set((s) => ({
          incomeSchedule: withIncomeFrom(s.incomeSchedule, monthKey(new Date()), amount),
        })),

      addTransaction: (t: Transaction) =>
        set((s) => ({ transactions: [t, ...s.transactions] })),

      updateTransaction: (t: Transaction) =>
        set((s) => ({
          transactions: s.transactions.map((x) => (x.id === t.id ? t : x)),
        })),

      deleteTransaction: (id: string) =>
        set((s) => ({
          transactions: s.transactions.filter((x) => x.id !== id),
        })),

      setBudget: (categoryId: string, limit: number) =>
        set((s) => {
          const exists = s.budgets.find((b) => b.categoryId === categoryId);
          if (exists) {
            return {
              budgets: s.budgets.map((b) =>
                b.categoryId === categoryId
                  ? { ...b, monthlyLimit: limit }
                  : b
              ),
            };
          }
          return {
            budgets: [
              ...s.budgets,
              { id: uuid(), categoryId, monthlyLimit: limit },
            ],
          };
        }),

      applyBudgetSuggestions: (
        suggestions: { categoryId: string; suggestedMonthlyLimit: number }[]
      ) => {
        const { setBudget } = get();
        for (const s of suggestions) {
          if (s.suggestedMonthlyLimit > 0) {
            setBudget(s.categoryId, s.suggestedMonthlyLimit);
          }
        }
      },

      addCategory: (c: Category) =>
        set((s) => {
          // Ids must be unique: chip selection, edit, delete and budgets all key on them.
          const idTaken = s.categories.some((x) => x.id === c.id);
          return { categories: [...s.categories, idTaken ? { ...c, id: uuid() } : c] };
        }),

      updateCategory: (c: Category) =>
        set((s) => ({
          categories: s.categories.map((x) => (x.id === c.id ? c : x)),
        })),

      deleteCategory: (id: string) =>
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          transactions: s.transactions.map((t) =>
            t.categoryId === id
              ? { ...t, categoryId: undefined, subcategoryId: undefined }
              : t
          ),
        })),

      addGoal: (g: SavingsGoal) =>
        set((s) => ({ savingsGoals: [...s.savingsGoals, g] })),

      updateGoal: (g: SavingsGoal) =>
        set((s) => ({
          savingsGoals: s.savingsGoals.map((x) => (x.id === g.id ? g : x)),
        })),

      deleteGoal: (id: string) =>
        set((s) => ({
          savingsGoals: s.savingsGoals.filter((g) => g.id !== id),
        })),

      // ─── Сеф ─────────────────────────────────────────────────────────────

      addToVault: (amount: number) =>
        set((s) => ({ vaultAmount: s.vaultAmount + amount })),

      transferFromVault: (amount: number, goalId: string) =>
        set((s) => {
          const goal = s.savingsGoals.find((g) => g.id === goalId);
          if (!goal) return {};
          const transfer = Math.min(amount, s.vaultAmount);
          return {
            vaultAmount: s.vaultAmount - transfer,
            savingsGoals: s.savingsGoals.map((g) =>
              g.id === goalId
                ? { ...g, currentAmount: g.currentAmount + transfer }
                : g
            ),
          };
        }),

      setVaultAmount: (amount: number) =>
        set({ vaultAmount: amount }),

      // ─── DARK MODE ────────────────────────────────────────────────────────
      setTheme: (theme: "light" | "dark" | "system") =>
        set({ theme }),

      // ─── LANGUAGE ────────────────────────────────────────────────────────
      setLanguage: (lang: string) =>
        set({ language: lang }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persisted, version) => {
        const state = persisted as Partial<PersistedState>;
        if (version < 1 && Array.isArray(state.categories)) {
          state.categories = dedupeCategoryIds(state.categories, uuid);
        }
        return state as AppStoreState;
      },
    }
  )
);