import { Category } from "./Category";
import { Transaction } from "./Transaction";
import { CategoryBudget } from "./Budget";
import { SavingsGoal } from "./SavingsGoal";
import { RecurringRule } from "./Recurring";
import type { CurrencyCode } from "../constants/currencies";

/**
 * Everything saved to AsyncStorage. Amounts are integers in the smallest unit
 * of `currency` (whole denars for MKD, cents for EUR).
 */
export interface PersistedState {
  isOnboarded: boolean;

  /** The one currency all amounts are in; never converted. */
  currency: CurrencyCode;

  /** Opening balance entered at onboarding. */
  initialBalance: number;

  /** Repeating transactions (rent, subscriptions, the salary); see models/Recurring.ts. */
  recurring: RecurringRule[];

  /** Local reminders on the day a repeating transaction is due. */
  remindersEnabled: boolean;

  /**
   * Tips and suggestions the user closed ("repeating-intro", or a suggested
   * repeating merchant). Missing in older saves: the default (none) applies.
   */
  dismissedTips: string[];

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
