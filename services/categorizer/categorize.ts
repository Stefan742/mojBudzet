/**
 * Category suggestions, fully on the device. Steps, most reliable first; the
 * first step that is sure wins:
 *
 *   1. history   the user's own earlier transactions at the same merchant
 *   2. merchant  a known store or service (merchants.ts)
 *   3. keyword   a generic word in the merchant or note ("apteka", "kafe"),
 *                including the user's own subcategory keywords
 *   4. similar   the same, with a typo ("tineks" → Tinex)
 *
 * When nothing is sure it suggests nothing (a wrong guess is worse than
 * none) and returns up to two `alternatives` for the user to tap.
 */
import { Category, Transaction, TransactionKind, defaultCategories } from "../../models";
import { KEYWORDS, MERCHANTS } from "./merchants";
import { foldText, merchantKey, tokens } from "./normalize";

export type SuggestionSource = "history" | "merchant" | "keyword" | "similar";

export interface Suggestion {
  categoryId: string;
  subcategoryId?: string;
  /** 0–1. Only suggestions at or above FILL_AT are filled in. */
  confidence: number;
  source: SuggestionSource;
}

export interface CategorizeResult {
  best: Suggestion | null;
  /** Weaker candidates, offered when there is no `best`. */
  alternatives: Suggestion[];
}

export const FILL_AT = 0.6;

const CONFIDENCE: Record<SuggestionSource, number> = {
  history: 0.95,
  merchant: 0.9,
  keyword: 0.75,
  similar: 0.65,
};

// ─── Bundled knowledge, folded once ──────────────────────────────────────────

type Label = { subcategoryId: string };

/** Folded phrase → subcategory, longest phrases first. */
const merchantPhrases: [string, string][] = Object.entries(MERCHANTS)
  .flatMap(([sub, names]) => names.map((n): [string, string] => [merchantKey(n), sub]))
  .filter(([phrase]) => phrase.length > 0)
  .sort((a, b) => b[0].length - a[0].length);

const keywordPhrases: [string, string][] = Object.entries(KEYWORDS)
  .flatMap(([sub, words]) => words.map((w): [string, string] => [foldText(w), sub]))
  .filter(([phrase]) => phrase.length > 0);

const defaultParent = new Map(
  defaultCategories.flatMap((c) => c.subcategories.map((s) => [s.id, c.id] as const))
);

// ─── Matching helpers ────────────────────────────────────────────────────────

/** Whether `phrase` appears in `text` as whole words. Both folded. */
const hasPhrase = (text: string, phrase: string) => ` ${text} `.includes(` ${phrase} `);

/**
 * Edit distance with adjacent swaps (optimal string alignment), stopping
 * early once it exceeds `max`.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    rows.push([i]);
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      if (i === 0) {
        rows[0][j] = j;
        continue;
      }
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, rows[i - 2][j - 2] + 1);
      rows[i][j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (i > 0 && rowMin > max) return max + 1;
  }
  return rows[a.length][b.length];
}

/** Typos allowed for a word of this length: none for short words. */
const typoBudget = (length: number) => (length >= 8 ? 2 : length >= 5 ? 1 : 0);

// ─── 1. The user's history ───────────────────────────────────────────────────

interface MemoryEntry {
  categoryId: string;
  subcategoryId?: string;
}

/** Merchant key → what the user usually picks there. */
export type MerchantMemory = Map<string, MemoryEntry>;

/** How many recent visits vote, and how much each counts (newest first). */
const VOTES = [1, 0.5, 0.33, 0.25, 0.2];

/**
 * Learns from every categorized expense: per merchant, the last five visits
 * vote, newer ones counting more. One odd exception does not flip a habit,
 * two changes in a row do.
 */
export function buildMemory(transactions: Transaction[]): MerchantMemory {
  const visits = new Map<string, { date: string; label: MemoryEntry }[]>();
  for (const t of transactions) {
    if (t.kind !== TransactionKind.EXPENSE || !t.categoryId) continue;
    const key = merchantKey(t.merchant);
    if (!key) continue;
    const list = visits.get(key) ?? [];
    list.push({ date: t.date, label: { categoryId: t.categoryId, subcategoryId: t.subcategoryId } });
    visits.set(key, list);
  }

  const memory: MerchantMemory = new Map();
  for (const [key, list] of visits) {
    list.sort((a, b) => b.date.localeCompare(a.date));
    const scores = new Map<string, { score: number; label: MemoryEntry }>();
    list.slice(0, VOTES.length).forEach((v, i) => {
      const id = `${v.label.categoryId}|${v.label.subcategoryId ?? ""}`;
      const entry = scores.get(id) ?? { score: 0, label: v.label };
      entry.score += VOTES[i];
      scores.set(id, entry);
    });
    const winner = [...scores.values()].sort((a, b) => b.score - a.score)[0];
    memory.set(key, winner.label);
  }
  return memory;
}

// ─── Resolving a label against the user's categories ─────────────────────────

/**
 * Turns a subcategory into a suggestion the user's categories can hold: the
 * subcategory may have been deleted (then its default parent, if kept), or
 * the whole category may be gone (then nothing).
 */
