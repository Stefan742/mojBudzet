import { Category, Transaction, TransactionKind, defaultCategories } from "../models";
import { FILL_AT, buildMemory, categorize, editDistance } from "../services/categorizer/categorize";
import { KEYWORDS, MERCHANTS } from "../services/categorizer/merchants";
import { foldText, merchantKey } from "../services/categorizer/normalize";
import { addDefaultSubcategories } from "../store/migrations";

const noMemory = buildMemory([]);
const suggest = (merchant: string, note = "", categories: Category[] = defaultCategories, memory = noMemory) =>
  categorize(merchant, note, { categories, memory });

let n = 0;
const expense = (merchant: string, categoryId: string, subcategoryId: string | undefined, day: number): Transaction => ({
  id: String(++n),
  kind: TransactionKind.EXPENSE,
  amount: 100,
  date: new Date(2026, 9, day, 12).toISOString(),
  merchant,
  note: "",
  source: "Рачно",
  categoryId,
  subcategoryId,
});

describe("merchantKey: one key for every way of writing a merchant", () => {
  it.each([
    ["Vero", "ВЕРО", "vero 1234 Skopje", "VERO DOOEL"],
    ["Žito", "Жито", "Zhito", "zito market"],
    ["Tinex", "ТИНЕКС", "Tineks"],
    ["McDonald's", "MCDONALDS", "Mcdonalds Skopje"],
    ["Kipper", "Кипер", "kiper"],
  ])("%s", (...spellings) => {
    const keys = spellings.map((s) => merchantKey(s).split(" ")[0]);
    expect(new Set(keys).size).toBe(1);
  });

  it("drops numbers, cities and company forms", () => {
    expect(merchantKey("EVN HOME DOOEL Skopje 123")).toBe("evn home");
    expect(merchantKey("POS 4411 Makpetrol AD Bitola")).toBe("makpetrol");
  });

  it("reads web addresses as the name", () => {
    expect(merchantKey("Booking.com")).toBe(merchantKey("Booking"));
    expect(merchantKey("APPLE.COM/BILL")).toBe(merchantKey("apple.com/bill"));
  });
});

describe("bundled merchant data", () => {
  const subIds = new Set(defaultCategories.flatMap((c) => c.subcategories.map((s) => s.id)));

  it("only uses built-in subcategory ids", () => {
    expect(Object.keys(MERCHANTS).filter((k) => !subIds.has(k))).toEqual([]);
    expect(Object.keys(KEYWORDS).filter((k) => !subIds.has(k))).toEqual([]);
  });

  it.each([
    ["merchant names", MERCHANTS, merchantKey],
    ["keywords", KEYWORDS, foldText],
  ] as const)("never sends one of its %s to two subcategories", (_, data, fold) => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const [sub, names] of Object.entries(data)) {
      for (const name of names) {
        const key = fold(name);
        if (!key) clashes.push(`${name} is empty once folded`);
        const other = seen.get(key);
        if (other && other !== sub) clashes.push(`${name} → ${other} and ${sub}`);
        seen.set(key, sub);
      }
    }
    expect(clashes).toEqual([]);
  });
});

