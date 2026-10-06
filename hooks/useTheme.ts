/**
 * useTheme.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable hook — returns isDark + the full color palette.
 * Import this in any screen instead of hardcoding colors.
 *
 * Usage:
 *   const { isDark, colors } = useTheme();
 *   <View style={{ backgroundColor: colors.background }}>
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useColorScheme } from "react-native";
import { useAppStore } from "../store/useAppStore";

// ─── Color tokens ─────────────────────────────────────────────────────────────

const light = {
  background:      "#f2f2f7",
  card:            "#ffffff",
  cardBorder:      "transparent",
  text:            "#000000",
  textSecondary:   "#666666",
  textTertiary:    "#6e6e73",     // 5:1 on white (was #999, 2.8:1)
  separator:       "#e0e0e0",
  inputBg:         "#f2f2f7",
  accent:          "#007AFF",
  onAccent:        "#ffffff",
  destructive:     "#FF3B30",
  success:         "#34C759",
  successBg:       "#dcfce7",
  successText:     "#15803d",
  warning:         "#FF9500",
  vault:           "#c2410c",     // orange text that passes 4.5:1 on white
  vaultBg:         "#FFF7ED",
  shadow:          "#000000",
  tint:            "#007AFF",
};

const dark = {
  background:      "#000000",
  card:            "#1c1c1e",
  cardBorder:      "#2c2c2e",
  text:            "#ffffff",
  textSecondary:   "#ebebf5cc",   // iOS secondary label dark
  textTertiary:    "#ebebf599",   // 60% (was 38%, too faint on black)
  separator:       "#38383a",
  inputBg:         "#2c2c2e",
  accent:          "#0a84ff",
  onAccent:        "#ffffff",
  destructive:     "#ff453a",
  success:         "#30d158",
  successBg:       "#0f2e1a",
  successText:     "#4ade80",
  warning:         "#ffd60a",
  vault:           "#fb923c",
  vaultBg:         "#3b2410",
  shadow:          "#000000",
  tint:            "#0a84ff",
};

export type AppColors = typeof light;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTheme(): { isDark: boolean; colors: AppColors } {
  const storedTheme   = useAppStore((s) => s.theme);
  const systemScheme  = useColorScheme(); // "light" | "dark" | null

  const isDark =
    storedTheme === "dark"
      ? true
      : storedTheme === "light"
      ? false
      : systemScheme === "dark";   // "system" → follow OS

  return { isDark, colors: isDark ? dark : light };
}