import { monthEnd, monthKey, monthStart, previousMonthKey, shiftMonth } from "../utils/dates";

describe("shiftMonth (B-2)", () => {
  it("goes from 31 October to November, not December", () => {
    expect(monthKey(shiftMonth(new Date(2026, 9, 31), 1))).toBe("2026-11");
  });

  it("goes from 31 March back to February, not March", () => {
    expect(monthKey(shiftMonth(new Date(2026, 2, 31), -1))).toBe("2026-02");
  });

  it("crosses year boundaries", () => {
    expect(monthKey(shiftMonth(new Date(2026, 0, 15), -1))).toBe("2025-12");
    expect(monthKey(shiftMonth(new Date(2026, 11, 31), 1))).toBe("2027-01");
  });
});

describe("month keys", () => {
  it("round-trips through monthStart", () => {
    expect(monthKey(monthStart("2026-03"))).toBe("2026-03");
  });

  it("finds the previous month", () => {
    expect(previousMonthKey("2026-01")).toBe("2025-12");
    expect(previousMonthKey("2026-10")).toBe("2026-09");
  });
});

describe("monthEnd", () => {
  it("is the last second of the month, also in February and December", () => {
    expect(monthEnd("2026-09")).toEqual(new Date(2026, 8, 30, 23, 59, 59));
    expect(monthEnd("2028-02")).toEqual(new Date(2028, 1, 29, 23, 59, 59));
    expect(monthKey(monthEnd("2026-12"))).toBe("2026-12");
  });
});