// [merchant, note, expected subcategory, or null when nothing should be filled in]
const EVALUATION: [string, string, string | null][] = [
  // Groceries, Latin, Cyrillic and statement style
  ["Vero", "", "sub-food"], ["VERO 1234 SKOPJE", "", "sub-food"], ["Веро", "", "sub-food"],
  ["Тинекс", "", "sub-food"], ["Tineks", "", "sub-food"], ["Super Tinex Karpos", "", "sub-food"],
  ["Kam Market", "", "sub-food"], ["КАМ МАРКЕТ 45", "", "sub-food"], ["Ramstore Mall", "", "sub-food"],
  ["Рамстор", "", "sub-food"], ["Stokomak", "", "sub-food"], ["Žito Market Veles", "", "sub-food"],
  ["Kipper", "", "sub-food"], ["Elida", "", "sub-food"], ["ALDA DOOEL", "", "sub-food"],
  ["Spar", "", "sub-food"], ["Super Kit-Go", "", "sub-food"], ["Reptil", "", "sub-food"],
  ["Pekara", "", "sub-food"], ["Pekara Zito", "", "sub-food"], ["Пекарата кај Мики", "", "sub-food"],
  ["Mesarnica Ilinden", "", "sub-food"], ["Zelen pazar", "", "sub-food"], ["Market Sonce", "", "sub-food"],
  ["Lidl", "", "sub-food"], ["Kaufland", "", "sub-food"], ["Maxi", "", "sub-food"], ["Konzum", "", "sub-food"],
  ["Fantastico", "", "sub-food"], ["Viva Fresh", "", "sub-food"], ["Big Market Tirana", "", "sub-food"],
  ["Billa", "", "sub-food"], ["Idea", "", "sub-food"], ["Mercator", "", "sub-food"],
  // Bills
  ["EVN", "", "sub-bills"], ["ЕВН", "", "sub-bills"], ["EVN HOME DOOEL", "", "sub-bills"],
  ["Vodovod", "", "sub-bills"], ["Водовод и канализација", "", "sub-bills"], ["BEG", "", "sub-bills"],
  ["Toplifikacija", "", "sub-bills"], ["Makedonski Telekom", "", "sub-bills"], ["A1", "", "sub-bills"],
  ["А1 Македонија", "", "sub-bills"], ["Telekabel", "", "sub-bills"], ["Kirija oktomvri", "", "sub-bills"],
  ["Komunalna higiena", "", "sub-bills"], ["Rata kredit", "", "sub-bills"], ["Upravitel na zgrada", "", "sub-bills"],
  ["Struja", "", "sub-bills"], ["Internet", "", "sub-bills"], ["Eurolink osiguruvanje", "", "sub-bills"],
  ["Infostan", "", "sub-bills"], ["Yettel", "", "sub-bills"],
  // Health
  ["Apteka Zegin", "", "sub-health"], ["Zegin 24", "", "sub-health"], ["Аптека", "", "sub-health"],
  ["Аптеката Здравје", "", "sub-health"], ["Eurofarm", "", "sub-health"], ["Еврофарм", "", "sub-health"],
  ["Gradski Apteki", "", "sub-health"], ["Re-Medika", "", "sub-health"], ["Acibadem Sistina", "", "sub-health"],
  ["Stomatolog", "", "sub-health"], ["Ordinacija dr Petrov", "", "sub-health"], ["Optika", "", "sub-health"],
  ["Laboratorija", "", "sub-health"], ["Benu Apoteka", "", "sub-health"], ["Lekar", "", "sub-health"],
  // Transport and fuel
  ["Makpetrol", "", "sub-transport"], ["MAKPETROL AD BS 45", "", "sub-transport"], ["Лукоил", "", "sub-transport"],
  ["Lukoil", "", "sub-transport"], ["OKTA", "", "sub-transport"], ["Benzinska", "", "sub-transport"],
  ["Gorivo", "", "sub-transport"], ["Taksi", "", "sub-transport"], ["Lotus Taxi", "", "sub-transport"],
  ["JSP", "", "sub-transport"], ["Gradski parking", "", "sub-transport"], ["Parking", "", "sub-transport"],
  ["Patarina", "", "sub-transport"], ["Wizz Air", "", "sub-transport"], ["AMSM", "", "sub-transport"],
  ["Avtoperalna", "", "sub-transport"], ["NIS Petrol", "", "sub-transport"], ["OMV", "", "sub-transport"],
  ["Registracija avtomobil", "", "sub-transport"], ["Bolt", "", "sub-transport"],
  // Shopping
  ["Zara", "", "sub-shopping"], ["Neptun", "", "sub-shopping"], ["Анхоч", "", "sub-shopping"],
  ["Setec", "", "sub-shopping"], ["Tehnomarket", "", "sub-shopping"], ["LC Waikiki", "", "sub-shopping"],
  ["H&M", "", "sub-shopping"], ["Pull&Bear", "", "sub-shopping"], ["DM drogerie", "", "sub-shopping"],
  ["JYSK", "", "sub-shopping"], ["Ikea", "", "sub-shopping"], ["Temu", "", "sub-shopping"],
  ["AliExpress", "", "sub-shopping"], ["Sport Vision", "", "sub-shopping"], ["Deichmann", "", "sub-shopping"],
  ["Skopje City Mall", "", "sub-shopping"], ["Pazar3", "", "sub-shopping"], ["Ananas", "", "sub-shopping"],
  ["Frizerski salon", "", "sub-shopping"], ["Gigatron", "", "sub-shopping"], ["Butik Ana", "", "sub-shopping"],
  ["Knizarnica Literatura", "", "sub-shopping"],
  // Restaurants and cafés
  ["McDonald's", "", "sub-restaurants"], ["Мекдоналдс", "", "sub-restaurants"], ["KFC", "", "sub-restaurants"],
  ["Burger King", "", "sub-restaurants"], ["Kafe bar Skopje", "", "sub-restaurants"], ["Kafeto", "", "sub-restaurants"],
  ["Burek", "", "sub-restaurants"], ["Buregdzilnica", "", "sub-restaurants"], ["Restoran Destan", "", "sub-restaurants"],
  ["Pizzeria Napoli", "", "sub-restaurants"], ["Picerija", "", "sub-restaurants"], ["Wolt", "", "sub-restaurants"],
  ["Korpa", "", "sub-restaurants"], ["Glovo", "", "sub-restaurants"], ["Starbucks", "", "sub-restaurants"],
  ["Skara kaj Toni", "", "sub-restaurants"], ["Slatkarnica", "", "sub-restaurants"], ["Bolt Food", "", "sub-restaurants"],
  ["Kafana Stara", "", "sub-restaurants"],
  // Subscriptions
  ["Netflix", "", "sub-subscriptions"], ["Spotify", "", "sub-subscriptions"], ["APPLE.COM/BILL", "", "sub-subscriptions"],
  ["iCloud", "", "sub-subscriptions"], ["YouTube Premium", "", "sub-subscriptions"], ["HBO Max", "", "sub-subscriptions"],
  ["Disney+", "", "sub-subscriptions"], ["ChatGPT", "", "sub-subscriptions"], ["Google One", "", "sub-subscriptions"],
  ["Max TV", "", "sub-subscriptions"], ["Clenarina", "", "sub-subscriptions"], ["Pretplata", "", "sub-subscriptions"],
  // Entertainment
  ["Cineplexx", "", "sub-entertainment"], ["Синеплекс", "", "sub-entertainment"], ["Kino", "", "sub-entertainment"],
  ["Teatar", "", "sub-entertainment"], ["Koncert", "", "sub-entertainment"], ["Teretana", "", "sub-entertainment"],
  ["Fitnes centar", "", "sub-entertainment"], ["Steam", "", "sub-entertainment"], ["Mozzart", "", "sub-entertainment"],
  ["Sportlife", "", "sub-entertainment"], ["Booking.com", "", "sub-entertainment"], ["Airbnb", "", "sub-entertainment"],
  ["Hotel Metropol Ohrid", "", "sub-entertainment"], ["Bazen", "", "sub-entertainment"], ["Muzej", "", "sub-entertainment"],
  // Investments
  ["Binance", "", "sub-crypto"], ["Coinbase", "", "sub-crypto"], ["Bitcoin", "", "sub-crypto"],
  ["Trading 212", "", "sub-stocks"], ["eToro", "", "sub-stocks"], ["Makedonska berza", "", "sub-stocks"],
  ["Akcii", "", "sub-stocks"], ["ETF", "", "sub-stocks"],
  // Unexpected
  ["Popravka", "", "sub-unexpected"], ["Kazna", "", "sub-unexpected"], ["Vodoinstalater", "", "sub-unexpected"],
  ["Vulkanizer", "", "sub-unexpected"],
  // The note helps when the merchant is unknown
  ["Marko", "rucek so kolegi", "sub-restaurants"], ["Petar", "gorivo za put", "sub-transport"],
  ["Ana", "apteka", "sub-health"],
  // Typos
  ["Makpterol", "", "sub-transport"], ["Stokomka", "", "sub-food"], ["Netflx", "", "sub-subscriptions"],
  ["Cineplex", "", "sub-entertainment"], ["Spotfy", "", "sub-subscriptions"],
  // More of the region and everyday spelling
  ["Ramstore Express", "", "sub-food"], ["Тинекс Аеродром", "", "sub-food"], ["Bingo Tuzla", "", "sub-food"],
  ["Konzum Zagreb", "", "sub-food"], ["Viva Fresh Store", "", "sub-food"], ["Elipso", "", "sub-shopping"],
  ["Mobelix", "", "sub-shopping"], ["Lilly drogerie", "", "sub-shopping"], ["Sopharmacy", "", "sub-health"],
  ["Kastrati", "", "sub-transport"], ["Ryanair", "", "sub-transport"], ["Telenor", "", "sub-bills"],
  ["Picerija Enriko", "", "sub-restaurants"], ["Fibula Travel", "", "sub-entertainment"],
  // Unknown: nothing should be filled in
  ["Revolut", "", null], ["Western Union", "", null], ["Bankomat", "", null], ["Kesh", "", null],
  ["asdf qwerty", "", null], ["Marko Markovski", "", null], ["Uplata", "", null], ["Transfer", "", null],
  ["XYZ 123", "", null], ["Firma", "", null], ["Pozajmica", "", null], ["Dimitrija", "", null],
  ["Nesto", "", null], ["Za Petar", "", null], ["Elena", "", null], ["Ivana Rodendenski", "", null],
];

