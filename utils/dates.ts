/** "YYYY-MM" for the local month of `date`. */
export const monthKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

/** First day (local time) of a "YYYY-MM" month. */
export const monthStart = (key: string): Date => {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1);
};

/**
 * Moves by whole months. Always lands on the 1st, so 31 October + 1 is
 * November (not December) and 31 March - 1 is February.
 */
export const shiftMonth = (date: Date, delta: number): Date =>
  new Date(date.getFullYear(), date.getMonth() + delta, 1);

export const previousMonthKey = (key: string): string =>
  monthKey(shiftMonth(monthStart(key), -1));

/** Locale for dates in the app language (not the device language). */
export const dateLocale = (language: string): string =>
  language === "en" ? "en-GB" : "mk-MK";

export const formatDate = (date: Date | string, language: string): string =>
  new Date(date).toLocaleDateString(dateLocale(language), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export const formatMonthWide = (date: Date, language: string): string =>
  date.toLocaleString(dateLocale(language), { month: "long", year: "numeric" });
