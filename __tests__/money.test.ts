import { MAX_AMOUNT_MKD, formatMoney, formatWholeDenars, parseWholeDenars, validateAmount } from "../utils/money";

describe("parseWholeDenars", () => {
  it.each([
    ["25000", 25000],
    ["25 000", 25000],
    ["25.000", 25000],
    ["25,000", 25000],
    ["1 250 000", 1250000],
    ["25 000", 25000],
    [" 7 ", 7],
    ["0", 0],
  ])("parses %j", (input, expected) => {
    expect(parseWholeDenars(input)).toBe(expected);
  });

  it.each(["", "abc", "25000,50", "25.5", "-100", "2 50", "25 00", "1,2,3", "1e5"])(
    "rejects %j",
    (input) => {
      expect(parseWholeDenars(input)).toBeNull();
    }
  );
});

describe("formatWholeDenars", () => {
  it("groups thousands with a non-breaking space", () => {
    expect(formatWholeDenars(25000)).toBe("25 000");
  });

  it("round-trips through the parser", () => {
    for (const n of [0, 7, 999, 1000, 25000, 1250000, MAX_AMOUNT_MKD]) {
      expect(parseWholeDenars(formatWholeDenars(n))).toBe(n);
    }
  });
});

describe("formatMoney", () => {
  it("adds separators and the currency", () => {
    expect(formatMoney(125000, "МКД")).toBe("125 000 МКД");
  });

  it("never shows -0 (U-13)", () => {
    expect(formatMoney(-0.4, "MKD")).toBe("0 MKD");
  });

  it("keeps the sign for negative balances", () => {
    expect(formatMoney(-1250, "MKD")).toBe("-1 250 MKD");
  });
});

describe("validateAmount", () => {
  it("accepts a valid amount", () => {
    expect(validateAmount("1 200")).toEqual({ amount: 1200 });
  });

  it("explains why an amount is invalid", () => {
    expect(validateAmount("12,5")).toEqual({ error: "format" });
    expect(validateAmount("0")).toEqual({ error: "positive" });
    expect(validateAmount("0", { allowZero: true })).toEqual({ amount: 0 });
    expect(validateAmount("20 000 000")).toEqual({ error: "tooLarge" });
  });
});
