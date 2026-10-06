/**
 * Money is whole Macedonian denars, stored as integers. Sums of integers are
 * exact, so no floating-point rounding can creep into totals.
 */

/** Upper bound for a single amount typed by the user, in MKD. */
export const MAX_AMOUNT_MKD = 10_000_000;

/**
 * Parses a whole-denar amount. Accepts digits with optional thousands
 * separators ("25000", "25 000", "25.000", "25,000"). Returns null for
 * anything else, including decimals and negative numbers.
 */
export const parseWholeDenars = (text: string): number | null => {
  const s = text.trim();
  if (!/^(\d+|\d{1,3}([\s.,]\d{3})+)$/.test(s)) return null;
  return Number(s.replace(/[\s.,]/g, ""));
};

/** Formats whole denars with a non-breaking space between thousands: "25 000". */
export const formatWholeDenars = (amount: number): string =>
  String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** "-1 250 МКД". Never shows "-0". */
export const formatMoney = (amount: number, currency: string): string => {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}${formatWholeDenars(Math.abs(rounded))} ${currency}`;
};

export type AmountError = "format" | "positive" | "tooLarge";

/** Validates user input; returns the amount or the reason it is invalid. */
export const validateAmount = (
  text: string,
  { allowZero = false }: { allowZero?: boolean } = {}
): { amount: number } | { error: AmountError } => {
  const amount = parseWholeDenars(text);
  if (amount === null) return { error: "format" };
  if (amount === 0 && !allowZero) return { error: "positive" };
  if (amount > MAX_AMOUNT_MKD) return { error: "tooLarge" };
  return { amount };
};
