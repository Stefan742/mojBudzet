/**
 * budgetSuggestionEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Offline, deterministic budget suggestion engine for MojBudzet.
 *
 * Algorithm overview
 * ──────────────────
 * 1. Classify each category into a bucket (needs / wants / savings /
 *    emergency / debt).  Bucket is determined by:
 *      a) an explicit `bucket` field on the category (future-proof), OR
 *      b) keyword matching against the category name + subcategory names, OR
 *      c) fallback → "wants" (a safe, neutral bucket).
 *
 * 2. Split monthly income across buckets using the classic 50/25/15/10 rule:
 *      needs      50 %
 *      wants      25 %
 *      savings    15 %
 *      emergency  10 %
 *      debt       15 % when debt categories exist (taken from needs, wants
 *                 and emergency)
 *    Buckets without categories give their share to the others in
 *    proportion, so the rule-based limits add up to the income.
 *
 * 3. Within each bucket, distribute its pool among member categories by
 *    weight (default weight = 1, range 1–5).
 *
 * 4. If real transactions are supplied, calibrate the suggestion:
 *      suggestedLimit = 0.7 × rule-based + 0.3 × (average of the last 3
 *      complete months)
 *    This blends the theoretical rule with actual user behaviour.
 *
 * All results are rounded to the nearest integer (МКД has no sub-unit UX).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Category, Transaction, TransactionKind } from "../models";
import { monthKey, shiftMonth } from "../utils/dates";

// ─── Public types ─────────────────────────────────────────────────────────────

/** Bucket taxonomy — extend freely; engine never hard-codes category names. */
export type Bucket = "needs" | "wants" | "savings" | "emergency" | "debt";

/**
 * Extended category shape accepted by the engine.
 * The base Category model stays untouched; extras are optional so the engine
 * degrades gracefully when they are absent.
 */
export interface CategoryWithMeta extends Category {
  /** Explicit bucket override — takes priority over auto-detection. */
  bucket?: Bucket;
  /**
   * Relative weight within the bucket (1 = low priority, 5 = high priority).
   * Omitting weight defaults to 1.
   */
  weight?: number;
}

export interface BudgetSuggestion {
  categoryId: string;
  suggestedMonthlyLimit: number;
  /** The bucket this category was classified into (useful for UI display). */
  bucket: Bucket;
  /** Confidence 0–1: 1 = fully rule-based, <1 = calibrated by transactions. */
  confidence: number;
}

export interface SuggestionInput {
  income: number;
  categories: CategoryWithMeta[];
  transactions?: Transaction[];
  /** "Today" for the history window; defaults to now. */
  referenceDate?: Date;
}

// ─── Bucket allocation table ──────────────────────────────────────────────────

const BUCKET_RATIO: Record<Bucket, number> = {
  needs:     0.50,
  wants:     0.25,
  savings:   0.15,
  emergency: 0.10,
  debt:      0.00,   // re-distributed at runtime when debt categories exist
};

// ─── Keyword → bucket classification map ─────────────────────────────────────
// Keys are lowercase substrings matched against the category name AND all
// subcategory names concatenated.  Longer/more-specific keys win.

const BUCKET_KEYWORDS: { keywords: string[]; bucket: Bucket }[] = [
  // ── needs ──────────────────────────────────────────────────────────────────
  {
    keywords: [
      "потреби", "needs", "храна", "food", "сметки", "bills", "струја",
      "вода", "парно", "интернет", "здравје", "health", "аптека", "apteka",
      "лекар", "станарина", "rent", "транспорт", "transport", "гориво", "fuel",
      "осигурување", "insurance", "комуналии", "utilities", "телеком",
    ],
    bucket: "needs",
  },
  // ── wants ──────────────────────────────────────────────────────────────────
  {
    keywords: [
      "желби", "wants", "шопинг", "shopping", "ресторани", "restaurant",
      "забава", "entertainment", "кино", "cinema", "хоби", "hobby", "патување",
      "travel", "одмор", "vacation", "кафе", "cafe", "bar", "pizza", "burger",
      "облека", "clothing", "козметика", "cosmetics", "спорт", "sport",
    ],
    bucket: "wants",
  },
  // ── savings ────────────────────────────────────────────────────────────────
  {
    keywords: [
      "заштеда", "savings", "инвестиции", "investments", "акции", "stocks",
      "etf", "берза", "крипто", "crypto", "bitcoin", "binance", "пензија",
      "pension", "штедење", "фонд", "fund",
    ],
    bucket: "savings",
  },
  // ── emergency ──────────────────────────────────────────────────────────────
  {
    keywords: [
      "итни", "emergency", "непредвидени", "unexpected", "поправка", "repair",
      "сервис", "service", "резерва", "reserve", "кризен", "crisis",
    ],
    bucket: "emergency",
  },
  // ── debt ───────────────────────────────────────────────────────────────────
  {
    keywords: [
      "долг", "debt", "кредит", "credit", "заем", "loan", "рати", "installment",
      "хипотека", "mortgage", "камата", "interest",
    ],
    bucket: "debt",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a single lowercase search string from the category name and all of
 * its subcategory names + keywords.
 */
function buildSearchCorpus(cat: CategoryWithMeta): string {
  const parts: string[] = [cat.name];
  for (const sub of cat.subcategories ?? []) {
    parts.push(sub.name, ...(sub.keywords ?? []));
  }
  return parts.join(" ").toLowerCase();
}

/**
 * Classifies a category into a bucket.
 * Priority: explicit field → keyword match (most specific wins) → "wants".
 */
function classifyBucket(cat: CategoryWithMeta): Bucket {
  if (cat.bucket) return cat.bucket;

  const corpus = buildSearchCorpus(cat);

  let bestBucket: Bucket = "wants";
  let bestScore   = 0;

  for (const { keywords, bucket } of BUCKET_KEYWORDS) {
    for (const kw of keywords) {
      if (corpus.includes(kw.toLowerCase())) {
        // Longer keyword → more specific → higher score
        const score = kw.length;
        if (score > bestScore) {
          bestScore  = score;
          bestBucket = bucket;
        }
      }
    }
  }

  return bestBucket;
}

/** Clamps and rounds to integer МКД. */
function mkd(value: number): number {
  return Math.max(0, Math.round(value));
}

// ─── Transaction-based calibration ───────────────────────────────────────────

/**
 * Average monthly spend per category over the last 3 complete months
 * (the current, partial month is excluded). Months before the first recorded
 * transaction do not count, so a new user is not averaged over empty months.
 */
export function computeRollingAverages(
  transactions: Transaction[],
  referenceDate: Date = new Date()
): Map<string, number> {
  const window = [1, 2, 3].map((n) => monthKey(shiftMonth(referenceDate, -n)));
  const firstMonth = transactions.reduce<string | null>((first, t) => {
    const k = monthKey(new Date(t.date));
    return first === null || k < first ? k : first;
  }, null);
  if (firstMonth === null) return new Map();
  const counted = window.filter((k) => k >= firstMonth);
  if (counted.length === 0) return new Map();

  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.kind !== TransactionKind.EXPENSE || !t.categoryId) continue;
    if (!counted.includes(monthKey(new Date(t.date)))) continue;
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount);
  }

  const result = new Map<string, number>();
  for (const [catId, total] of totals) result.set(catId, total / counted.length);
  return result;
}

