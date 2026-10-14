import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  PersistedState,
  Category,
  Transaction,
  TransactionKind,
  SavingsGoal,
  RecurringRule,
  BUILT_IN_RULE_NAMES,
  type BuiltInRuleName,
  monthKey,
  normalizeTransaction,
  dayFromKey,
  firstAfter,
  followingDate,
  isDue,
} from "../models";
import { defaultCategories } from "../models/Category";
import { CURRENCIES, DEFAULT_CURRENCY, type CurrencyCode } from "../constants/currencies";
import { clearLegacyCategorizerData } from "../services/categorizer/legacy";
import {
  STORE_VERSION,
  migratePersistedState,
  refreshDefaultCategories,
} from "./migrations";
import { createShardedStorage } from "./shardedStorage";
import i18n from "../i18n";
import { v4 as uuid } from "uuid";

const STORAGE_KEY = "budget_state";

// Derived values (balance, totals, spent per category) live in ./selectors as
// pure functions, so components subscribe to the data they read (Q-2).

/** What one repeating action changed, so the toast's Undo can put it back. */
export interface RecurringUndo {
  transactionIds: string[];
  /** The rules as they were before. */
  rules: RecurringRule[];
}

/** The salary set up during onboarding: becomes a repeating income. */
export interface OnboardingSalary {
  amount: number;
  day: number;
  /** Its name in the app language ("Плата", "Salary"). */
  name: string;
}

interface Actions {
  completeOnboarding: (balance: number, salary?: OnboardingSalary) => void;
  setInitialBalance: (balance: number) => void;
  /**
   * Changes the app currency, only while there are no transactions (they
   * would silently change meaning). The setup amounts keep the number the
   * user typed: 20 000 MKD becomes 20 000,00 EUR.
   */
  setCurrency: (code: CurrencyCode) => void;

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
   * savings always agree. `date` (default now) is the month it counts in.
   */
  saveFromBalance: (amount: number, goalId: string | null, note: string, date?: Date) => void;
  /** Moves money between pots; capped at what the vault holds. */
  transferFromVault: (amount: number, goalId: string) => void;

