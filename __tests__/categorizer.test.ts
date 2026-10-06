import { MARKET_DATASET_CSV } from "../assets/datasets/market_dataset";
import { parseDatasetCSV } from "../services/categorizer/datasetLoader";
import { relabelSample } from "../services/categorizer/training";
import { defaultCategories } from "../models/Category";

const subIds = new Set(defaultCategories.flatMap((c) => c.subcategories.map((s) => s.id)));

describe("bundled dataset (B-12)", () => {
  it("only uses labels that are real subcategory ids", () => {
    const unknown = parseDatasetCSV(MARKET_DATASET_CSV).filter((s) => !subIds.has(s.label));
    expect(unknown).toEqual([]);
  });
});

describe("relabelSample", () => {
  it("maps old labels to real ids and keeps valid ones", () => {
    expect(relabelSample({ text: "evn", label: "sub-needs" }).label).toBe("sub-bills");
    expect(relabelSample({ text: "neptun", label: "sub-tech" }).label).toBe("sub-shopping");
    expect(relabelSample({ text: "vero", label: "sub-food" }).label).toBe("sub-food");
  });
});
