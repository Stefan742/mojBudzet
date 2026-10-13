import { CURRENCIES, type CurrencyCode } from "../constants/currencies";

/**
 * Money is an integer in the app currency's smallest unit used here (see
 * constants/currencies.ts): whole denars for MKD, cents for EUR. Sums of
 * integers are exact, so no floating-point rounding can creep into totals.
 */

const NBSP = "\u00A0";

/** How amounts are read and shown: the app currency in the app language. */
export interface MoneyFormat {
  code: CurrencyCode;
  decimals: 0 | 2;
  /** Shown next to amounts: "МКД", "€", "CHF". */
  label: string;
  /** "€12.50" instead of "12,50 €" (symbols in English). */
  labelFirst: boolean;
  decimalSeparator: "." | ",";
  /** Between thousands: "45.000" in Macedonian, "45,000" in English. */
  groupSeparator: "." | ",";
  /** Largest amount a user may type, in the smallest unit. */
  max: number;
}

export const moneyFormat = (code: CurrencyCode, language: string, label: string): MoneyFormat => {
  const spec = CURRENCIES[code];
  const english = language.startsWith("en");
  return {
    code,
    decimals: spec.decimals,
    label,
    labelFirst: english && spec.symbol,
    decimalSeparator: english ? "." : ",",
    groupSeparator: english ? "," : ".",
    max: spec.maxWhole * 10 ** spec.decimals,
  };
};

/** Thousands separated the local way: "25.000" (mk), "25,000" (en). */
const group = (digits: string, separator: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);

/**
 * The number alone, without sign or label: "25.000", "1.250,50" (mk).
 * `trimZeroCents` drops ",00", for prefilling an input.
 */
export const formatAmount = (
  amount: number,
  f: Pick<MoneyFormat, "decimals" | "decimalSeparator" | "groupSeparator">,
  { trimZeroCents = false }: { trimZeroCents?: boolean } = {}
): string => {
  const value = Math.abs(Math.round(amount));
  if (f.decimals === 0) return group(String(value), f.groupSeparator);
  const unit = 10 ** f.decimals;
  const whole = Math.floor(value / unit);
  const fraction = value % unit;
  if (trimZeroCents && fraction === 0) return group(String(whole), f.groupSeparator);
  return `${group(String(whole), f.groupSeparator)}${f.decimalSeparator}${String(fraction).padStart(f.decimals, "0")}`;
};

/** "-1.250 МКД", "€12.50", "12,50 €". Never shows "-0". */
export const formatMoney = (amount: number, f: MoneyFormat): string => {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  const number = formatAmount(rounded, f);
  return f.labelFirst ? `${sign}${f.label}${number}` : `${sign}${number}${NBSP}${f.label}`;
};

// Whole part: plain digits, or groups of three split by a space, dot or comma.
const WHOLE = /^(\d+|\d{1,3}(?:[\s.,]\d{3})+)$/;
// The same, then optionally a dot or comma and up to two decimals.
const WITH_DECIMALS = /^(\d+|\d{1,3}(?:[\s.,]\d{3})+)(?:[.,](\d{0,2}))?$/;

/**
 * Parses typed text into the smallest unit, without floating point:
 * "25 000" -> 25000; with 2 decimals "12,5" -> 1250 and "1.234,56" -> 123456.
 * A separator followed by three digits is a thousands separator, so "1.234"
 * is 1234. Returns null for anything else, including negative numbers.
 */
export const parseAmount = (text: string, decimals: 0 | 2): number | null => {
  const match = (decimals === 0 ? WHOLE : WITH_DECIMALS).exec(text.trim());
  if (!match) return null;
  const units = Number(match[1].replace(/[\s.,]/g, ""));
  const fraction = decimals === 0 ? 0 : Number((match[2] ?? "").padEnd(decimals, "0"));
  const value = units * 10 ** decimals + fraction;
  return Number.isSafeInteger(value) ? value : null;
};

export type AmountError = "format" | "positive" | "tooLarge";

/** Validates user input; returns the amount or the reason it is invalid. */
export const validateAmount = (
  text: string,
  f: Pick<MoneyFormat, "decimals" | "max">,
  { allowZero = false }: { allowZero?: boolean } = {}
): { amount: number } | { error: AmountError } => {
  const amount = parseAmount(text, f.decimals);
  if (amount === null) return { error: "format" };
  if (amount === 0 && !allowZero) return { error: "positive" };
  if (amount > f.max) return { error: "tooLarge" };
  return { amount };
};
