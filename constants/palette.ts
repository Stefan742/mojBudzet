/**
 * Data colours for categories and goals: the iOS system palette, light value
 * first. Saved categories store the light value; dataColor() returns the
 * matching dark variant in dark mode (DESIGN.md §3.1).
 */
export const PALETTE: { light: string; dark: string }[] = [
  { light: "#34C759", dark: "#30D158" }, // green
  { light: "#FF9500", dark: "#FF9F0A" }, // orange
  { light: "#007AFF", dark: "#0A84FF" }, // blue
  { light: "#FF3B30", dark: "#FF453A" }, // red
  { light: "#AF52DE", dark: "#BF5AF2" }, // purple
  { light: "#30B0C7", dark: "#40C8E0" }, // teal
  { light: "#FFCC00", dark: "#FFD60A" }, // yellow
  { light: "#A2845E", dark: "#AC8E68" }, // brown
  { light: "#FF2D55", dark: "#FF375F" }, // pink
];

/** Colours offered in the category and goal editors. */
export const COLOR_PALETTE = PALETTE.map((c) => c.light);

/** The previous Material palette, mapped to its system counterpart (store migration v3). */
export const LEGACY_COLOR_MAP: Record<string, string> = {
  "#4CAF50": "#34C759",
  "#FF9800": "#FF9500",
  "#2196F3": "#007AFF",
  "#F44336": "#FF3B30",
  "#9C27B0": "#AF52DE",
  "#00BCD4": "#30B0C7",
  "#FFC107": "#FFCC00",
  "#795548": "#A2845E",
  "#E91E63": "#FF2D55",
};

const darkByLight = new Map(PALETTE.map((c) => [c.light.toUpperCase(), c.dark]));

/** A stored data colour for the current theme. */
export const dataColor = (hex: string, isDark: boolean): string =>
  isDark ? darkByLight.get(hex.toUpperCase()) ?? hex : hex;
