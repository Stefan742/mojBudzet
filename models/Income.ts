/**
 * Monthly income (salary) is a planning number: it is never credited to the
 * balance. A change applies from its month onward; earlier months keep the
 * amount that was in effect then.
 */
export interface IncomeEntry {
  /** First month this amount applies to, "YYYY-MM". */
  effectiveFrom: string;
  /** Whole MKD. */
  amount: number;
}

export const monthKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

/** Income in effect for `month` ("YYYY-MM"), or 0 if none was set yet. */
export const incomeForMonth = (schedule: IncomeEntry[], month: string): number => {
  let amount = 0;
  for (const e of schedule) {
    if (e.effectiveFrom <= month) amount = e.amount;
  }
  return amount;
};

/** Sets the amount from `month` onward; keeps the schedule sorted by month. */
export const withIncomeFrom = (
  schedule: IncomeEntry[],
  month: string,
  amount: number
): IncomeEntry[] =>
  [...schedule.filter((e) => e.effectiveFrom !== month), { effectiveFrom: month, amount }]
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
