/**
 * useTheme.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Returns isDark + the colour tokens for the app theme (light / dark / system).
 * Values follow the iOS semantic colours (DESIGN.md §3.1), except secondary
 * text, which stays at an accessible contrast.
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
  /** systemGroupedBackground */
  background:      "#F2F2F7",
  /** Grouped cells and cards (secondarySystemGroupedBackground). */
  card:            "#FFFFFF",
  /** Sheets and menus above content. */
  surfaceRaised:   "#FFFFFF",
  cardBorder:      "transparent",
  text:            "#000000",
  /** ~5:1 on white; iOS secondaryLabel (60% grey) is too faint for small text. */
  textSecondary:   "#6C6C70",
  /** Kept accessible: used for dates and metadata. */
  textTertiary:    "#6E6E73",
  /** Placeholders and disabled text only. */
  placeholder:     "rgba(60,60,67,0.30)",
  separator:       "rgba(60,60,67,0.29)",
  /** Input, chip and segment tracks (tertiarySystemFill). */
  fill:            "rgba(118,118,128,0.12)",
  inputBg:         "rgba(118,118,128,0.12)",
  accent:          "#007AFF",
  onAccent:        "#FFFFFF",
  destructive:     "#FF3B30",
  success:         "#34C759",
  successBg:       "rgba(52,199,89,0.15)",
  successText:     "#248A3D",
  warning:         "#FF9500",
  /** Orange text that passes 4.5:1 on white. */
  vault:           "#C93400",
  vaultBg:         "rgba(255,149,0,0.15)",
  scrim:           "rgba(0,0,0,0.35)",
  shadow:          "#000000",
  tint:            "#007AFF",
};

const dark: typeof light = {
  background:      "#000000",
  card:            "#1C1C1E",
  surfaceRaised:   "#2C2C2E",
  cardBorder:      "transparent",
  text:            "#FFFFFF",
  textSecondary:   "rgba(235,235,245,0.70)",
  textTertiary:    "rgba(235,235,245,0.60)",
  placeholder:     "rgba(235,235,245,0.30)",
  separator:       "rgba(84,84,88,0.60)",
  fill:            "rgba(118,118,128,0.24)",
  inputBg:         "rgba(118,118,128,0.24)",
  accent:          "#0A84FF",
  onAccent:        "#FFFFFF",
  destructive:     "#FF453A",
  success:         "#30D158",
  successBg:       "rgba(48,209,88,0.20)",
  successText:     "#30D158",
  warning:         "#FF9F0A",
  vault:           "#FF9F0A",
  vaultBg:         "rgba(255,159,10,0.20)",
  scrim:           "rgba(0,0,0,0.55)",
  shadow:          "#000000",
  tint:            "#0A84FF",
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
