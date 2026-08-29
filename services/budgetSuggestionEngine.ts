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
 *      debt        0 % (absorbed into needs proportionally when present)
 *
 * 3. Within each bucket, distribute its pool among member categories by
 *    weight (default weight = 1, range 1–5).
 *
 * 4. If real transactions are supplied, calibrate the suggestion:
 *      suggestedLimit = 0.7 × rule-based + 0.3 × (3-month rolling average)
 *    This blends the theoretical rule with actual user behaviour.
 *
 * 5. Fallback: if NO category has a recognisable bucket, divide income
 *    equally across all categories (zero-assumption mode).
 *
 * All results are rounded to the nearest integer (МКД has no sub-unit UX).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Category, Transaction, TransactionKind } from "../models";

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
 * Computes the 3-month rolling average monthly spend per category.
 * Only EXPENSE transactions within the last 90 days are considered.
 * Returns a Map<categoryId, averageMonthlySpend>.
 */
function computeRollingAverages(
  transactions: Transaction[],
  referenceDate: Date = new Date()
): Map<string, number> {
  const cutoff = new Date(referenceDate);
  cutoff.setDate(cutoff.getDate() - 90);

  // Accumulate per-month spend per category
  const monthly = new Map<string, Map<string, number>>(); // categoryId → { "YYYY-MM" → total }

  for (const t of transactions) {
    if (t.kind !== TransactionKind.EXPENSE) continue;
    if (!t.categoryId) continue;
    const d = new Date(t.date);
    if (d < cutoff) continue;

    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    if (!monthly.has(t.categoryId)) monthly.set(t.categoryId, new Map());
    const catMap = monthly.get(t.categoryId)!;
    catMap.set(monthKey, (catMap.get(monthKey) ?? 0) + t.amount);
  }

  // Average across months present
  const result = new Map<string, number>();
  for (const [catId, byMonth] of monthly) {
    const total  = [...byMonth.values()].reduce((a, b) => a + b, 0);
    const months = byMonth.size;
    result.set(catId, total / months);
  }

  return result;
}

// ─── Bucket pool redistributor ────────────────────────────────────────────────

/**
 * Redistributes the debt bucket pool proportionally into needs + wants + emergency
 * when debt categories exist, then normalises ratios so they still sum to 1.
 */
function buildEffectiveRatios(
  buckets: Set<Bucket>
): Record<Bucket, number> {
  const ratios = { ...BUCKET_RATIO };

  if (!buckets.has("debt")) {
    // Normalise the remaining 4 buckets so they sum to 1
    const total = Object.values(ratios).reduce((a, b) => a + b, 0);
    for (const b of Object.keys(ratios) as Bucket[]) {
      ratios[b] = ratios[b] / total;
    }
    return ratios;
  }

  // Debt exists → distribute its 0% pool by absorbing from needs/wants/emergency
  // We simply let needs=0.45, wants=0.20, savings=0.15, emergency=0.05, debt=0.15
  return {
    needs:     0.45,
    wants:     0.20,
    savings:   0.15,
    emergency: 0.05,
    debt:      0.15,
  };
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
  const { income, categories, transactions = [] } = input;

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

  // ── Fallback: no bucket matched → divide income equally ──────────────────
  const anyBucketRecognised = (Object.keys(BUCKET_RATIO) as Bucket[]).some(
    (b) => byBucket.has(b)
  );

  if (!anyBucketRecognised) {
    const equal = income / categories.length;
    return categories.map((cat) => ({
      categoryId: cat.id,
      suggestedMonthlyLimit: mkd(equal),
      bucket: "wants" as Bucket,
      confidence: 1,
    }));
  }

  // ── Step 3: compute transaction-based calibration data ────────────────────
  const rollingAvg = transactions.length > 0
    ? computeRollingAverages(transactions)
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

// ─── Convenience: apply suggestions directly to the store ────────────────────

/**
 * Helper that converts engine output into the format expected by
 * `useAppStore.setBudget(categoryId, limit)`.
 *
 * Usage:
 *   const suggestions = generateBudgetSuggestion({ income, categories, transactions });
 *   applySuggestionsToStore(suggestions, setBudget);
 */
export function applySuggestionsToStore(
  suggestions: BudgetSuggestion[],
  setBudget: (categoryId: string, limit: number) => void
): void {
  for (const s of suggestions) {
    if (s.suggestedMonthlyLimit > 0) {
      setBudget(s.categoryId, s.suggestedMonthlyLimit);
    }
  }
}

// ─── Convenience: human-readable summary for debug / UI display ───────────────

/**
 * Returns a plain-text summary of suggestions — useful for a review modal
 * before the user confirms applying them.
 *
 * Example output:
 *   Потреби       → 15 000 МКД  (needs, ⚡ 100%)
 *   Желби         → 7 500 МКД   (wants, ⚡ 70%)
 */
export function formatSuggestions(
  suggestions: BudgetSuggestion[],
  categories: Category[],
  currency: string = "МКД"
): string {
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  return suggestions
    .map((s) => {
      const name       = catMap.get(s.categoryId) ?? s.categoryId;
      const amount     = s.suggestedMonthlyLimit.toLocaleString("mk-MK");
      const pct        = Math.round(s.confidence * 100);
      return `${name.padEnd(20)} → ${amount} ${currency}  (${s.bucket}, ⚡ ${pct}%)`;
    })
    .join("\n");
}