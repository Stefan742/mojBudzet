/**
 * Design tokens (DESIGN.md §3). Screens use these instead of raw numbers:
 * type styles, a 4-pt spacing grid, continuous-corner radii, elevation,
 * spring presets and colour tints. Colours themselves live in useTheme.
 */
import { Platform, StyleSheet, type TextStyle, type ViewStyle } from "react-native";

// ─── Type scale (Apple text styles at the default size) ──────────────────────

const tabular: TextStyle["fontVariant"] = ["tabular-nums"];

export const type = {
  largeTitle:    { fontSize: 34, lineHeight: 41, fontWeight: "700" },
  title1:        { fontSize: 28, lineHeight: 34, fontWeight: "700" },
  title2:        { fontSize: 22, lineHeight: 28, fontWeight: "700" },
  title3:        { fontSize: 20, lineHeight: 25, fontWeight: "600" },
  headline:      { fontSize: 17, lineHeight: 22, fontWeight: "600" },
  body:          { fontSize: 17, lineHeight: 22 },
  callout:       { fontSize: 16, lineHeight: 21 },
  subheadline:   { fontSize: 15, lineHeight: 20 },
  footnote:      { fontSize: 13, lineHeight: 18 },
  sectionHeader: { fontSize: 13, lineHeight: 18, textTransform: "uppercase" },
  caption:       { fontSize: 12, lineHeight: 16 },
  /** The Overview balance only. */
  display:       { fontSize: 40, lineHeight: 46, fontWeight: "700", fontVariant: tabular },
} satisfies Record<string, TextStyle>;

/** Digits of equal width, so amounts do not shift as they change. */
export const money: TextStyle = { fontVariant: tabular };

/** A type style for TextInput: line height clips input text on Android. */
export const inputType = (style: TextStyle): TextStyle => {
  const { lineHeight: _lineHeight, ...rest } = style;
  return rest;
};

// ─── Spacing (4-pt grid) ──────────────────────────────────────────────────────

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40 } as const;

/** Side margin of every screen: titles, sections and lists share one edge. */
export const GUTTER = space[4];
/** Gap between grouped sections. */
export const SECTION_GAP = space[6];
/** Minimum height of a single-line row. */
export const ROW_MIN = 44;

// ─── Radii (continuous "squircle" corners on iOS) ────────────────────────────

export const radius = { xs: 6, sm: 10, md: 12, lg: 16, xl: 24, pill: 999 } as const;

/** Corner style for a radius token: continuous curve on iOS, plain elsewhere. */
export const corners = (r: number): ViewStyle => ({ borderRadius: r, borderCurve: "continuous" });

// ─── Elevation ────────────────────────────────────────────────────────────────

/**
 * flat: content surfaces, separated from the background by colour only.
 * raised: hero cards (balance, chart) in light mode.
 * floating: things above content (toasts, menus); a hairline replaces the
 * shadow in dark mode, where a black shadow is invisible.
 */
export const elevation = {
  flat: (): ViewStyle => ({}),
  raised: (isDark: boolean): ViewStyle =>
    isDark
      ? {}
      : { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  floating: (isDark: boolean): ViewStyle =>
    isDark
      ? { borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.08)" }
      : { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
};

// ─── Motion ───────────────────────────────────────────────────────────────────

/** Spring presets for Animated.spring (DESIGN.md §3.7). */
export const springs = {
  /** Press scale, toggles, chip selection. */
  snappy:   { damping: 22, stiffness: 300, mass: 1 },
  /** Menus, sheets, toasts. */
  standard: { damping: 20, stiffness: 200, mass: 1 },
  /** Content reveals. */
  gentle:   { damping: 18, stiffness: 140, mass: 1 },
} as const;

export type SpringPreset = keyof typeof springs;

/** Fade used instead of motion when Reduce Motion is on. */
export const REDUCED_FADE_MS = 150;
export const FADE_MS = 200;

/** Scale of a pressed button or card. */
export const PRESS_SCALE = 0.97;

// ─── Colour tints ─────────────────────────────────────────────────────────────

const TINT_ALPHA = { subtle: 0.12, soft: 0.18, strong: 0.3 } as const;

/** A colour at a fixed transparency step; replaces ad hoc hex-alpha suffixes. */
export const tint = (hex: string, level: keyof typeof TINT_ALPHA = "soft"): string => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${TINT_ALPHA[level]})`;
};

export const isIOS = Platform.OS === "ios";
