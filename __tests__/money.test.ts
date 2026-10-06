import { MAX_AMOUNT_MKD, formatWholeDenars, parseWholeDenars } from "../utils/money";

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
