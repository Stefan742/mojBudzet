/**
 * receiptScanner.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Анализа на македонски фискални сметки.
 *
 * Стратегии по приоритет:
 *   1. QR payload    → офлајн извлекување на ИЗНОС
 *   2. Gemini Vision → чита ЕДБ + назив + износ директно од фотото
 *   3. УЈП HTML lookup → официјален назив на продавачот по ЕДБ
 *
 * ЗОШТО ОВАА СТРАТЕГИЈА:
 *   Македонскиот фискален 2D код (DataMatrix/QR) е:
 *       AC<9–10 цифри> AC<9–10 цифри> AC<9–10 цифри> <бинарен потпис>
 *   AC блоковите се идентификатори на фискалниот уред — НЕ се ЕДБ.
 *   ЕДБ (13 цифри, започнува со „4") е испечатен на сметката →
 *   Gemini го чита, УЈП го потврдува со официјален назив.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? "";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export interface ReceiptScanResult {
  merchant?: string;
  amount?: number;
  source?: "ujp" | "gemini" | "parser";
  edb?: string;
}

interface GeminiReceiptData {
  merchant?: string;
  amount?: number;
  edb?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Декодира основни HTML ентитети. */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) =>
      String.fromCharCode(parseInt(h, 16))
    );
}

/**
 * Нормализира и валидира ЕДБ.
 * Прифаќа само точно 13 цифри кои ЗАПОЧНУВААТ СО „4".
 * Ова е критично — Gemini понекогаш враќа погрешни EDB (пр. 0800013537133).
 */
function normalizeEDB(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const digits = String(raw).replace(/\D/g, "");
  // Земи последните 13 цифри ако е подолго (пр. со MK prefix)
  const trimmed = digits.length > 13 ? digits.slice(-13) : digits;
  // Валиден македонски ЕДБ за правни лица МОРА да почнува со '4'
  if (/^4\d{12}$/.test(trimmed)) return trimmed;
  // Ако почнува со 'MK4' и digits се 13+2 = 15 → веќе обработено горе
  // Ако не е валиден, врати undefined — не прави УЈП lookup со погрешен ЕДБ
  console.warn(`[Receipt] EDB "${raw}" → normalized "${trimmed}" → invalid (must start with 4), skipping УЈП`);
  return undefined;
}

/** Само ASCII дел од QR (фрла бинарен потпис). */
function qrToAscii(payload: string): string {
  return payload.replace(/[^\x20-\x7E]/g, " ");
}

/**
 * Fetch со рачен timeout преку AbortController.
 * НЕ го користи AbortSignal.timeout() — тоа не работи на Hermes/React Native.
 */
function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

// ─── УЈП HTML Scraper ─────────────────────────────────────────────────────────

async function fetchUJPMerchant(edb: string): Promise<string | null> {
  try {
    const url =
      `https://www.ujp.gov.mk/mk/prebaruvanje_pravni_lica/prebaruvaj` +
      `?pravno_lice=${encodeURIComponent(edb)}&x=5&y=4`;
    console.log(`[Receipt] УЈП lookup: ${url}`);

    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
          "Accept-Language": "mk,en;q=0.9",
        },
      },
      8000
    );

    if (!response.ok) {
      console.log(`[Receipt] УЈП HTTP ${response.status} for EDB ${edb}`);
      return null;
    }

    const html = await response.text();
    console.log(`[Receipt] УЈП HTML length: ${html.length}`);

    // Метод 1: anchor → /prikazi?edb=... → текстот е називот на фирмата
    const linkRe = /prikazi\?edb=[^"'>]+["'][^>]*>([^<]{2,160})<\/a>/i;
    const linkMatch = html.match(linkRe);
    if (linkMatch?.[1]) {
      const name = decodeHtmlEntities(linkMatch[1]).replace(/\s+/g, " ").trim();
      if (name.length > 2) {
        console.log(`[Receipt] УЈП found: "${name}"`);
        return name;
      }
    }

    // Метод 2: 1 резултат → прв anchor по бројачот
    if (/Пронајден[аи]? е 1|1 даночен/i.test(html)) {
      const idx = html.search(/Пронајден[аи]? е 1|1 даночен/i);
      const snippet = html.slice(idx, idx + 1200);
      const anchorMatch = snippet.match(/<a[^>]*>([^<]{2,160})<\/a>/);
      if (anchorMatch?.[1]) {
        const name = decodeHtmlEntities(anchorMatch[1])
          .replace(/\s+/g, " ")
          .trim();
        if (name.length > 2) {
          console.log(`[Receipt] УЈП found (method2): "${name}"`);
          return name;
        }
      }
    }

    if (/0 даночни|Не е пронајден|нема резултат/i.test(html)) {
      console.log(`[Receipt] УЈП: EDB ${edb} not found`);
    } else {
      console.log(`[Receipt] УЈП: could not parse response`);
    }
    return null;
  } catch (err) {
    console.error(`[Receipt] УЈП error for ${edb}:`, err);
    return null;
  }
}

// ─── Gemini Vision ────────────────────────────────────────────────────────────

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, options);
    if (response.ok) return response;
    if ((response.status === 503 || response.status === 429) && i < retries - 1) {
      await new Promise((res) => setTimeout(res, 1000 * (i + 1)));
      continue;
    }
    throw new Error(`Gemini error: ${response.status}`);
  }
  throw new Error("Gemini: сите обиди неуспешни");
}

