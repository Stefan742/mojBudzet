import { Category } from "./Category";
import { Transaction } from "./Transaction";
import { CategoryBudget } from "./Budget";
import { SavingsGoal } from "./SavingsGoal";
import { IncomeEntry } from "./Income";

/** Everything saved to AsyncStorage. Amounts are whole MKD. */
export interface PersistedState {
  isOnboarded: boolean;

  /** Opening balance entered at onboarding. */
  initialBalance: number;

  /** Monthly income by the month it applies from; see models/Income.ts. */
  incomeSchedule: IncomeEntry[];

  categories: Category[];

  transactions: Transaction[];

  budgets: CategoryBudget[];

  savingsGoals: SavingsGoal[];

  /** Savings not assigned to a goal. */
  vaultAmount: number;

  theme: "light" | "dark" | "system";

  /** "mk" | "en", or null to follow the device language. */
  language: string | null;

  /** Month ("YYYY-MM") in which the user last settled the previous month's leftover. */
  lastRolloverMonth?: string;
}
