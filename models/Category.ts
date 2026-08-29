export interface Subcategory {
  id: string;
  name: string;
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
    name: "Потреби",
    colorHex: "#4CAF50",
    iconName: "cart",
    bucket: "needs",
    weight: 5,
    subcategories: [
      {
        id: "sub-food",
        name: "Храна и пијалоци",
        keywords: [
          "маркет", "market", "vero", "tinex", "ramstor",
          "kam", "леб", "млеко", "пекара", "продавница", "prodavnica", "zito", "pepida", "reptil", "tamaro", "jadenje"
        ],
      },
      {
        id: "sub-bills",
        name: "Сметки",
        keywords: [
          "евн", "вода", "струја", "парно", "интернет",
          "телеком", "a1", "Evn", "voda", "struja", "parno",
        ],
      },
      {
        id: "sub-health",
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
    name: "Желби",
    colorHex: "#FF9800",
    iconName: "heart",
    bucket: "wants",
    weight: 3,
    subcategories: [
      {
        id: "sub-shopping",
        name: "Шопинг",
        keywords: ["zara", "h&m", "mall", "sinsay", "lc waikiki", "obleka", "tehnologija", "stradivarius",],
      },
      {
        id: "sub-restaurants",
        name: "Ресторани",
        keywords: [
          "restaurant", "pizza", "burger", "kfc", "mcdonald", "cafe", "bar", "jadenje",
        ],
      },
    ],
  },
  {
    id: "cat-investments",
    name: "Инвестиции",
    colorHex: "#2196F3",
    iconName: "trending-up",
    bucket: "savings",
    weight: 4,
    subcategories: [
      {
        id: "sub-stocks",
        name: "Акции",
        keywords: ["stocks", "etf", "berza", "akcii"],
      },
      {
        id: "sub-crypto",
        name: "Крипто",
        keywords: ["crypto", "btc", "bitcoin", "binance"],
      },
    ],
  },
  {
    id: "cat-emergency",
    name: "Итни случаи",
    colorHex: "#F44336",
    iconName: "warning",
    bucket: "emergency",
    weight: 2,
    subcategories: [
      {
        id: "sub-unexpected",
        name: "Непредвидени",
        keywords: ["сервис", "поправка", "итно", "kazna"],
      },
    ],
  },
];