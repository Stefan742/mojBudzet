import { Category } from "../models";

export interface CategorizationResult {
  categoryId?: string;
  subcategoryId?: string;
  confidence: number;
}

export interface AICategorizer {
  categorize(
    merchant: string,
    note: string,
    categories: Category[]
  ): Promise<CategorizationResult>;
}

// ─── Local (offline) keyword-based categorizer ───────────────

export class LocalAICategorizer implements AICategorizer {
  async categorize(
    merchant: string,
    note: string,
    categories: Category[]
  ): Promise<CategorizationResult> {
    const haystack = `${merchant} ${note}`.toLowerCase();

    let best: {
      category: Category;
      subcategory: (typeof categories)[0]["subcategories"][0];
      score: number;
    } | null = null;

    for (const c of categories) {
      for (const s of c.subcategories) {
        let score = 0;
        for (const kw of s.keywords) {
          const k = kw.toLowerCase();
          if (k && haystack.includes(k)) {
            score += k.length;
          }
        }
        if (score > 0 && (!best || score > best.score)) {
          best = { category: c, subcategory: s, score };
        }
      }
    }

    if (best) {
      return {
        categoryId: best.category.id,
        subcategoryId: best.subcategory.id,
        confidence: Math.min(1.0, best.score / 10),
      };
    }

    // Fallback: first "Потреби" category
    const needs = categories.find((c) => c.name === "Потреби");
    if (needs) {
      return {
        categoryId: needs.id,
        subcategoryId: needs.subcategories[0]?.id,
        confidence: 0.1,
      };
    }

    return {
      categoryId: categories[0]?.id,
      subcategoryId: undefined,
      confidence: 0.05,
    };
  }
}

// ─── Claude API categorizer (swap in when you have a key) ────

export class ClaudeAICategorizer implements AICategorizer {
  private readonly fallback: AICategorizer = new LocalAICategorizer();

  constructor(private readonly apiKey: string) {}

  async categorize(
    merchant: string,
    note: string,
    categories: Category[]
  ): Promise<CategorizationResult> {
    try {
      const categoryList = categories
        .map(
          (c) =>
            `${c.name}: ${c.subcategories.map((s) => s.name).join(", ")}`
        )
        .join("\n");

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 256,
          messages: [
            {
              role: "user",
              content: `Categorize this transaction. Respond ONLY with valid JSON, no explanation.

Merchant: "${merchant}"
Note: "${note}"

Available categories and subcategories:
${categoryList}

Respond with: {"category": "<exact category name>", "subcategory": "<exact subcategory name>"}`,
            },
          ],
        }),
      });

      if (!response.ok) throw new Error("API error");

      const data = await response.json();
      const text = data.content?.[0]?.text ?? "";
      const parsed = JSON.parse(text);

      const matchedCategory = categories.find(
        (c) => c.name === parsed.category
      );
      const matchedSub = matchedCategory?.subcategories.find(
        (s) => s.name === parsed.subcategory
      );

      if (matchedCategory) {
        return {
          categoryId: matchedCategory.id,
          subcategoryId: matchedSub?.id,
          confidence: 0.9,
        };
      }
    } catch {
      // fall through to local
    }

    return this.fallback.categorize(merchant, note, categories);
  }
}