/**
 * Turns whatever the user (or a bank statement) wrote into a comparable key:
 * "ВЕРО 1234 Скопје", "Vero" and "vero centar" all become "vero".
 *
 * Steps: lower case; Cyrillic to Latin; accents removed (č→c, ë→e);
 * punctuation inside a word dropped (McDonald's → mcdonalds); spelling
 * variants folded so Latin and Cyrillic spellings meet (zh/ž→z, sh/š→s,
 * ch/č→c, kj/ќ→k, gj/ѓ→g, lj→l, nj→n, x→ks, w→v, doubled letters once);
 * then numbers, cities and company suffixes removed.
 */

const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ѓ: "gj", е: "e", ж: "zh", з: "z", ѕ: "dz", и: "i",
  ј: "j", к: "k", л: "l", љ: "lj", м: "m", н: "n", њ: "nj", о: "o", п: "p", р: "r", с: "s",
  т: "t", ќ: "kj", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", џ: "dzh", ш: "sh",
  // Serbian, Bulgarian and Russian letters, for regional merchants.
  ђ: "dj", ћ: "c", й: "j", щ: "sht", ъ: "a", ь: "", ю: "ju", я: "ja", ы: "i", э: "e", ё: "e", і: "i", ї: "i", є: "e",
};

/** Latin letters that do not decompose into a base letter plus an accent. */
const LATIN_EXTRA: Record<string, string> = { đ: "dj", ł: "l", ß: "ss", ø: "o", æ: "ae", œ: "oe" };

// Order matters: the longest spellings first.
const FOLDS: [RegExp, string][] = [
  [/dzh/g, "dz"],
  [/zh/g, "z"],
  [/sh/g, "s"],
  [/ch/g, "c"],
  [/kj/g, "k"],
  [/gj/g, "g"],
  [/dj/g, "d"],
  [/lj/g, "l"],
  [/nj/g, "n"],
  [/x/g, "ks"],
  [/w/g, "v"],
  [/q/g, "k"],
  [/([a-z])\1+/g, "$1"],
];

/** Words that say nothing about what was bought. */
const NOISE = [
  // Company forms (MK, regional, international).
  "doo", "dooel", "ad", "akcionersko", "drustvo", "trgovsko", "dpu", "tp", "sp", "ltd", "llc", "inc", "gmbh",
  "sa", "srl", "shpk", "sha", "eood", "ood", "ead", "plc", "co", "company", "kompanija", "grupa", "group",
  // Cities and Skopje municipalities.
  "skopje", "bitola", "kumanovo", "prilep", "tetovo", "ohrid", "veles", "stip", "strumica", "kavadarci",
  "kocani", "gostivar", "struga", "kicevo", "negotino", "radovis", "gevgelija", "debar", "kratovo",
  "delcevo", "berovo", "vinica", "resen", "sveti nikole", "aerodrom", "karpos", "centar", "cair",
  "gazi baba", "butel", "gjorce petrov", "kisela", "saraj", "ilinden", "beograd", "belgrade", "sofija",
  "sofia", "zagreb", "sarajevo", "tirana", "pristina", "prishtina", "novi sad",
  // Card and statement filler.
  "pos", "mk", "mkd", "mt", "www", "http", "https", "com", "plakanje", "kupuvanje", "payment",
  "purchase", "kartica", "card", "transakcija",
];

/** Lower case, transliterated, accent-free, folded text; punctuation becomes spaces. */
export function foldText(text: string): string {
  let s = text.toLowerCase();
  // Web addresses: "booking.com" is Booking, "apple.com/bill" is Apple.
  s = s.replace(/\.(com|net|org|mk|rs|bg|hr|ba|al|me|si|io|co|eu)\b/g, " ");
  s = [...s].map((ch) => CYRILLIC[ch] ?? LATIN_EXTRA[ch] ?? ch).join("");
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Apostrophes, dots and ampersands inside a word join it: mcdonald's, h&m, hi.com.
  s = s.replace(/([a-z0-9])['’.&]+(?=[a-z0-9])/g, "$1");
  s = s.replace(/[^a-z0-9]+/g, " ");
  for (const [pattern, to] of FOLDS) s = s.replace(pattern, to);
  return s.trim();
}

const NOISE_KEYS = new Set(NOISE.map(foldText));
const NOISE_PAIRS = [...NOISE_KEYS].filter((n) => n.includes(" "));

/** The words of `text` that can identify a merchant, folded. */
export function tokens(text: string): string[] {
  let s = ` ${foldText(text)} `;
  for (const pair of NOISE_PAIRS) s = s.split(` ${pair} `).join(" ");
  return s
    .split(" ")
    .filter((w) => w && !/^\d+$/.test(w) && !NOISE_KEYS.has(w));
}

/** The merchant key: "ВЕРО 1234 Скопје" → "vero". */
export const merchantKey = (merchant: string): string => tokens(merchant).join(" ");
