import { Category } from "./Category";
import { Transaction } from "./Transaction";
import { CategoryBudget } from "./Budget";
import { SavingsGoal } from "./SavingsGoal";

export interface PersistedState {
  isOnboarded: boolean;

  initialBalance: number;

  categories: Category[];

  transactions: Transaction[];

  budgets: CategoryBudget[];

  savingsGoals: SavingsGoal[];

  currency: string;
  
  vaultAmount: number;

  theme: "light" | "dark" | "system";
}