import {
  RecurringRule,
  TransactionKind,
  dateKey,
  dayFromKey,
  dueCount,
  firstAfter,
  followingDate,
  isDue,
  monthlyEquivalent,
  plannedMonthlyIncome,
} from "../models";

const rule = (over: Partial<RecurringRule> = {}): RecurringRule => ({
  id: "r",
  kind: TransactionKind.EXPENSE,
  merchant: "Rent",
  amount: 15000,
  variable: false,
  note: "",
  frequency: "monthly",
  day: 1,
  ask: true,
  paused: false,
  nextDate: "2026-10-01",
  ...over,
});

describe("dates of a repeating transaction", () => {
  it("keys days in local time and reads them back at noon", () => {
    expect(dateKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(dayFromKey("2026-01-05")).toEqual(new Date(2026, 0, 5, 12));
  });

  it("moves monthly to the same day next month, across the year end", () => {
    expect(followingDate(rule({ day: 15 }), "2026-10-15")).toBe("2026-11-15");
    expect(followingDate(rule({ day: 15 }), "2026-12-15")).toBe("2027-01-15");
  });

  it("uses the last day of shorter months and goes back to the 31st after", () => {
    const r = rule({ day: 31 });
    expect(followingDate(r, "2026-01-31")).toBe("2026-02-28");
    expect(followingDate(r, "2026-02-28")).toBe("2026-03-31");
    expect(followingDate(r, "2028-01-31")).toBe("2028-02-29"); // leap year
  });

  it("moves yearly to the same day next year, 29 February to 28", () => {
    const r = rule({ frequency: "yearly", day: 29, month: 1 });
    expect(followingDate(r, "2028-02-29")).toBe("2029-02-28");
  });

  it("starts after the current period when a rule is created", () => {
    // Created on the 13th for a bill on the 1st: this month is the transaction just saved.
    expect(firstAfter(rule({ day: 1 }), new Date(2026, 9, 13))).toBe("2026-11-01");
    // Payday on the 25th, set up on the 13th: still to come this month.
    expect(firstAfter(rule({ day: 25 }), new Date(2026, 9, 13))).toBe("2026-10-25");
    // On the day itself the occurrence counts as done.
    expect(firstAfter(rule({ day: 13 }), new Date(2026, 9, 13, 8))).toBe("2026-11-13");
    expect(firstAfter(rule({ frequency: "yearly", day: 1, month: 2 }), new Date(2026, 9, 13))).toBe("2027-03-01");
  });
});

describe("what is due", () => {
  it("is due from its date on, unless paused", () => {
    expect(isDue(rule(), "2026-09-30")).toBe(false);
    expect(isDue(rule(), "2026-10-01")).toBe(true);
    expect(isDue(rule({ paused: true }), "2026-10-05")).toBe(false);
  });

  it("counts every missed occurrence", () => {
    expect(dueCount(rule({ nextDate: "2026-08-01" }), "2026-10-13")).toBe(3);
    expect(dueCount(rule(), "2026-09-30")).toBe(0);
  });
});

describe("planned monthly income", () => {
  it("adds active repeating income, yearly spread over twelve months", () => {
    const rules = [
      rule({ kind: TransactionKind.INCOME, amount: 60000 }),
      rule({ kind: TransactionKind.INCOME, amount: 12000, frequency: "yearly", month: 5 }),
      rule({ kind: TransactionKind.INCOME, amount: 9999, paused: true }),
      rule({ amount: 15000 }),
    ];
    expect(monthlyEquivalent(rules[1])).toBe(1000);
    expect(plannedMonthlyIncome(rules)).toBe(61000);
  });
});
