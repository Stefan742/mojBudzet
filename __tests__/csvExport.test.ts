import type { TFunction } from "i18next";
import { Transaction, TransactionKind, defaultCategories } from "../models";
import { buildTransactionsCsv, csvAmount, csvText } from "../services/csvExport";
import { moneyFormat } from "../utils/money";

// Returns the key (and the name for savings), so the CSV's structure is what is tested.
const t = ((key: string, opts?: { name?: string }) => (opts?.name ? `${key}:${opts.name}` : key)) as unknown as TFunction;

let n = 0;
const tx = (kind: TransactionKind, amount: number, day: number, over: Partial<Transaction> = {}): Transaction => ({
  id: String(++n),
  kind,
  amount,
  date: new Date(2026, 9, day, 12).toISOString(),
  merchant: "Vero",
  note: "",
  source: "Рачно",
  ...over,
});

const mkd = moneyFormat("MKD", "mk", "МКД");
const context = { categories: defaultCategories, savingsGoals: [{ id: "g", name: "Odmor", targetAmount: 1, currentAmount: 0, colorHex: "#000" }], currency: mkd, t };

describe("csvText", () => {
  it("leaves plain text alone", () => {
    expect(csvText("Vero")).toBe("Vero");
    expect(csvText("Храна и пијалоци")).toBe("Храна и пијалоци");
  });

  it("quotes separators, quotes and line breaks", () => {
    expect(csvText("Kafe; bar")).toBe('"Kafe; bar"');
    expect(csvText('Bar "Skopje"')).toBe('"Bar ""Skopje"""');
    expect(csvText("line\nbreak")).toBe('"line\nbreak"');
  });

  it("defuses anything a spreadsheet would run as a formula", () => {
    expect(csvText("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvText("+38970123456")).toBe("'+38970123456");
    expect(csvText("-Popust")).toBe("'-Popust");
    expect(csvText("@SUM(A1)")).toBe("'@SUM(A1)");
  });
});

describe("csvAmount", () => {
  it("writes plain signed numbers, with a decimal comma for cents", () => {
    expect(csvAmount(-15000, 0)).toBe("-15000");
    expect(csvAmount(60000, 0)).toBe("60000");
    expect(csvAmount(-1250, 2)).toBe("-12,50");
    expect(csvAmount(5, 2)).toBe("0,05");
  });
});

describe("buildTransactionsCsv", () => {
  const csv = buildTransactionsCsv(
    [
      tx(TransactionKind.EXPENSE, 1250, 3, { categoryId: "cat-needs", subcategoryId: "sub-food", note: "Vikend; pazar" }),
      tx(TransactionKind.INCOME, 60000, 1, { merchant: "", incomeType: "salary", recurringId: "r" }),
      tx(TransactionKind.SAVINGS, 5000, 5, { merchant: "", goalId: "g" }),
    ],
    context
  );
  const lines = csv.split("\r\n");

  it("starts with a byte order mark and uses ; between columns", () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(lines[0].slice(1).split(";")).toEqual([
      "csv.date", "csv.type", "csv.name", "csv.category", "csv.subcategory",
      "csv.incomeSource", "csv.amount", "csv.currency", "csv.note", "csv.repeating",
    ]);
  });

  it("lists every transaction newest first, with signed amounts and labels", () => {
    expect(lines.slice(1, 4)).toEqual([
      "2026-10-05;csv.savings;history.savedToGoal:Odmor;;;;-5000;MKD;;",
      '2026-10-03;csv.expense;Vero;categories.cat-needs;subcategories.sub-food;;-1250;MKD;"Vikend; pazar";',
      "2026-10-01;csv.income;incomeTypes.salary;;;incomeTypes.salary;60000;MKD;;csv.yes",
    ]);
    expect(lines[4]).toBe(""); // ends with a line break
  });
});
