import type { Category, PersistedState } from "../models";
import { defaultCategories } from "../models/Category";
import { monthKey } from "../utils/dates";
import { LEGACY_COLOR_MAP } from "../constants/palette";

/** Bump when the persisted shape changes, and add a step to migratePersistedState. */
export const STORE_VERSION = 3;

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

const defaultsById = new Map(defaultCategories.map((c) => [c.id, c]));

/**
 * Gives built-in categories and subcategories that still have their original
 * (Macedonian) name the i18n key, so they show in the app language.
 */
export function markDefaultNames(categories: Category[]): Category[] {
  return categories.map((c) => {
    const def = defaultsById.get(c.id);
    if (!def) return c;
    return {
      ...c,
      nameKey: c.name === def.name ? def.nameKey : c.nameKey,
      subcategories: c.subcategories.map((s) => {
        const defSub = def.subcategories.find((d) => d.id === s.id);
        return defSub && s.name === defSub.name ? { ...s, nameKey: defSub.nameKey } : s;
      }),
    };
  });
}

/**
 * Runs on every launch: merges the keywords (and bucket defaults) of built-in
 * categories from the current app version into the saved copies, so keyword
 * improvements reach existing users (D-6). Names, colours and anything the
 * user removed are left alone.
 */
export function refreshDefaultCategories(categories: Category[]): Category[] {
  return categories.map((c) => {
    const def = defaultsById.get(c.id);
    if (!def) return c;
    return {
      ...c,
      bucket: c.bucket ?? def.bucket,
      weight: c.weight ?? def.weight,
      subcategories: c.subcategories.map((s) => {
        const defSub = def.subcategories.find((d) => d.id === s.id);
        if (!defSub) return s;
        const keywords = [...new Set([...defSub.keywords, ...s.keywords])];
        return keywords.length === s.keywords.length ? s : { ...s, keywords };
      }),
    };
  });
}

const whole = (n: unknown): number =>
  typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 0;

type Loose = Record<string, any>;

/** Brings saved state from any older version up to STORE_VERSION. */
export function migratePersistedState(
  persisted: unknown,
  fromVersion: number,
  deps: { newId: () => string; now: Date }
): Partial<PersistedState> {
  const s: Loose = { ...(persisted as Loose) };

  if (fromVersion < 1 && Array.isArray(s.categories)) {
    s.categories = dedupeCategoryIds(s.categories, deps.newId);
  }

  if (fromVersion < 2) {
    // Money becomes whole denars (D-2).
    s.initialBalance = whole(s.initialBalance);
    s.vaultAmount = Math.max(0, whole(s.vaultAmount));
    s.transactions = ((s.transactions ?? []) as Loose[]).map((t) => ({
      ...t,
      amount: Math.abs(whole(t.amount)),
    }));
    s.savingsGoals = ((s.savingsGoals ?? []) as Loose[]).map((g) => ({
      ...g,
      targetAmount: Math.max(0, whole(g.targetAmount)),
      currentAmount: Math.max(0, whole(g.currentAmount)),
    }));
    s.incomeSchedule = ((s.incomeSchedule ?? []) as Loose[]).map((e) => ({
      ...e,
      amount: whole(e.amount),
    }));

    const categories: Category[] = markDefaultNames(s.categories ?? defaultCategories);
    s.categories = categories;
    // Budgets of deleted categories and empty limits are dropped (D-8).
    const ids = new Set(categories.map((c) => c.id));
    s.budgets = ((s.budgets ?? []) as Loose[])
      .map((b): Loose => ({ ...b, monthlyLimit: whole(b.monthlyLimit) }))
      .filter((b) => b.monthlyLimit > 0 && ids.has(b.categoryId));

    // The old rollover already ran (or wiped) this month; start fresh next month (D-1).
    s.lastRolloverMonth = monthKey(deps.now);
    if (typeof s.language !== "string") s.language = null;
    // Currency is fixed to MKD and shown from i18n (I-8, B-5).
    delete s.currency;
  }

  if (fromVersion < 3) {
    // Material colours become their iOS system counterparts (DESIGN.md §4.5).
    const recolor = <T extends { colorHex?: string }>(item: T): T => {
      const next = item.colorHex ? LEGACY_COLOR_MAP[item.colorHex.toUpperCase()] : undefined;
      return next ? { ...item, colorHex: next } : item;
    };
    if (Array.isArray(s.categories)) s.categories = (s.categories as Loose[]).map(recolor);
    if (Array.isArray(s.savingsGoals)) s.savingsGoals = (s.savingsGoals as Loose[]).map(recolor);
  }

  return s as Partial<PersistedState>;
}
