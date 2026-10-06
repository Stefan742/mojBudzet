import React from "react";
import Ionicons from "@expo/vector-icons/Ionicons";

type IconName = keyof typeof Ionicons.glyphMap;

/** Icons offered in the category editor (all valid Ionicons names). */
export const CATEGORY_ICONS: IconName[] = [
  "pricetag", "cart", "heart", "trending-up", "warning", "home", "car",
  "airplane", "restaurant", "bag", "book", "game-controller", "gift",
  "medkit", "flash", "school", "paw", "fitness",
];

export const DEFAULT_CATEGORY_ICON: IconName = "pricetag";

/** The category's chosen icon, or a tag for names that are not Ionicons (e.g. the old "tag"). */
export const categoryIconName = (iconName?: string): IconName =>
  iconName && iconName in Ionicons.glyphMap ? (iconName as IconName) : DEFAULT_CATEGORY_ICON;

export function CategoryIcon({ iconName, size, color }: { iconName?: string; size: number; color: string }) {
  return <Ionicons name={categoryIconName(iconName)} size={size} color={color} />;
}
