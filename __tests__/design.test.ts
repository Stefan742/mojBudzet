import { tint } from "../constants/design";
import { dataColor, LEGACY_COLOR_MAP, PALETTE } from "../constants/palette";

describe("tint", () => {
  it("turns a hex colour into rgba at a fixed step", () => {
    expect(tint("#007AFF", "subtle")).toBe("rgba(0,122,255,0.12)");
    expect(tint("#FF3B30")).toBe("rgba(255,59,48,0.18)");
  });
});

describe("palette", () => {
  it("gives the dark variant of a stored light colour in dark mode", () => {
    expect(dataColor("#34C759", true)).toBe("#30D158");
    expect(dataColor("#34c759", false)).toBe("#34c759");
    expect(dataColor("#123456", true)).toBe("#123456");
  });

  it("maps every legacy colour into the new palette", () => {
    const lights = new Set(PALETTE.map((c) => c.light));
    expect(Object.values(LEGACY_COLOR_MAP).every((hex) => lights.has(hex))).toBe(true);
  });
});
