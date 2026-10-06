import type { Category } from "../models";

/**
 * Repairs categories that were saved with a shared id (KB-1).
 * The first category keeps the id, so existing transactions and budgets stay on it.
 * Exact clones are dropped; differing duplicates get a fresh id.
 */
export function dedupeCategoryIds(
  categories: Category[],
  makeId: () => string
): Category[] {
  const seen = new Map<string, string[]>();
  const result: Category[] = [];
  for (const c of categories) {
    const json = JSON.stringify(c);
    const kept = seen.get(c.id);
    if (!kept) {
      seen.set(c.id, [json]);
      result.push(c);
    } else if (!kept.includes(json)) {
      kept.push(json);
      result.push({ ...c, id: makeId() });
    }
  }
  return result;
}
