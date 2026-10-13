/**
 * The currencies the app offers. One currency per app: every amount is in it,
 * and nothing is ever converted between currencies.
 *
 * Amounts are stored as integers in the currency's smallest unit used here:
 * whole units when `decimals` is 0, cents when it is 2. MKD, RSD and ALL
 * officially have sub-units that are not used in practice, so they stay whole
 * (and MKD data saved before currencies existed needs no change).
 *
 * Names and the label shown next to amounts come from i18n
 * (currency.name.*, currency.label.*).
 */
export interface CurrencySpec {
  decimals: 0 | 2;
  /** Shown as a symbol (€, $, £) rather than a code; English puts it first. */
  symbol: boolean;
  /** Largest amount a user may type, in whole units (catches typos). */
  maxWhole: number;
}

/** Picker order: home currency, the common ones, then the rest by code. */
export const CURRENCY_CODES = ["MKD", "EUR", "USD", "CHF", "GBP", "ALL", "AUD", "BAM", "CAD", "RSD", "SEK"] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export const DEFAULT_CURRENCY: CurrencyCode = "MKD";

const whole = (maxWhole = 10_000_000): CurrencySpec => ({ decimals: 0, symbol: false, maxWhole });
const cents = (symbol = false): CurrencySpec => ({ decimals: 2, symbol, maxWhole: 1_000_000 });

export const CURRENCIES: Record<CurrencyCode, CurrencySpec> = {
  MKD: whole(),
  EUR: cents(true),
  USD: cents(true),
  CHF: cents(),
  GBP: cents(true),
  ALL: whole(),
  AUD: cents(),
  BAM: cents(),
  CAD: cents(),
  RSD: whole(),
  SEK: cents(),
};

export const isCurrencyCode = (v: unknown): v is CurrencyCode =>
  typeof v === "string" && (CURRENCY_CODES as readonly string[]).includes(v);
