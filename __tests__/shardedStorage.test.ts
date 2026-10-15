import { createShardedStorage, KeyValueStore, readRawEntries } from "../store/shardedStorage";

const memory = () => {
  const data = new Map<string, string>();
  const writes: string[] = [];
  const store: KeyValueStore = {
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      writes.push(k);
      data.set(k, v);
    },
    removeItem: async (k) => {
      data.delete(k);
    },
    getAllKeys: async () => [...data.keys()],
  };
  return { data, writes, store };
};

const tx = (id: string, date: string) => ({ id, date, amount: 1 });
const envelope = (transactions: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ state: { transactions, vaultAmount: 5, ...extra }, version: 2 });

describe("createShardedStorage (D-10, P-5)", () => {
  it("keeps transactions out of the main entry, one entry per year", async () => {
    const { data, store } = memory();
    const storage = createShardedStorage(store);
    await storage.setItem("s", envelope([tx("a", "2026-03-01T10:00:00Z"), tx("b", "2025-12-31T10:00:00Z")]));

    expect(JSON.parse(data.get("s")!).state.transactions).toBeUndefined();
    expect(JSON.parse(data.get("s")!).txYears).toEqual(["2026", "2025"]);
    expect(JSON.parse(data.get("s:tx:2026")!)).toHaveLength(1);
    expect(JSON.parse(data.get("s:tx:2025")!)).toHaveLength(1);
  });

  it("reads back exactly what was saved", async () => {
    const { store } = memory();
    const storage = createShardedStorage(store);
    const saved = envelope([tx("a", "2026-03-01T10:00:00Z"), tx("b", "2026-01-01T10:00:00Z"), tx("c", "2025-06-01T10:00:00Z")]);
    await storage.setItem("s", saved);

    const fresh = createShardedStorage(store);
    expect(JSON.parse((await fresh.getItem("s")) as string)).toEqual(JSON.parse(saved));
  });

  it("only rewrites years that changed", async () => {
    const { writes, store } = memory();
    const storage = createShardedStorage(store);
    const old = tx("old", "2024-05-01T10:00:00Z");
    await storage.setItem("s", envelope([tx("a", "2026-01-01T10:00:00Z"), old]));
    writes.length = 0;

    await storage.setItem("s", envelope([tx("new", "2026-02-01T10:00:00Z"), tx("a", "2026-01-01T10:00:00Z"), old]));
    expect(writes).toEqual(["s:tx:2026", "s"]);
  });

  it("removes years that no longer have transactions", async () => {
    const { data, store } = memory();
    const storage = createShardedStorage(store);
    await storage.setItem("s", envelope([tx("a", "2026-01-01T10:00:00Z"), tx("b", "2024-01-01T10:00:00Z")]));
    await storage.setItem("s", envelope([tx("a", "2026-01-01T10:00:00Z")]));
    expect(data.has("s:tx:2024")).toBe(false);
  });

  it("reads data saved in the old single-entry format", async () => {
    const { data, store } = memory();
    const legacy = envelope([tx("a", "2026-01-01T10:00:00Z")]);
    data.set("s", legacy);
    expect(await createShardedStorage(store).getItem("s")).toBe(legacy);
  });

  it("removeItem deletes the shards too", async () => {
    const { data, store } = memory();
    const storage = createShardedStorage(store);
    await storage.setItem("s", envelope([tx("a", "2026-01-01T10:00:00Z")]));
    await storage.removeItem("s");
    expect(data.size).toBe(0);
  });

  it("removeItem also clears data whose index is damaged, and leaves other keys", async () => {
    const { data, store } = memory();
    data.set("s", "{not json");
    data.set("s:tx:2026", "[]");
    data.set("other", "keep");
    await createShardedStorage(store).removeItem("s");
    expect([...data.keys()]).toEqual(["other"]);
  });

  it("a damaged entry fails loudly instead of loading partial data", async () => {
    const { data, store } = memory();
    const storage = createShardedStorage(store);
    await storage.setItem("s", envelope([tx("a", "2026-01-01T10:00:00Z"), tx("b", "2025-01-01T10:00:00Z")]));
    data.set("s:tx:2025", "[{broken");
    await expect(createShardedStorage(store).getItem("s")).rejects.toThrow();
  });

  it("readRawEntries returns every entry as stored, even unreadable ones", async () => {
    const { data, store } = memory();
    data.set("s", "{not json");
    data.set("s:tx:2026", "[1]");
    data.set("other", "x");
    expect(await readRawEntries(store, "s")).toEqual({ s: "{not json", "s:tx:2026": "[1]" });
  });
});