  /** Adds or replaces a repeating transaction. */
  saveRecurring: (rule: RecurringRule) => void;
  /** Transactions it already added stay. */
  deleteRecurring: (id: string) => void;
  /**
   * Adds the rule's next occurrence, dated on its own day unless `edit.date`
   * says otherwise. A changing amount is remembered as the next hint.
   */
  addRecurringOccurrence: (id: string, edit?: { amount?: number; date?: Date }) => RecurringUndo | null;
  /** Moves past the next occurrence without adding it. */
  skipRecurringOccurrence: (id: string) => RecurringUndo | null;
  /** Every occurrence due by `todayKey` of these rules; changing amounts are left alone. */
  addDueOccurrences: (ids: string[], todayKey: string) => RecurringUndo | null;
  undoRecurring: (undo: RecurringUndo) => void;
  setRemindersEnabled: (on: boolean) => void;
  /** Never show this tip or suggestion again. */
  dismissTip: (key: string) => void;

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
  currency: DEFAULT_CURRENCY,
  initialBalance: 0,
  recurring: [],
  remindersEnabled: true,
  dismissedTips: [],
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

/** Every built-in rule name in both app languages, for recognising old rules (v7). */
const builtInRuleNames = (): Record<string, BuiltInRuleName> =>
  Object.fromEntries(
    ["mk", "en"].flatMap((lng) => {
      const t = i18n.getFixedT(lng);
      return BUILT_IN_RULE_NAMES.map((key) => [t(key), key]);
    })
  );

/** The transaction for one occurrence of a rule. */
const occurrenceTransaction = (rule: RecurringRule, amount: number, date?: Date): Transaction =>
  normalizeTransaction({
    id: uuid(),
    date: (date ?? dayFromKey(rule.nextDate)).toISOString(),
    // A built-in name is written in the language of the day it is added.
    merchant: rule.nameKey ? i18n.t(rule.nameKey) : rule.merchant,
    amount,
    kind: rule.kind,
    categoryId: rule.categoryId,
    subcategoryId: rule.subcategoryId,
    incomeType: rule.incomeType,
    note: rule.note,
    source: "Рачно",
    recurringId: rule.id,
  });

export const useAppStore = create<AppStoreState>()(
  persist(
    (set, get) => ({
      ...initialState,

      completeOnboarding: (balance, salary) =>
        set((s) => ({
          initialBalance: balance,
          isOnboarded: true,
          // Nothing to roll over for the month the user starts in.
          lastRolloverMonth: monthKey(new Date()),
          recurring:
            salary && salary.amount > 0
              ? [
                  ...s.recurring,
                  {
                    id: uuid(),
                    kind: TransactionKind.INCOME,
                    merchant: salary.name,
                    nameKey: "incomeTypes.salary",
                    amount: Math.round(salary.amount),
                    variable: false,
                    incomeType: "salary",
                    note: "",
                    frequency: "monthly",
                    day: salary.day,
                    ask: true,
                    paused: false,
                    // Today's balance already includes a salary paid today or earlier.
                    nextDate: firstAfter({ frequency: "monthly", day: salary.day }, new Date()),
                  },
                ]
              : s.recurring,
        })),

      setInitialBalance: (balance) => set({ initialBalance: balance }),

      setCurrency: (code) =>
        set((s) => {
          if (code === s.currency || s.transactions.length > 0) return {};
          const factor = 10 ** (CURRENCIES[code].decimals - CURRENCIES[s.currency].decimals);
          const scale = (v: number) => Math.round(v * factor);
          return {
            currency: code,
            initialBalance: scale(s.initialBalance),
            vaultAmount: scale(s.vaultAmount),
            recurring: s.recurring.map((r) => ({ ...r, amount: scale(r.amount) })),
            budgets: s.budgets.map((b) => ({ ...b, monthlyLimit: scale(b.monthlyLimit) })),
            savingsGoals: s.savingsGoals.map((g) => ({
              ...g,
              targetAmount: scale(g.targetAmount),
              currentAmount: scale(g.currentAmount),
            })),
          };
        }),

      addTransaction: (t) =>
        set((s) => ({ transactions: [normalizeTransaction(t), ...s.transactions] })),

      updateTransaction: (t) =>
        set((s) => ({
          transactions: s.transactions.map((x) =>
            x.id === t.id ? normalizeTransaction(t) : x
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
          recurring: s.recurring.map((r) =>
            r.categoryId === id ? { ...r, categoryId: undefined, subcategoryId: undefined } : r
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

      saveFromBalance: (amount, goalId, note, date) =>
        set((s) => {
          const value = Math.round(amount);
          if (value <= 0) return {};
          if (goalId && !s.savingsGoals.some((g) => g.id === goalId)) return {};
          const tx: Transaction = {
            id: uuid(),
            date: (date ?? new Date()).toISOString(),
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

      saveRecurring: (rule) =>
        set((s) => ({
          recurring: s.recurring.some((r) => r.id === rule.id)
            ? s.recurring.map((r) => (r.id === rule.id ? rule : r))
            : [...s.recurring, rule],
        })),

      deleteRecurring: (id) => set((s) => ({ recurring: s.recurring.filter((r) => r.id !== id) })),

      addRecurringOccurrence: (id, edit) => {
        const s = get();
        const rule = s.recurring.find((r) => r.id === id);
        const amount = Math.round(edit?.amount ?? rule?.amount ?? 0);
        if (!rule || amount <= 0) return null;
        const tx = occurrenceTransaction(rule, amount, edit?.date);
        const next: RecurringRule = {
          ...rule,
          nextDate: followingDate(rule, rule.nextDate),
          amount: rule.variable ? amount : rule.amount,
        };
        set({
          transactions: [tx, ...s.transactions],
          recurring: s.recurring.map((r) => (r.id === id ? next : r)),
        });
        return { transactionIds: [tx.id], rules: [rule] };
      },

      skipRecurringOccurrence: (id) => {
        const rule = get().recurring.find((r) => r.id === id);
        if (!rule) return null;
        set((s) => ({
          recurring: s.recurring.map((r) => (r.id === id ? { ...r, nextDate: followingDate(r, r.nextDate) } : r)),
        }));
        return { transactionIds: [], rules: [rule] };
      },

      addDueOccurrences: (ids, todayKey) => {
        const s = get();
        const added: Transaction[] = [];
        const before: RecurringRule[] = [];
        const recurring = s.recurring.map((rule) => {
          if (!ids.includes(rule.id) || rule.variable || rule.amount <= 0 || !isDue(rule, todayKey)) return rule;
          before.push(rule);
          let next = rule;
          // Each missed occurrence on its own day, so every month's totals stay right.
          while (isDue(next, todayKey)) {
            added.push(occurrenceTransaction(next, next.amount));
            next = { ...next, nextDate: followingDate(next, next.nextDate) };
          }
          return next;
        });
        if (!added.length) return null;
        set({ transactions: [...added, ...s.transactions], recurring });
        return { transactionIds: added.map((t) => t.id), rules: before };
      },

      undoRecurring: (undo) =>
        set((s) => ({
          transactions: s.transactions.filter((t) => !undo.transactionIds.includes(t.id)),
          recurring: s.recurring.map((r) => undo.rules.find((u) => u.id === r.id) ?? r),
        })),

      setRemindersEnabled: (on) => set({ remindersEnabled: on }),

      dismissTip: (key) =>
        set((s) => (s.dismissedTips.includes(key) ? {} : { dismissedTips: [...s.dismissedTips, key] })),

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
      // Transactions are kept in one entry per year (D-10, P-5).
      storage: createJSONStorage(() => createShardedStorage(AsyncStorage)),
      version: STORE_VERSION,
      // Only data is saved, never the action functions (D-3).
      partialize: pickPersisted,
      migrate: (persisted, version) =>
        migratePersistedState(persisted, version, {
          newId: uuid,
          now: new Date(),
          salaryName: i18n.t("incomeTypes.salary"),
          builtInNames: builtInRuleNames(),
        }) as AppStoreState,
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
        // The old categorizer kept its own copy of what it learned; no longer used.
        void clearLegacyCategorizerData();
      },
    }
  )
);

/** The data that is saved on the device, for export (R-11). */
export const persistedSnapshot = (): PersistedState => pickPersisted(useAppStore.getState());
