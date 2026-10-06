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
