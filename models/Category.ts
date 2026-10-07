export interface Subcategory {
  id: string;
  name: string;
  /** i18n key for built-in subcategories; removed when the user renames it. */
  nameKey?: string;
  keywords: string[];
}

/**
 * Bucket taxonomy — controls how the budget engine allocates income.
 * Optional: if omitted, the engine auto-detects from keywords.
 */
export type Bucket = "needs" | "wants" | "savings" | "emergency" | "debt";

export interface Category {
  id: string;
  name: string;
  /** i18n key for built-in categories; removed when the user renames it. */
  nameKey?: string;
  colorHex: string;
  iconName: string;
  subcategories: Subcategory[];
  /**
   * Which budget bucket this category belongs to.
   * If not set, budgetSuggestionEngine auto-detects via keyword matching.
   */
  bucket?: Bucket;
  /**
   * Relative priority within its bucket (1 = lowest, 5 = highest).
   * Used by the engine to distribute the bucket pool.
   * Defaults to 1 if omitted.
   */
  weight?: number;
}

export const defaultCategories: Category[] = [
  {
    id: "cat-needs",
    nameKey: "categories.cat-needs",
    name: "Потреби",
    colorHex: "#34C759",
    iconName: "cart",
    bucket: "needs",
    weight: 5,
    subcategories: [
      {
        id: "sub-food",
        nameKey: "subcategories.sub-food",
        name: "Храна и пијалоци",
        keywords: [
          "маркет", "market", "vero", "tinex", "ramstor",
          "kam", "леб", "млеко", "пекара", "продавница", "prodavnica", "zito", "pepida", "reptil", "tamaro", "jadenje"
        ],
      },
      {
        id: "sub-bills",
        nameKey: "subcategories.sub-bills",
        name: "Сметки",
        keywords: [
          "евн", "вода", "струја", "парно", "интернет",
          "телеком", "a1", "Evn", "voda", "struja", "parno",
        ],
      },
      {
        id: "sub-health",
        nameKey: "subcategories.sub-health",
        name: "Здравје",
        keywords: [
          "аптека", "apteka", "болница", "лекар", "клиника",
          "pregled", "преглед", "zabolekar","zegin", "alkaloid", "zhiva farm", "eurofarm"
        ],
      },
    ],
  },
  {
    id: "cat-wants",
    nameKey: "categories.cat-wants",
    name: "Желби",
    colorHex: "#FF9500",
    iconName: "heart",
    bucket: "wants",
    weight: 3,
    subcategories: [
      {
        id: "sub-shopping",
        nameKey: "subcategories.sub-shopping",
        name: "Шопинг",
        keywords: ["zara", "h&m", "mall", "sinsay", "lc waikiki", "obleka", "tehnologija", "stradivarius",],
      },
      {
        id: "sub-restaurants",
        nameKey: "subcategories.sub-restaurants",
        name: "Ресторани",
        keywords: [
          "restaurant", "pizza", "burger", "kfc", "mcdonald", "cafe", "bar", "jadenje",
        ],
      },
    ],
  },
  {
    id: "cat-investments",
    nameKey: "categories.cat-investments",
    name: "Инвестиции",
    colorHex: "#007AFF",
    iconName: "trending-up",
    bucket: "savings",
    weight: 4,
    subcategories: [
      {
        id: "sub-stocks",
        nameKey: "subcategories.sub-stocks",
        name: "Акции",
        keywords: ["stocks", "etf", "berza", "akcii"],
      },
      {
        id: "sub-crypto",
        nameKey: "subcategories.sub-crypto",
        name: "Крипто",
        keywords: ["crypto", "btc", "bitcoin", "binance"],
      },
    ],
  },
  {
    id: "cat-emergency",
    nameKey: "categories.cat-emergency",
    name: "Итни случаи",
    colorHex: "#FF3B30",
    iconName: "warning",
    bucket: "emergency",
    weight: 2,
    subcategories: [
      {
        id: "sub-unexpected",
        nameKey: "subcategories.sub-unexpected",
        name: "Непредвидени",
        keywords: ["сервис", "поправка", "итно", "kazna"],
      },
    ],
  },
];

/** Display name: the translated built-in name, or the name the user typed. */
export const categoryLabel = (
  c: { name: string; nameKey?: string },
  t: (key: string) => string
): string => (c.nameKey ? t(c.nameKey) : c.name);
