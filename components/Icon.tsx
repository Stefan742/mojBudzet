import React from "react";
import { SymbolView, type SFSymbol, type AndroidSymbol } from "expo-symbols";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ColorValue } from "react-native";

type IonName = keyof typeof Ionicons.glyphMap;
interface Glyph { ios: SFSymbol; android: AndroidSymbol; ion: IonName }

/**
 * App icons by meaning: SF Symbols on iOS, Material Symbols on Android
 * (both via expo-symbols), Ionicons as the web fallback (DESIGN.md §4.3).
 */
export const ICONS = {
  chevronBack:    { ios: "chevron.left",                  android: "chevron_left",           ion: "chevron-back" },
  chevronForward: { ios: "chevron.right",                 android: "chevron_right",          ion: "chevron-forward" },
  chart:          { ios: "chart.pie",                     android: "pie_chart",              ion: "pie-chart-outline" },
  income:         { ios: "arrow.down.circle.fill",        android: "arrow_circle_down",      ion: "arrow-down-circle" },
  expense:        { ios: "arrow.up.circle.fill",          android: "arrow_circle_up",        ion: "arrow-up-circle" },
  vault:          { ios: "lock.fill",                     android: "lock",                   ion: "lock-closed" },
  wallet:         { ios: "wallet.pass",                   android: "account_balance_wallet", ion: "wallet-outline" },
  save:           { ios: "tray.and.arrow.down",           android: "save",                   ion: "save-outline" },
  carryOver:      { ios: "arrow.forward.circle",          android: "arrow_circle_right",     ion: "arrow-forward-circle-outline" },
  check:          { ios: "checkmark",                     android: "check",                  ion: "checkmark" },
  checkCircle:    { ios: "checkmark.circle.fill",         android: "check_circle",           ion: "checkmark-circle" },
  close:          { ios: "xmark",                         android: "close",                  ion: "close" },
  trash:          { ios: "trash",                         android: "delete",                 ion: "trash-outline" },
  search:         { ios: "magnifyingglass",               android: "search",                 ion: "search" },
  list:           { ios: "list.bullet",                   android: "list",                   ion: "list-outline" },
  receipt:        { ios: "receipt",                       android: "receipt",                ion: "receipt-outline" },
  sparkles:       { ios: "sparkles",                      android: "auto_awesome",           ion: "sparkles" },
  plus:           { ios: "plus",                          android: "add",                    ion: "add" },
  plusCircle:     { ios: "plus.circle.fill",              android: "add_circle",             ion: "add-circle" },
  money:          { ios: "banknote",                      android: "payments",               ion: "cash-outline" },
  flag:           { ios: "flag",                          android: "flag",                   ion: "flag-outline" },
  calendar:       { ios: "calendar",                      android: "calendar_today",         ion: "calendar-outline" },
  repeat:         { ios: "repeat",                        android: "repeat",                 ion: "repeat" },
  bell:           { ios: "bell",                          android: "notifications",          ion: "notifications-outline" },
  gear:           { ios: "gearshape",                     android: "settings",               ion: "settings-outline" },
  share:          { ios: "square.and.arrow.up",           android: "share",                  ion: "share-outline" },
  sun:            { ios: "sun.max",                       android: "light_mode",             ion: "sunny-outline" },
  moon:           { ios: "moon",                          android: "dark_mode",              ion: "moon-outline" },
  phone:          { ios: "iphone",                        android: "smartphone",             ion: "phone-portrait-outline" },
  tags:           { ios: "tag",                           android: "sell",                   ion: "pricetags-outline" },
  alert:          { ios: "exclamationmark.circle.fill",   android: "error",                  ion: "alert-circle" },
  warning:        { ios: "exclamationmark.triangle.fill", android: "warning",                ion: "warning" },
  sealCheck:      { ios: "checkmark.seal.fill",           android: "verified",               ion: "checkmark-circle" },
  star:           { ios: "star.fill",                     android: "star",                   ion: "star" },
  transfer:       { ios: "arrow.right.circle.fill",       android: "arrow_circle_right",     ion: "arrow-forward-circle" },
  globe:          { ios: "globe",                         android: "language",               ion: "globe-outline" },
  doc:            { ios: "doc.text",                      android: "description",            ion: "document-text-outline" },
  info:           { ios: "info.circle",                   android: "info",                   ion: "information-circle-outline" },
} satisfies Record<string, Glyph>;

export type IconName = keyof typeof ICONS;

export function GlyphIcon({
  glyph,
  size = 20,
  color,
}: {
  glyph: Glyph;
  size?: number;
  color: ColorValue;
}) {
  return (
    <SymbolView
      name={{ ios: glyph.ios, android: glyph.android }}
      size={size}
      tintColor={color}
      fallback={<Ionicons name={glyph.ion} size={size} color={color} />}
    />
  );
}

export function Icon({ name, size, color }: { name: IconName; size?: number; color: ColorValue }) {
  return <GlyphIcon glyph={ICONS[name]} size={size} color={color} />;
}
