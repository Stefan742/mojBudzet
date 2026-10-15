import type { StateStorage } from "zustand/middleware";

/** The subset of AsyncStorage this adapter needs (easy to fake in tests). */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
}

interface Envelope {
  state: Record<string, unknown> & { transactions?: { date: string }[] };
  version?: number;
  /** Years stored in their own entries, newest first. Absent in the old single-entry format. */
  txYears?: string[];
}

const shardKey = (name: string, year: string) => `${name}:tx:${year}`;
/** The index entry and every year shard, found by key (works even when the index is damaged). */
const ownKeys = async (base: KeyValueStore, name: string) =>
  (await base.getAllKeys()).filter((key) => key === name || key.startsWith(`${name}:tx:`));

/**
 * Every saved entry exactly as stored, unparsed: a copy the user can keep
 * when the data can no longer be opened, so nothing is lost by starting over.
 */
export async function readRawEntries(base: KeyValueStore, name: string): Promise<Record<string, string | null>> {
  const keys = await ownKeys(base, name);
  const entries = await Promise.all(keys.map(async (key) => [key, await base.getItem(key)] as const));
  return Object.fromEntries(entries);
}
const yearOf = (iso: string) => (typeof iso === "string" && /^\d{4}/.test(iso) ? iso.slice(0, 4) : "unknown");

/**
 * Persist storage that keeps transactions in one entry per year instead of
 * inside the main state value (D-10): a single AsyncStorage row stays small
 * however long the history grows, and only years whose transactions changed
 * are rewritten (P-5).
 *
 * Shards are written before the index that lists them, so an interrupted
 * write leaves the previous, complete index in place. Data saved in the old
 * single-entry format is read as is and split on the next save.
 */
export function createShardedStorage(base: KeyValueStore): StateStorage {
  // Last value written per shard key, to skip unchanged years.
  const written = new Map<string, string>();

  return {
    async getItem(name) {
      const raw = await base.getItem(name);
      if (raw === null) return null;
      const envelope = JSON.parse(raw) as Envelope;
      if (!envelope.txYears) return raw; // old format: transactions are inline

      const shards = await Promise.all(
        envelope.txYears.map(async (year) => {
          const key = shardKey(name, year);
          const value = await base.getItem(key);
          if (value !== null) written.set(key, value);
          return value ? (JSON.parse(value) as unknown[]) : [];
        })
      );
      const { txYears: _years, ...rest } = envelope;
      return JSON.stringify({ ...rest, state: { ...envelope.state, transactions: shards.flat() } });
    },

    async setItem(name, value) {
      const envelope = JSON.parse(value) as Envelope;
      const transactions = envelope.state.transactions ?? [];

      // Group by year, keeping the order within each year.
      const byYear = new Map<string, unknown[]>();
      for (const t of transactions) {
        const year = yearOf(t.date);
        if (!byYear.has(year)) byYear.set(year, []);
        byYear.get(year)!.push(t);
      }
      const years = [...byYear.keys()].sort().reverse();

      for (const year of years) {
        const key = shardKey(name, year);
        const json = JSON.stringify(byYear.get(year));
        if (written.get(key) === json) continue;
        await base.setItem(key, json);
        written.set(key, json);
      }

      // Read the previous index before overwriting it, to clean up emptied years.
      const previousRaw = await base.getItem(name);
      const previousYears = previousRaw ? ((JSON.parse(previousRaw) as Envelope).txYears ?? []) : [];

      const { transactions: _tx, ...stateWithoutTx } = envelope.state;
      await base.setItem(name, JSON.stringify({ ...envelope, state: stateWithoutTx, txYears: years }));

      for (const year of previousYears.filter((y) => !byYear.has(y))) {
        const key = shardKey(name, year);
        await base.removeItem(key);
        written.delete(key);
      }
    },

    // By key rather than through the index, so starting over also works when
    // the index itself is what could not be read.
    async removeItem(name) {
      // Shards first, the index last.
      const keys = (await ownKeys(base, name)).sort((a, b) => Number(a === name) - Number(b === name));
      for (const key of keys) {
        await base.removeItem(key);
        written.delete(key);
      }
    },
  };
}
