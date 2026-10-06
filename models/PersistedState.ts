import { Category } from "./Category";
import { Transaction } from "./Transaction";
import { CategoryBudget } from "./Budget";
import { SavingsGoal } from "./SavingsGoal";
import { IncomeEntry } from "./Income";

export interface PersistedState {
  isOnboarded: boolean;

  initialBalance: number;

  /** Monthly income by the month it applies from; see models/Income.ts. */
  incomeSchedule: IncomeEntry[];

  categories: Category[];

  transactions: Transaction[];

  budgets: CategoryBudget[];

  savingsGoals: SavingsGoal[];

  currency: string;
  
  vaultAmount: number;

  theme: "light" | "dark" | "system";
}