import type { IconName } from "@/components/Icon";

/**
 * Common monthly payments offered during onboarding. Each becomes a
 * repeating transaction in the matching built-in subcategory. Bills whose
 * amount changes every month (electricity, water) start as "amount changes".
 */
export interface BillPreset {
  id: string;
  /** i18n key of the name shown and saved. */
  nameKey: string;
  icon: IconName;
  /** Tile colour (a system colour, also used in dark mode). */
  color: string;
  subcategoryId: string;
  variable: boolean;
  day: number;
}

export const BILL_PRESETS: BillPreset[] = [
  { id: "rent", nameKey: "onboarding.bills.rent", icon: "house", color: "#007AFF", subcategoryId: "sub-bills", variable: false, day: 1 },
  { id: "electricity", nameKey: "onboarding.bills.electricity", icon: "bolt", color: "#FF9500", subcategoryId: "sub-bills", variable: true, day: 15 },
  { id: "water", nameKey: "onboarding.bills.water", icon: "drop", color: "#30B0C7", subcategoryId: "sub-bills", variable: true, day: 15 },
  { id: "internet", nameKey: "onboarding.bills.internet", icon: "wifi", color: "#5856D6", subcategoryId: "sub-bills", variable: false, day: 10 },
  { id: "netflix", nameKey: "onboarding.bills.netflix", icon: "tv", color: "#FF3B30", subcategoryId: "sub-subscriptions", variable: false, day: 1 },
  { id: "spotify", nameKey: "onboarding.bills.spotify", icon: "music", color: "#34C759", subcategoryId: "sub-subscriptions", variable: false, day: 1 },
  { id: "gym", nameKey: "onboarding.bills.gym", icon: "dumbbell", color: "#AF52DE", subcategoryId: "sub-entertainment", variable: false, day: 1 },
  { id: "loan", nameKey: "onboarding.bills.loan", icon: "money", color: "#8E8E93", subcategoryId: "sub-bills", variable: false, day: 5 },
];

/** What the user set for a chosen preset; amounts stay text until saved. */
export interface BillChoice {
  amountText: string;
  day: number;
  variable: boolean;
}
