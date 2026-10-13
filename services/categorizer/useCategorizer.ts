import { useMemo } from "react";
import { useAppStore } from "../../store/useAppStore";
import { buildMemory, categorize, type CategorizeResult } from "./categorize";

/**
 * Category suggestions from the user's own history and the bundled merchant
 * knowledge. Learning is just reading the saved transactions, so every save
 * (in Add or History) teaches it, and deleting data forgets it.
 */
export function useCategorizer(): (merchant: string, note: string) => CategorizeResult {
  const transactions = useAppStore((s) => s.transactions);
  const categories   = useAppStore((s) => s.categories);
  const memory       = useMemo(() => buildMemory(transactions), [transactions]);
  return (merchant, note) => categorize(merchant, note, { categories, memory });
}
