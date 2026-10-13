import { CURRENCIES, CURRENCY_CODES } from "../constants/currencies";
import { formatAmount, formatMoney, moneyFormat, parseAmount, validateAmount } from "../utils/money";

const NBSP = " ";
const mkd = moneyFormat("MKD", "mk", "МКД");
const eurMk = moneyFormat("EUR", "mk", "€");
const eurEn = moneyFormat("EUR", "en", "€");
const chfEn = moneyFormat("CHF", "en", "CHF");

describe("parseAmount: whole units (MKD, RSD, ALL)", () => {
  it.each([
    ["25000", 25000],
    ["25 000", 25000],
    ["25.000", 25000],
    ["25,000", 25000],
    ["1 250 000", 1250000],
    [`25${NBSP}000`, 25000],
    [" 7 ", 7],
    ["0", 0],
  ])("parses %j", (input, expected) => {
    expect(parseAmount(input, 0)).toBe(expected);
  });

  it.each(["", "abc", "25000,50", "25.5", "-100", "2 50", "25 00", "1,2,3", "1e5"])("rejects %j", (input) => {
    expect(parseAmount(input, 0)).toBeNull();
  });
});

describe("parseAmount: cents (EUR and the others)", () => {
  it.each([
    ["12", 1200],
    ["12,5", 1250],
    ["12.5", 1250],
    ["12,50", 1250],
    ["0,05", 5],
    ["0.29", 29], // 0.29 * 100 is 28.999… in floating point; parsing is exact
    ["5.", 500],
    ["1.234", 123400], // three digits after the separator: thousands
    ["1,234", 123400],
    ["12,505", 1250500],
    ["1.234,56", 123456],
    ["1,234.56", 123456],
    ["1 234,56", 123456],
    [`1${NBSP}234,56`, 123456],
    ["1.234.567,89", 123456789],
  ])("parses %j", (input, expected) => {
    expect(parseAmount(input, 2)).toBe(expected);
  });

  it.each(["", ",5", "1.2.3", "-12,50", "12,5€", "1e3"])("rejects %j", (input) => {
    expect(parseAmount(input, 2)).toBeNull();
  });
});

describe("formatAmount", () => {
  it("groups thousands with a non-breaking space", () => {
    expect(formatAmount(25000, mkd)).toBe(`25${NBSP}000`);
  });

  it("shows cents with the language's decimal separator", () => {
    expect(formatAmount(123456, eurMk)).toBe(`1${NBSP}234,56`);
    expect(formatAmount(123456, eurEn)).toBe(`1${NBSP}234.56`);
    expect(formatAmount(5, eurEn)).toBe("0.05");
  });

  it("can drop zero cents for a prefilled input", () => {
    expect(formatAmount(600000, eurMk, { trimZeroCents: true })).toBe(`6${NBSP}000`);
    expect(formatAmount(600050, eurMk, { trimZeroCents: true })).toBe(`6${NBSP}000,50`);
  });

  it("round-trips through the parser in every currency and language", () => {
    for (const code of CURRENCY_CODES) {
      for (const lang of ["mk", "en"]) {
        const f = moneyFormat(code, lang, code);
        for (const n of [0, 7, 999, 1000, 25050, 1250000, f.max]) {
          expect(parseAmount(formatAmount(n, f), f.decimals)).toBe(n);
        }
      }
    }
  });
});

describe("formatMoney", () => {
  it("puts codes after the number", () => {
    expect(formatMoney(125000, mkd)).toBe(`125${NBSP}000${NBSP}МКД`);
    expect(formatMoney(1250, chfEn)).toBe(`12.50${NBSP}CHF`);
  });

  it("puts symbols first in English and after in Macedonian", () => {
    expect(formatMoney(1250, eurEn)).toBe("€12.50");
    expect(formatMoney(1250, eurMk)).toBe(`12,50${NBSP}€`);
  });

  it("never shows -0 (U-13)", () => {
    expect(formatMoney(-0.4, mkd)).toBe(`0${NBSP}МКД`);
  });

  it("keeps the sign for negative balances, before a symbol", () => {
    expect(formatMoney(-1250, mkd)).toBe(`-1${NBSP}250${NBSP}МКД`);
    expect(formatMoney(-1250, eurEn)).toBe("-€12.50");
  });
});

describe("validateAmount", () => {
  it("accepts a valid amount", () => {
    expect(validateAmount("1 200", mkd)).toEqual({ amount: 1200 });
    expect(validateAmount("4,80", eurMk)).toEqual({ amount: 480 });
  });

  it("explains why an amount is invalid", () => {
    expect(validateAmount("12,5", mkd)).toEqual({ error: "format" });
    expect(validateAmount("0", mkd)).toEqual({ error: "positive" });
    expect(validateAmount("0", mkd, { allowZero: true })).toEqual({ amount: 0 });
    expect(validateAmount("20 000 000", mkd)).toEqual({ error: "tooLarge" });
    expect(validateAmount("2 000 000", eurEn)).toEqual({ error: "tooLarge" });
  });

  it("allows up to the currency's limit", () => {
    expect(validateAmount("10 000 000", mkd)).toEqual({ amount: CURRENCIES.MKD.maxWhole });
    expect(validateAmount("1 000 000", eurEn)).toEqual({ amount: 100_000_000 });
  });
});
