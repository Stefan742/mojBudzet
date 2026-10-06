/**
 * storage.ts
 *
 * AsyncStorage-backed persistence for:
 *   - The trained Naive Bayes model
 *   - The pending (unprocessed) user-correction samples
 *   - The full sample log (for full retraining)
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { TrainingSample } from "./naiveBayesCategorizer";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NaiveBayesModel {
  /** How many times each class (subcategoryId) appeared in training data */
  classCounts: Record<string, number>;
  /** tokenFreq[label][token] = raw count */
  tokenFreq: Record<string, Record<string, number>>;
  /** Full vocabulary list (all unique tokens seen) */
  vocab: string[];
  totalSamples: number;
  /** Unix timestamp of last training — used to detect staleness */
  version: number;
}

// ─── Keys ────────────────────────────────────────────────────────────────────

const KEYS = {
  // v2: retrained after the dataset labels were fixed (B-12).
  model: "@nb_model_v2",
  allSamples: "@nb_samples_v1",
  pendingSamples: "@nb_pending_v1",
} as const;

// ─── ModelStore class ─────────────────────────────────────────────────────────

export class ModelStore {
  // ── Model ──────────────────────────────────────────────────────────────────

  async saveModel(model: NaiveBayesModel): Promise<void> {
    await AsyncStorage.setItem(KEYS.model, JSON.stringify(model));
  }

  async loadModel(): Promise<NaiveBayesModel | null> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.model);
      return raw ? (JSON.parse(raw) as NaiveBayesModel) : null;
    } catch {
      return null;
    }
  }

  // ── All-samples log (seed CSV + every correction ever made) ───────────────

  async loadAllSamples(): Promise<TrainingSample[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.allSamples);
      return raw ? (JSON.parse(raw) as TrainingSample[]) : [];
    } catch {
      return [];
    }
  }

  async saveAllSamples(samples: TrainingSample[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.allSamples, JSON.stringify(samples));
  }

  async appendSamples(newSamples: TrainingSample[]): Promise<TrainingSample[]> {
    const existing = await this.loadAllSamples();
    const merged = [...existing, ...newSamples];
    await this.saveAllSamples(merged);
    return merged;
  }

  // ── Pending samples (corrections not yet used to retrain) ─────────────────

  async loadPendingSamples(): Promise<TrainingSample[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.pendingSamples);
      return raw ? (JSON.parse(raw) as TrainingSample[]) : [];
    } catch {
      return [];
    }
  }

  async savePendingSamples(samples: TrainingSample[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.pendingSamples, JSON.stringify(samples));
  }

  /** Add one correction to pending queue. Returns new pending count. */
  async addPendingSample(sample: TrainingSample): Promise<number> {
    const pending = await this.loadPendingSamples();
    pending.push(sample);
    await this.savePendingSamples(pending);
    return pending.length;
  }

  /** Drain the pending queue (called after retraining). */
  async clearPendingSamples(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.pendingSamples);
  }

  // ── Utility ────────────────────────────────────────────────────────────────

  /** Wipe everything — useful for testing / "reset" button in settings. */
  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([KEYS.model, KEYS.allSamples, KEYS.pendingSamples]);
  }
}