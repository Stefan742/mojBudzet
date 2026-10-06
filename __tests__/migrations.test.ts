import { dedupeCategoryIds } from "../store/migrations";
import type { Category } from "../models";

const base = { colorHex: "#9C27B0", iconName: "tag", subcategories: [] };
const cat = (id: string, name: string): Category => ({ id, name, ...base });

describe("dedupeCategoryIds", () => {
  it("keeps the first id, re-ids differing duplicates and drops exact clones", () => {
    let n = 0;
    const out = dedupeCategoryIds(
      [cat("food", "Food"), cat("X", "Gym"), cat("X", "Pets"), cat("X", "Gym"), cat("Y", "Solo")],
      () => `new-${++n}`
    );
    expect(out.map((c) => [c.id, c.name])).toEqual([
      ["food", "Food"],
      ["X", "Gym"],
      ["new-1", "Pets"],
      ["Y", "Solo"],
    ]);
  });

  it("leaves clean data untouched", () => {
    const clean = [cat("a", "A"), cat("b", "B")];
    expect(dedupeCategoryIds(clean, () => "unused")).toEqual(clean);
  });
});
