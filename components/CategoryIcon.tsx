import React from "react";
import { GlyphIcon } from "./Icon";
import type { SFSymbol, AndroidSymbol } from "expo-symbols";
import type Ionicons from "@expo/vector-icons/Ionicons";

type IonName = keyof typeof Ionicons.glyphMap;

/**
 * Icons offered in the category editor. Categories store the Ionicons name
 * (saved data keeps working); it maps to an SF Symbol on iOS and a Material
 * Symbol on Android.
 */
const CATEGORY_GLYPHS = {
  "pricetag":        { ios: "tag",                         android: "sell" },
  "cart":            { ios: "cart",                        android: "shopping_cart" },
  "heart":           { ios: "heart",                       android: "favorite" },
  "trending-up":     { ios: "chart.line.uptrend.xyaxis",   android: "trending_up" },
  "warning":         { ios: "exclamationmark.triangle",    android: "warning" },
  "home":            { ios: "house",                       android: "home" },
  "car":             { ios: "car",                         android: "directions_car" },
  "airplane":        { ios: "airplane",                    android: "flight" },
  "restaurant":      { ios: "fork.knife",                  android: "restaurant" },
  "bag":             { ios: "bag",                         android: "shopping_bag" },
  "book":            { ios: "book",                        android: "menu_book" },
  "game-controller": { ios: "gamecontroller",              android: "sports_esports" },
  "gift":            { ios: "gift",                        android: "redeem" },
  "medkit":          { ios: "cross.case",                  android: "medical_services" },
  "flash":           { ios: "bolt",                        android: "bolt" },
  "school":          { ios: "graduationcap",               android: "school" },
  "paw":             { ios: "pawprint",                    android: "pets" },
  "fitness":         { ios: "figure.run",                  android: "fitness_center" },
  "receipt-outline": { ios: "receipt",                     android: "receipt" },
} satisfies Partial<Record<IonName, { ios: SFSymbol; android: AndroidSymbol }>>;

type CategoryIconName = keyof typeof CATEGORY_GLYPHS;

export const CATEGORY_ICONS: CategoryIconName[] = [
  "pricetag", "cart", "heart", "trending-up", "warning", "home", "car",
  "airplane", "restaurant", "bag", "book", "game-controller", "gift",
  "medkit", "flash", "school", "paw", "fitness",
];

export const DEFAULT_CATEGORY_ICON: CategoryIconName = "pricetag";

/** The category's chosen icon, or a tag for names not in the list (e.g. the old "tag"). */
export const categoryIconName = (iconName?: string): CategoryIconName =>
  iconName && iconName in CATEGORY_GLYPHS ? (iconName as CategoryIconName) : DEFAULT_CATEGORY_ICON;

export function CategoryIcon({ iconName, size, color }: { iconName?: string; size: number; color: string }) {
  const name = categoryIconName(iconName);
  return <GlyphIcon glyph={{ ...CATEGORY_GLYPHS[name], ion: name }} size={size} color={color} />;
}
