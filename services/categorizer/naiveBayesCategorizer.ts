/**
 * naiveBayesCategorizer.ts
 *
 * Multinomial Naive Bayes classifier — fully offline, no native deps.
 *
 * HOW IT WORKS (plain English)
 * ─────────────────────────────
 * Training: for every labelled sample ("vero market" → sub-food) we
 *   tokenise the text and count how often each token appears per class.
 *
 * Prediction: given new text we ask "which class makes this text most
 *   probable?". Using Bayes' theorem:
 *     P(class | text) ∝ P(class) × ∏ P(token | class)
 *   We work in log-space to avoid floating-point underflow on mobile.
 *   Laplace smoothing (+1 to every token count) prevents zero-probability
 *   for unseen tokens.
 *
 * Confidence: we turn the log-probability scores into a softmax
 *   distribution and return the top score as confidence (0–1).
 */

import { Category, Subcategory } from "../../models";
import { ModelStore, NaiveBayesModel } from "./storage";

// ─── tokeniser ───────────────────────────────────────────────────────────────

/** Split text into overlapping n-grams (unigrams + bigrams by default). */
function tokenise(text: string): string[] {
  const clean = text.toLowerCase().replace(/[^a-z0-9\u0400-\u04ff ]/g, " ").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const tokens: string[] = [...words];
  for (let i = 0; i < words.length - 1; i++) {
    tokens.push(`${words[i]} ${words[i + 1]}`);
  }
  return tokens;
}

// ─── trainer ─────────────────────────────────────────────────────────────────

export interface TrainingSample {
  text: string;
  /** subcategoryId, e.g. "sub-food" */
  label: string;
}

export function trainModel(samples: TrainingSample[]): NaiveBayesModel {
  const classCounts: Record<string, number> = {};
  /** tokenFreq[label][token] = count */
  const tokenFreq: Record<string, Record<string, number>> = {};
  const vocab = new Set<string>();

  for (const { text, label } of samples) {
    classCounts[label] = (classCounts[label] ?? 0) + 1;
    if (!tokenFreq[label]) tokenFreq[label] = {};

    for (const tok of tokenise(text)) {
      vocab.add(tok);
      tokenFreq[label][tok] = (tokenFreq[label][tok] ?? 0) + 1;
    }
  }

  return {
    classCounts,
    tokenFreq,
    vocab: [...vocab],
    totalSamples: samples.length,
    version: Date.now(),
  };
}

// ─── predictor ───────────────────────────────────────────────────────────────

export interface PredictionResult {
  label: string;
  confidence: number;
  /** raw log-probabilities for debugging */
  scores: Record<string, number>;
}

export function predict(model: NaiveBayesModel, text: string): PredictionResult {
  const tokens = tokenise(text);
  const vocabSize = model.vocab.length;
  const classes = Object.keys(model.classCounts);
  const scores: Record<string, number> = {};

  for (const cls of classes) {
    // prior: log P(class)
    const prior = Math.log(model.classCounts[cls] / model.totalSamples);

    // total tokens seen for this class (denominator for likelihood)
    const clsTotal = Object.values(model.tokenFreq[cls] ?? {}).reduce((a, b) => a + b, 0);

    let likelihood = 0;
    for (const tok of tokens) {
      // Laplace smoothed: (count + 1) / (total + vocab_size)
      const count = (model.tokenFreq[cls]?.[tok] ?? 0) + 1;
      likelihood += Math.log(count / (clsTotal + vocabSize));
    }

    scores[cls] = prior + likelihood;
  }

  // softmax for confidence
  const maxScore = Math.max(...Object.values(scores));
  let sumExp = 0;
  const expScores: Record<string, number> = {};
  for (const cls of classes) {
    expScores[cls] = Math.exp(scores[cls] - maxScore); // numerically stable
    sumExp += expScores[cls];
  }

  const bestLabel = classes.reduce((a, b) => (scores[a] > scores[b] ? a : b));
  const confidence = expScores[bestLabel] / sumExp;

  return { label: bestLabel, scores, confidence };
}

// ─── CategorizationResult mapper ─────────────────────────────────────────────

export interface CategorizationResult {
  categoryId?: string;
  subcategoryId?: string;
  confidence: number;
}

/** Map subcategoryId → parent categoryId using the runtime category tree. */
function findParentCategory(
  subcategoryId: string,
  categories: Category[]
): Category | undefined {
  return categories.find((c) => c.subcategories.some((s) => s.id === subcategoryId));
}

// ─── Main categorizer ─────────────────────────────────────────────────────────

export class NaiveBayesCategorizer {
  private model: NaiveBayesModel | null = null;

  constructor(private readonly store: ModelStore) {}

  /** Load persisted model from storage (call once at app start). */
  async init(): Promise<void> {
    this.model = await this.store.loadModel();
  }

  /** Replace the in-memory model (called after (re)training). */
  setModel(model: NaiveBayesModel): void {
    this.model = model;
  }

  getModel(): NaiveBayesModel | null {
    return this.model;
  }

  /** Categorize a single transaction. Falls back to heuristics if model is absent. */
  async categorize(
    merchant: string,
    note: string,
    categories: Category[]
  ): Promise<CategorizationResult> {
    const text = `${merchant} ${note}`.trim();

    if (!this.model || this.model.totalSamples === 0) {
      return this.keywordFallback(text, categories);
    }

    const { label, confidence } = predict(this.model, text);

    // label should be a subcategoryId like "sub-food"
    const parentCategory = findParentCategory(label, categories);

    if (!parentCategory) {
      // model returned an unknown label — fall back
      return this.keywordFallback(text, categories);
    }

    return {
      categoryId: parentCategory.id,
      subcategoryId: label,
      confidence: Math.min(0.99, confidence),
    };
  }

  // ── simple keyword fallback (same logic as original LocalAICategorizer) ──
  private keywordFallback(text: string, categories: Category[]): CategorizationResult {
    const haystack = text.toLowerCase();
    let best: { cat: Category; sub: Subcategory; score: number } | null = null;

    for (const c of categories) {
      for (const s of c.subcategories) {
        let score = 0;
        for (const kw of s.keywords) {
          const k = kw.toLowerCase();
          if (k && haystack.includes(k)) score += k.length;
        }
        if (score > 0 && (!best || score > best.score)) {
          best = { cat: c, sub: s, score };
        }
      }
    }

    if (best) {
      return {
        categoryId: best.cat.id,
        subcategoryId: best.sub.id,
        confidence: Math.min(0.5, best.score / 10), // cap at 0.5 — less confident than ML
      };
    }

    const needs = categories.find((c) => c.id === "cat-needs");
    return {
      categoryId: needs?.id ?? categories[0]?.id,
      subcategoryId: needs?.subcategories[0]?.id,
      confidence: 0.05,
    };
  }
}