describe("evaluation set", () => {
  const rows = EVALUATION.map(([merchant, note, expected]) => {
    const { best } = suggest(merchant, note);
    const got = best && best.confidence >= FILL_AT ? best.subcategoryId ?? null : null;
    return { merchant, note, expected, got };
  });
  const labelled = rows.filter((r) => r.expected !== null);
  const unknown = rows.filter((r) => r.expected === null);
  const correct = labelled.filter((r) => r.got === r.expected).length;
  const wrongFills = rows.filter((r) => r.got !== null && r.got !== r.expected);
  const report = rows
    .filter((r) => r.got !== r.expected)
    .map((r) => `${r.merchant}${r.note ? ` (${r.note})` : ""}: expected ${r.expected}, got ${r.got}`)
    .join("\n");

  if (process.env.EVAL_REPORT) console.log(`accuracy ${correct}/${labelled.length}, wrong fills ${wrongFills.length}
${report}`);

  it("has a large enough set", () => {
    expect(rows.length).toBeGreaterThanOrEqual(200);
  });

  it("suggests the right subcategory for known merchants and words", () => {
    // EVAL_REPORT=1 npx jest categorizer prints every miss.
    expect(correct / labelled.length).toBeGreaterThanOrEqual(0.97);
  });

  it("almost never fills in a wrong category", () => {
    expect(wrongFills.map((r) => r.merchant)).toEqual([]);
  });

  it("leaves unknown merchants without a category", () => {
    expect(unknown.filter((r) => r.got !== null).map((r) => `${r.merchant} → ${r.got}`)).toEqual([]);
  });
});