async function analyzeWithGemini(
  base64Image: string,
  knownAmount?: number
): Promise<GeminiReceiptData> {
  if (!GEMINI_API_KEY) return {};

  const amountInstruction = knownAmount
    ? `Износот најверојатно е ${knownAmount} МКД (прочитан од QR) — потврди го или корегирај ако е погрешен.`
    : `Пронајди го ВКУПНИОТ износ (ВКУПНО, ЗА ПЛАЌАЊЕ или TOTAL).`;

  const prompt = `Ова е македонска фискална (даночна) сметка.
Извлечи ги следните податоци:
1. merchant — НАЗИВ на продавачот (најкрупниот текст најгоре на сметката).
2. edb — Единствен Даночен Број: ТОЧНО 13 цифри, СЕКОГАШ започнува со цифрата „4".
   На сметката е обележан со „ЕДБ:" или „EDB:". Ако пред бројот стои „МК", изостави го „МК" и врати само 13-те цифри.
   ВАЖНО: ако бројот не започнува со „4" или не е точно 13 цифри, врати null — не погодувај.
3. amount — ${amountInstruction}

Врати САМО валиден JSON, без markdown:
{"merchant": "...", "amount": 0, "edb": "4xxxxxxxxxxx"}
Ако нешто не можеш да го прочиташ, стави null за тоа поле.`;

  const body = {
    contents: [
      {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: { responseMimeType: "application/json", temperature: 0 },
  };

  const response = await fetchWithRetry(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const clean = text.replace(/```json|```/g, "").trim();

  try {
    const result = JSON.parse(clean);
    return {
      merchant:
        typeof result.merchant === "string" &&
        result.merchant.trim().toLowerCase() !== "null"
          ? result.merchant.trim()
          : undefined,
      amount:
        typeof result.amount === "number" && result.amount > 0
          ? result.amount
          : undefined,
      edb: normalizeEDB(
        typeof result.edb === "string" ? result.edb : undefined
      ),
    };
  } catch {
    return {};
  }
}

// ─── QR Payload Parser ────────────────────────────────────────────────────────

function parseQRForAmount(payload: string): number | undefined {
  const ascii = qrToAscii(payload);

  const amMatch = ascii.match(/am=(\d+)/);
  if (amMatch) return parseInt(amMatch[1], 10) / 100;

  try {
    const url = new URL(ascii.trim().split(/\s+/)[0]);
    const raw =
      url.searchParams.get("total") ||
      url.searchParams.get("amount") ||
      url.searchParams.get("iznos") ||
      url.searchParams.get("suma");
    if (raw) {
      const n = parseFloat(raw.replace(",", "."));
      if (!isNaN(n) && n > 0) return n;
    }
  } catch {
    /* не е URL */
  }
  return undefined;
}

function extractEDBFromQR(payload: string): string | undefined {
  const ascii = qrToAscii(payload);
  const firstToken = ascii.trim().split(/\s+/)[0];
  try {
    const url = new URL(firstToken);
    const fromParam = normalizeEDB(
      url.searchParams.get("edb") ||
        url.searchParams.get("EDB") ||
        url.searchParams.get("pravno_lice")
    );
    if (fromParam) return fromParam;
  } catch {
    /* не е URL */
  }
  // Бара блок од точно 13 цифри кои почнуваат со '4'
  const runs = ascii.match(/\d+/g) ?? [];
  return runs.find((r) => r.length === 13 && r.startsWith("4"));
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function analyzeReceiptImage(
  base64Image: string,
  qrPayload?: string
): Promise<ReceiptScanResult> {
  // Step 1: Офлајн QR
  const qrAmount = qrPayload ? parseQRForAmount(qrPayload) : undefined;
  const qrEDB = qrPayload ? extractEDBFromQR(qrPayload) : undefined;
  console.log("[Receipt] QR amount:", qrAmount, "| QR EDB:", qrEDB ?? "—");

  // Step 2: Gemini
  let gemini: GeminiReceiptData = {};
  if (base64Image && GEMINI_API_KEY) {
    console.log("[Receipt] Gemini analyzing photo...");
    try {
      gemini = await analyzeWithGemini(base64Image, qrAmount);
      console.log("[Receipt] Gemini result:", gemini);
    } catch (err) {
      console.error("[Receipt] Gemini error:", err);
    }
  }

  // Step 3: УЈП lookup (само ако EDB е валиден — почнува со '4')
  const edb = gemini.edb ?? qrEDB;
  let ujpMerchant: string | null = null;
  if (edb) {
    console.log("[Receipt] EDB:", edb, "→ УЈП lookup...");
    ujpMerchant = await fetchUJPMerchant(edb);
  }

  const amount = gemini.amount ?? qrAmount;

  // Step 4: Состави резултат
  if (ujpMerchant) {
    console.log("[Receipt] УЈП SUCCESS:", ujpMerchant);
    return { merchant: ujpMerchant, amount, source: "ujp", edb };
  }
  if (gemini.merchant || amount) {
    return { merchant: gemini.merchant, amount, source: "gemini", edb };
  }

  console.log("[Receipt] All methods failed, parser-only fallback");
  return { merchant: undefined, amount: qrAmount, source: "parser" };
}

export async function lookupMerchantByEDB(edb: string): Promise<string | null> {
  const norm = normalizeEDB(edb);
  if (!norm) {
    console.warn("[Receipt] Invalid EDB format:", edb);
    return null;
  }
  return fetchUJPMerchant(norm);
}

export function decodeFiscalQR(rawPayload: string): {
  amount?: number;
  receiptCode?: string;
} {
  const ascii = qrToAscii(rawPayload);
  const acBlocks = [...ascii.matchAll(/AC\d{7,12}/g)].map((m) => m[0]);
  return {
    amount: parseQRForAmount(rawPayload),
    receiptCode: acBlocks.slice(0, 2).join(""),
  };
}