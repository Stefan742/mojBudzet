import { incomeForMonth, monthKey, withIncomeFrom } from "../models/Income";

describe("monthKey", () => {
  it("formats local year and month", () => {
    expect(monthKey(new Date(2026, 0, 31))).toBe("2026-01");
    expect(monthKey(new Date(2026, 9, 6))).toBe("2026-10");
  });
});

describe("income schedule", () => {
  const schedule = withIncomeFrom(withIncomeFrom([], "2026-08", 30000), "2026-10", 35000);

  it("is 0 before the first entry", () => {
    expect(incomeForMonth(schedule, "2026-07")).toBe(0);
  });

  it("keeps past months unchanged after a raise", () => {
    expect(incomeForMonth(schedule, "2026-09")).toBe(30000);
    expect(incomeForMonth(schedule, "2026-10")).toBe(35000);
  });

  it("carries the latest amount forward", () => {
    expect(incomeForMonth(schedule, "2027-03")).toBe(35000);
  });

  it("replaces an entry for the same month and stays sorted", () => {
    const edited = withIncomeFrom(withIncomeFrom(schedule, "2026-10", 36000), "2026-05", 20000);
    expect(edited.map((e) => e.effectiveFrom)).toEqual(["2026-05", "2026-08", "2026-10"]);
    expect(incomeForMonth(edited, "2026-10")).toBe(36000);
  });
});
