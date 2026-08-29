/**
 * datasetLoader.ts
 *
 * Parses the bundled market_dataset.csv into TrainingSample[].
 *
 * Expected format (with or without header row):
 *   text,categoryId
 *   vero,sub-food
 *   tinex,sub-food
 *   zegin,sub-health
 *
 * Notes:
 *   - Lines starting with # are treated as comments.
 *   - Extra whitespace is trimmed.
 *   - Blank lines and malformed rows are skipped.
 *   - The "categoryId" column maps directly to our subcategoryId labels.
 */

import { TrainingSample } from "./naiveBayesCategorizer";

export function parseDatasetCSV(csv: string): TrainingSample[] {
  const lines = csv
    .replace(/^\uFEFF/, "") // remove BOM
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const samples: TrainingSample[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("#")) continue;  // ← dodaj ova


    // skip header (first line only)
    if (i === 0 && line.toLowerCase().includes("text") && line.toLowerCase().includes("category")) {
      continue;
    }

    const [text, label] = line.split(",");

    if (!text || !label) continue;

    samples.push({
      text: text.trim().toLowerCase(),
      label: label.trim(),
    });
  }

  return samples;
}

/**
 * Convenience: load the bundled CSV from a require() / import.
 *
 * Usage in your app:
 *   import RAW_CSV from "../assets/market_dataset.csv";
 *   const samples = parseDatasetCSV(RAW_CSV);
 *
 * (Expo supports raw text imports out of the box for .csv/.txt.)
 */
export function loadBundledDataset(rawCsv: string): TrainingSample[] {
  return parseDatasetCSV(rawCsv);
}