describe("history: the user's own choices", () => {
  it("wins over the bundled merchant list", () => {
    const memory = buildMemory([expense("Vero", "cat-wants", "sub-restaurants", 1)]);
    expect(suggest("VERO 12 Skopje", "", defaultCategories, memory).best).toMatchObject({
      categoryId: "cat-wants", subcategoryId: "sub-restaurants", source: "history",
    });
  });

  it("learns merchants no list knows, including the user's own categories", () => {
    const mine: Category = { id: "c-kids", name: "Деца", colorHex: "#000", iconName: "heart", subcategories: [{ id: "s-school", name: "Училиште", keywords: [] }] };
    const categories = [...defaultCategories, mine];
    const memory = buildMemory([expense("Detska gradinka Sonce", "c-kids", "s-school", 1)]);
    expect(suggest("Detska Gradinka Sonce", "", categories, memory).best).toMatchObject({ categoryId: "c-kids", subcategoryId: "s-school" });
  });

  it("finds a remembered merchant inside a longer name", () => {
    const memory = buildMemory([expense("Pekara Mile", "cat-wants", "sub-restaurants", 1)]);
    expect(suggest("Pekara Mile 2", "", defaultCategories, memory).best?.source).toBe("history");
  });

  it("does not flip a habit for one exception, but follows two changes in a row", () => {
    const habit = [1, 2, 3, 4].map((d) => expense("Zara", "cat-wants", "sub-shopping", d));
    const once = buildMemory([...habit, expense("Zara", "cat-needs", "sub-food", 5)]);
    expect(suggest("Zara", "", defaultCategories, once).best?.subcategoryId).toBe("sub-shopping");
    const twice = buildMemory([...habit, expense("Zara", "cat-needs", "sub-food", 5), expense("Zara", "cat-needs", "sub-food", 6)]);
    expect(suggest("Zara", "", defaultCategories, twice).best?.subcategoryId).toBe("sub-food");
  });

  it("ignores income and uncategorized expenses", () => {
    const income = { ...expense("Firma DOO", "cat-needs", "sub-food", 1), kind: TransactionKind.INCOME };
    const uncategorized = { ...expense("Firma DOO", "cat-needs", undefined, 2), categoryId: undefined };
    expect(buildMemory([income, uncategorized]).size).toBe(0);
  });

  it("falls back to the category when the subcategory was deleted, and to nothing without the category", () => {
    const memory = buildMemory([expense("Vero", "cat-needs", "sub-food", 1)]);
    const noFood = defaultCategories.map((c) => ({ ...c, subcategories: c.subcategories.filter((s) => s.id !== "sub-food") }));
    const best = suggest("Vero", "", noFood, memory).best;
    expect(best?.categoryId).toBe("cat-needs");
    expect(best?.subcategoryId).toBeUndefined();
    const noNeeds = defaultCategories.filter((c) => c.id !== "cat-needs");
    expect(suggest("Vero", "", noNeeds, memory).best).toBeNull();
  });
});

