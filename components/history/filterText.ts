import type { TFunction } from "i18next";
import { Category, categoryLabel, dayFromKey } from "../../models";
import { HistoryFilter, KindFilter, PeriodFilter, UNCATEGORIZED } from "../../services/historyFilter";
import { formatMoney, type MoneyFormat } from "../../utils/money";
import { formatDate, formatMonthWide, monthKey, monthStart, shiftMonth } from "../../utils/dates";

export const KIND_KEYS: Record<KindFilter, string> = {
  all: "historyFilter.all",
  expense: "historyFilter.expenses",
  income: "historyFilter.income",
  savings: "historyFilter.savings",
};

export const PERIOD_KEYS: Record<PeriodFilter, string> = {
  all: "historyFilter.allTime",
  thisMonth: "historyFilter.thisMonth",
  lastMonth: "historyFilter.lastMonth",
  last3Months: "historyFilter.last3Months",
  thisYear: "historyFilter.thisYear",
  custom: "historyFilter.custom",
};

/** "Food and drinks", "Uncategorized", "Salary", or undefined. */
export function categoryFilterLabel(f: HistoryFilter, categories: Category[], t: TFunction): string | undefined {
  if (f.incomeType) return t(`incomeTypes.${f.incomeType}`);
  if (f.categoryId === UNCATEGORIZED) return t("overview.uncategorized");
  const cat = categories.find((c) => c.id === f.categoryId);
  if (!cat) return undefined;
  const sub = cat.subcategories.find((s) => s.id === f.subcategoryId);
  return sub ? categoryLabel(sub, t) : categoryLabel(cat, t);
}

/** "September 2026" for single months, "2026", "Last 3 months", or "1 Sep – 15 Oct". */
export function periodFilterLabel(f: HistoryFilter, today: Date, language: string, t: TFunction): string | undefined {
  const thisMonth = monthKey(today);
  switch (f.period) {
    case "thisMonth":
      return formatMonthWide(monthStart(thisMonth), language);
    case "lastMonth":
      return formatMonthWide(shiftMonth(monthStart(thisMonth), -1), language);
    case "thisYear":
      return String(today.getFullYear());
    case "last3Months":
      return t(PERIOD_KEYS.last3Months);
    case "custom": {
      const end = (key?: string) => (key ? formatDate(dayFromKey(key), language) : "…");
      return `${end(f.from)} – ${end(f.to)}`;
    }
    default:
      return undefined;
  }
}

/** "1.000 – 5.000 MKD", "From 1.000 MKD", "Up to 5.000 MKD", or undefined. */
export function amountFilterLabel(f: HistoryFilter, currency: MoneyFormat, t: TFunction): string | undefined {
  const { minAmount: min, maxAmount: max } = f;
  if (min !== undefined && max !== undefined) return `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`;
  if (min !== undefined) return t("historyFilter.atLeast", { amount: formatMoney(min, currency) });
  if (max !== undefined) return t("historyFilter.atMost", { amount: formatMoney(max, currency) });
  return undefined;
}

export type FilterPart = "kind" | "category" | "period" | "amount";

/** The active filters as removable chips, and the filter without each one. */
export function activeFilterChips(
  f: HistoryFilter,
  labels: { kind?: string; category?: string; period?: string; amount?: string }
): { part: FilterPart; label: string; without: HistoryFilter }[] {
  const chips: { part: FilterPart; label: string; without: HistoryFilter }[] = [];
  if (f.kind !== "all" && labels.kind) chips.push({ part: "kind", label: labels.kind, without: { ...f, kind: "all" } });
  if (labels.category) {
    chips.push({ part: "category", label: labels.category, without: { ...f, categoryId: undefined, subcategoryId: undefined, incomeType: undefined } });
  }
  if (labels.period) chips.push({ part: "period", label: labels.period, without: { ...f, period: "all", from: undefined, to: undefined } });
  if (labels.amount) chips.push({ part: "amount", label: labels.amount, without: { ...f, minAmount: undefined, maxAmount: undefined } });
  return chips;
}
