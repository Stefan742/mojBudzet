/**
 * useMLCategorizer.ts
 *
 * React hook that bootstraps the full ML pipeline and exposes:
 *   - categorize(merchant, note, categories)  — same API as LocalAICategorizer
 *   - correct(text, subcategoryId)            — teach the model from a correction
 *   - retrain()                               — manual "retrain now" trigger
 *   - pendingCount                            — how many corrections are queued
 *   - isReady                                 — false while loading from storage
 *
 * Usage:
 *   const { categorize, correct, isReady } = useMLCategorizer();
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { NaiveBayesCategorizer, CategorizationResult } from "./naiveBayesCategorizer";
import { ModelStore } from "./storage";
import { TrainingManager } from "./training";
import { Category } from "../../models";

// ── Inline the CSV string here, or pass it as a prop ──────────────────────────
// Expo: import RAW_CSV from "../assets/market_dataset.csv";
// For now we accept it as a parameter to the hook.

interface UseMLCategorizerOptions {
  /** Raw CSV content of market_dataset.csv */
  datasetCSV: string | { default?: string };
}

interface UseMLCategorizerResult {
  isReady: boolean;
  pendingCount: number;
  categorize: (
    merchant: string,
    note: string,
    categories: Category[]
  ) => Promise<CategorizationResult>;
  /** Call this when the user manually picks a different category. */
  correct: (merchant: string, note: string, subcategoryId: string) => Promise<void>;
  /** Force an immediate retrain with all accumulated corrections. */
  retrain: () => Promise<void>;
}

export function useMLCategorizer({
  datasetCSV,
}: UseMLCategorizerOptions): UseMLCategorizerResult {
  const storeRef = useRef(new ModelStore());
  const categorizerRef = useRef(new NaiveBayesCategorizer(storeRef.current));
  const managerRef = useRef(
    new TrainingManager(categorizerRef.current, storeRef.current)
  );

  const [isReady, setIsReady] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Bootstrap on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Normalize CSV — handle both string and require() object
      const csv = typeof datasetCSV === "string" ? datasetCSV : datasetCSV?.default ?? "";
      
      await managerRef.current.initialise(csv);
      const count = await managerRef.current.pendingCount();
      if (!cancelled) {
        setPendingCount(count);
        setIsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [datasetCSV]);

  const categorize = useCallback(
    (merchant: string, note: string, categories: Category[]) =>
      categorizerRef.current.categorize(merchant, note, categories),
    []
  );

  const correct = useCallback(
    async (merchant: string, note: string, subcategoryId: string) => {
      const text = `${merchant} ${note}`.trim();
      await managerRef.current.recordCorrection(text, subcategoryId);
      const count = await managerRef.current.pendingCount();
      setPendingCount(count);
    },
    []
  );

  const retrain = useCallback(async () => {
    await managerRef.current.retrainFromAllSamples();
    setPendingCount(0);
  }, []);

  return { isReady, pendingCount, categorize, correct, retrain };
}