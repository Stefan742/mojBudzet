/**
 * training.ts
 *
 * Orchestrates:
 *   1. Seeding the model from the bundled CSV dataset
 *   2. Incremental learning from user corrections
 *   3. Automatic retraining when pending queue reaches threshold
 */

import { trainModel, NaiveBayesCategorizer, TrainingSample } from "./naiveBayesCategorizer";
import { ModelStore } from "./storage";
import { parseDatasetCSV } from "./datasetLoader";

/** Number of pending corrections before auto-retrain triggers. */
const RETRAIN_THRESHOLD = 20;

// ─── TrainingManager ──────────────────────────────────────────────────────────

export class TrainingManager {
  constructor(
    private readonly categorizer: NaiveBayesCategorizer,
    private readonly store: ModelStore
  ) {}

  /**
   * Call once at app startup.
   *
   * Strategy:
   *   1. Try to load a persisted model — fast path, no retraining needed.
   *   2. If no model exists yet, seed from CSV and train.
   */
  async initialise(csvContent: string): Promise<void> {
    // Try loading existing model first
    const existing = await this.store.loadModel();
    if (existing && existing.totalSamples > 0) {
      this.categorizer.setModel(existing);
      console.log(
        `[ML] Loaded persisted model — ${existing.totalSamples} samples, ` +
          `${Object.keys(existing.classCounts).length} classes.`
      );
      return;
    }

    // No model yet — seed from CSV
    await this.seedFromCSV(csvContent);
  }

  /**
   * Parse the bundled CSV, persist the samples, train, and save the model.
   * Safe to call again to reset to baseline (clears prior corrections).
   */
  async seedFromCSV(csvContent: string): Promise<void> {
    const samples = parseDatasetCSV(csvContent);
    if (samples.length === 0) {
      console.warn("[ML] CSV parsed 0 samples — check format.");
      return;
    }

    await this.store.saveAllSamples(samples);
    await this._retrain(samples);
    console.log(`[ML] Seeded model from CSV — ${samples.length} samples.`);
  }

  /**
   * Record a user correction and optionally trigger retraining.
   *
   * @param text      Raw merchant + note string (already combined is fine)
   * @param label     The correct subcategoryId the user selected
   */
  async recordCorrection(text: string, label: string): Promise<void> {
    const sample: TrainingSample = { text, label };

    const pendingCount = await this.store.addPendingSample(sample);
    console.log(`[ML] Correction recorded. Pending: ${pendingCount}/${RETRAIN_THRESHOLD}`);

    if (pendingCount >= RETRAIN_THRESHOLD) {
      await this.retrainFromAllSamples();
    }
  }

  /**
   * Retrain using ALL stored samples (seed CSV + every correction).
   * Called automatically when pending queue overflows, or manually from UI.
   */
  async retrainFromAllSamples(): Promise<void> {
    const pending = await this.store.loadPendingSamples();

    // Merge pending into the main log
    const allSamples = await this.store.appendSamples(pending);
    await this.store.clearPendingSamples();

    await this._retrain(allSamples);
    console.log(`[ML] Retrained on ${allSamples.length} total samples.`);
  }

  /** How many corrections are waiting to be folded in. */
  async pendingCount(): Promise<number> {
    const pending = await this.store.loadPendingSamples();
    return pending.length;
  }

  // ── private ────────────────────────────────────────────────────────────────

  private async _retrain(samples: TrainingSample[]): Promise<void> {
    const model = trainModel(samples);
    this.categorizer.setModel(model);
    await this.store.saveModel(model);
  }
}