function resolve(
  categories: Category[],
  label: { categoryId?: string; subcategoryId?: string },
  source: SuggestionSource,
  confidence = CONFIDENCE[source]
): Suggestion | null {
  if (label.subcategoryId) {
    const parent = categories.find((c) => c.subcategories.some((s) => s.id === label.subcategoryId));
    if (parent) return { categoryId: parent.id, subcategoryId: label.subcategoryId, confidence, source };
  }
  const categoryId = label.categoryId ?? (label.subcategoryId ? defaultParent.get(label.subcategoryId) : undefined);
  if (categoryId && categories.some((c) => c.id === categoryId)) return { categoryId, confidence, source };
  return null;
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function categorize(
  merchant: string,
  note: string,
  context: { categories: Category[]; memory: MerchantMemory }
): CategorizeResult {
  const { categories, memory } = context;
  const key = merchantKey(merchant);
  if (!key) return { best: null, alternatives: [] };
  const candidates: Suggestion[] = [];
  const add = (s: Suggestion | null) => {
    if (s && !candidates.some((c) => c.categoryId === s.categoryId && c.subcategoryId === s.subcategoryId)) {
      candidates.push(s);
    }
  };

  // 1. History: this exact merchant, or a remembered merchant inside it ("kam" in "kam market").
  const exact = memory.get(key);
  if (exact) add(resolve(categories, exact, "history"));
  if (!candidates.length) {
    const inside = [...memory.keys()]
      .filter((k) => k.length >= 3 && hasPhrase(key, k))
      .sort((a, b) => b.length - a.length)[0];
    if (inside) add(resolve(categories, memory.get(inside)!, "history"));
  }
  if (candidates.length) return { best: candidates[0], alternatives: [] };

  // 2. A known merchant, the longest name that appears.
  const known = merchantPhrases.find(([phrase]) => hasPhrase(key, phrase));
  if (known) {
    const s = resolve(categories, { subcategoryId: known[1] }, "merchant");
    if (s) return { best: s, alternatives: [] };
  }

  // 3. Keywords in the merchant and the note: bundled ones and the user's own.
  const words = tokens(`${merchant} ${note}`);
  const text = words.join(" ");
  const scores = new Map<string, { score: number; label: Label; categoryId?: string }>();
  const score = (phrase: string, label: Label, categoryId?: string) => {
    const k = `${categoryId ?? ""}|${label.subcategoryId}`;
    let points = 0;
    if (hasPhrase(text, phrase)) points = phrase.length * 2;
    // Macedonian endings: "aptekata", "kafeto" start with the word.
    else if (phrase.length >= 4 && !phrase.includes(" ") && words.some((w) => w.startsWith(phrase))) points = phrase.length;
    if (!points) return;
    const entry = scores.get(k) ?? { score: 0, label, categoryId };
    entry.score = Math.max(entry.score, points);
    scores.set(k, entry);
  };
  for (const [phrase, sub] of keywordPhrases) score(phrase, { subcategoryId: sub });
  for (const c of categories) {
    for (const s of c.subcategories) {
      for (const kw of s.keywords) {
        const phrase = foldText(kw);
        if (phrase) score(phrase, { subcategoryId: s.id }, c.id);
      }
    }
  }
  const ranked: { s: Suggestion; score: number }[] = [];
  for (const e of scores.values()) {
    const s = resolve(categories, { ...e.label, categoryId: e.categoryId }, "keyword");
    if (s) ranked.push({ s, score: e.score });
  }
  ranked.sort((a, b) => b.score - a.score);
  if (ranked.length) {
    const [top, second] = ranked;
    const sameAsTop = (x?: { s: Suggestion }) =>
      x && x.s.categoryId === top.s.categoryId && x.s.subcategoryId === top.s.subcategoryId;
    // A tie between two different subcategories is not sure.
    if (!second || second.score < top.score || sameAsTop(second)) return { best: top.s, alternatives: [] };
    ranked.slice(0, 2).forEach((x) => add({ ...x.s, confidence: 0.5 }));
  }

  // 4. Similar spelling: each word against known merchants, remembered merchants and keywords.
  let similar: { label: MemoryEntry | Label; source: SuggestionSource; distance: number; length: number } | null = null;
  const consider = (word: string, target: string, label: MemoryEntry | Label) => {
    const budget = typoBudget(target.length);
    if (!budget || word === target) return;
    const d = editDistance(word, target, budget);
    if (d > budget) return;
    if (!similar || d < similar.distance || (d === similar.distance && target.length > similar.length)) {
      similar = { label, source: "similar", distance: d, length: target.length };
    }
  };
  const keyWords = key.split(" ");
  for (const w of keyWords) {
    for (const [phrase, sub] of merchantPhrases) if (!phrase.includes(" ")) consider(w, phrase, { subcategoryId: sub });
    for (const [k, entry] of memory) if (!k.includes(" ")) consider(w, k, entry);
  }
  for (const w of words) {
    for (const [phrase, sub] of keywordPhrases) if (!phrase.includes(" ")) consider(w, phrase, { subcategoryId: sub });
  }
  const found = similar as { label: MemoryEntry | Label; distance: number } | null;
  if (found) {
    // One typo in a word of five letters or more is sure enough; two is a hint.
    const s = resolve(categories, found.label, "similar", found.distance === 1 ? CONFIDENCE.similar : 0.45);
    if (s && s.confidence >= FILL_AT && !candidates.length) return { best: s, alternatives: [] };
    add(s);
  }

  return { best: null, alternatives: candidates.slice(0, 2) };
}