// ─── Bucket pool redistributor ────────────────────────────────────────────────

/**
 * Bucket shares for the buckets that actually have categories. With debt
 * categories, debt takes 15% from needs, wants and emergency. Shares of
 * buckets without categories are spread over the others in proportion, so
 * the rule-based limits always add up to the income.
 */
export function buildEffectiveRatios(buckets: Set<Bucket>): Record<Bucket, number> {
  const base: Record<Bucket, number> = buckets.has("debt")
    ? { needs: 0.45, wants: 0.20, savings: 0.15, emergency: 0.05, debt: 0.15 }
    : { ...BUCKET_RATIO };
  const present = (Object.keys(base) as Bucket[]).filter((b) => buckets.has(b));
  const total = present.reduce((sum, b) => sum + base[b], 0);
  const ratios = { needs: 0, wants: 0, savings: 0, emergency: 0, debt: 0 } as Record<Bucket, number>;
  for (const b of present) ratios[b] = total > 0 ? base[b] / total : 1 / present.length;
  return ratios;
}

// ─── Main engine ──────────────────────────────────────────────────────────────

/**
 * Generates deterministic, offline budget suggestions.
 *
 * @param input.income          Gross monthly income in МКД
 * @param input.categories      List of user categories (may include `bucket` / `weight`)
 * @param input.transactions    Optional historical transactions for calibration
 * @returns                     One suggestion per non-income category
 */
export function generateBudgetSuggestion(
  input: SuggestionInput
): BudgetSuggestion[] {
  const { income, categories, transactions = [], referenceDate = new Date() } = input;

  // Guard
  if (income <= 0 || categories.length === 0) return [];

  // ── Step 1: classify & group ───────────────────────────────────────────────
  type EnrichedCat = CategoryWithMeta & {
    _bucket: Bucket;
    _weight: number;
  };

  const enriched: EnrichedCat[] = categories.map((cat) => ({
    ...cat,
    _bucket: classifyBucket(cat),
    _weight: Math.min(5, Math.max(1, cat.weight ?? 1)),
  }));

  const byBucket = new Map<Bucket, EnrichedCat[]>();
  for (const cat of enriched) {
    if (!byBucket.has(cat._bucket)) byBucket.set(cat._bucket, []);
    byBucket.get(cat._bucket)!.push(cat);
  }

  // ── Step 2: effective bucket ratios ───────────────────────────────────────
  const presentBuckets = new Set<Bucket>(byBucket.keys());
  const effectiveRatios = buildEffectiveRatios(presentBuckets);

  // ── Step 3: compute transaction-based calibration data ────────────────────
  const rollingAvg = transactions.length > 0
    ? computeRollingAverages(transactions, referenceDate)
    : new Map<string, number>();

  // ── Step 4: generate suggestions ──────────────────────────────────────────
  const suggestions: BudgetSuggestion[] = [];

  for (const bucket of Object.keys(effectiveRatios) as Bucket[]) {
    const cats = byBucket.get(bucket);
    if (!cats || cats.length === 0) continue;

    const poolRaw = income * effectiveRatios[bucket];

    // Distribute pool by weight
    const totalWeight = cats.reduce((sum, c) => sum + c._weight, 0);

    for (const cat of cats) {
      const ruleBased = poolRaw * (cat._weight / totalWeight);

      // Calibrate if we have rolling average data for this category
      const avg = rollingAvg.get(cat.id);
      let suggested: number;
      let confidence: number;

      if (avg !== undefined && avg > 0) {
        // Blend: 70% rule-based + 30% historical behaviour
        suggested  = ruleBased * 0.7 + avg * 0.3;
        confidence = 0.7;
      } else {
        suggested  = ruleBased;
        confidence = 1.0;
      }

      suggestions.push({
        categoryId:            cat.id,
        suggestedMonthlyLimit: mkd(suggested),
        bucket,
        confidence,
      });
    }
  }

  return suggestions;
}