describe("unsure cases", () => {
  it("offers the candidates instead of picking when two keywords tie", () => {
    // "kino" (entertainment) and "kafe" (restaurants) score the same.
    const result = suggest("Kino kafe");
    expect(result.best).toBeNull();
    expect(result.alternatives.map((a) => a.subcategoryId).sort()).toEqual(["sub-entertainment", "sub-restaurants"]);
  });

  it("offers a spelling with two typos as a candidate, not a fill", () => {
    const result = suggest("Makptroll");
    expect(result.best?.subcategoryId ?? result.alternatives[0]?.subcategoryId).toBe("sub-transport");
  });

  it("uses the user's own subcategory keywords", () => {
    const categories = defaultCategories.map((c) =>
      c.id === "cat-wants"
        ? { ...c, subcategories: c.subcategories.map((s) => (s.id === "sub-shopping" ? { ...s, keywords: [...s.keywords, "Ловец"] } : s)) }
        : c
    );
    expect(suggest("Lovec", "", categories).best?.subcategoryId).toBe("sub-shopping");
  });
});

describe("editDistance", () => {
  it("counts a swap of neighbouring letters as one typo", () => {
    expect(editDistance("makpterol", "makpetrol", 2)).toBe(1);
    expect(editDistance("vero", "vero", 1)).toBe(0);
    expect(editDistance("abc", "xyz", 1)).toBe(2);
  });
});

describe("addDefaultSubcategories (store v5)", () => {
  it("adds the new built-in subcategories once and keeps the user's own", () => {
    const old: Category[] = defaultCategories.map((c) => ({
      ...c,
      subcategories: c.subcategories.filter((s) => !["sub-transport", "sub-subscriptions", "sub-entertainment"].includes(s.id)),
    }));
    old[1] = { ...old[1], subcategories: [...old[1].subcategories, { id: "mine", name: "Мое", keywords: [] }] };
    const out = addDefaultSubcategories(old, ["sub-transport", "sub-subscriptions", "sub-entertainment"]);
    expect(out[0].subcategories.map((s) => s.id)).toContain("sub-transport");
    expect(out[1].subcategories.map((s) => s.id)).toEqual(["sub-shopping", "sub-restaurants", "mine", "sub-subscriptions", "sub-entertainment"]);
    // Running again adds nothing.
    expect(addDefaultSubcategories(out, ["sub-transport"])).toEqual(out);
  });
});
