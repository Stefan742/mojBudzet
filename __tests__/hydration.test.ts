import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppStore, retryLoad, startOver, storedDataCopy } from "../store/useAppStore";
import { useSession } from "../store/session";
import { STORE_VERSION } from "../store/migrations";

// Hoisted above the imports by babel-jest.
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const KEY = "budget_state";
const hydrated = () => useAppStore.persist.hasHydrated();
const loadError = () => useSession.getState().loadError;

beforeEach(async () => {
  await AsyncStorage.clear();
  useSession.getState().setLoadError(null);
});

describe("saved data that cannot be opened", () => {
  it("shows the recovery screen instead of loading forever, and keeps the data", async () => {
    await AsyncStorage.setItem(KEY, "{not json");
    await useAppStore.persist.rehydrate();

    expect(hydrated()).toBe(false);
    expect(loadError()).toBeTruthy();
    expect(await AsyncStorage.getItem(KEY)).toBe("{not json");
  });

  it("catches a migration that throws the same way", async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ state: { recurring: [null] }, version: 6 }));
    await useAppStore.persist.rehydrate();

    expect(hydrated()).toBe(false);
    expect(loadError()).toBeTruthy();
  });

  it("a copy holds every entry exactly as stored", async () => {
    await AsyncStorage.setItem(KEY, "{not json");
    await AsyncStorage.setItem(`${KEY}:tx:2026`, "[1]");
    await AsyncStorage.setItem("unrelated", "x");

    const copy = JSON.parse(await storedDataCopy());
    expect(copy.entries).toEqual({ [KEY]: "{not json", [`${KEY}:tx:2026`]: "[1]" });
  });

  it("trying again loads the data once it can be read", async () => {
    await AsyncStorage.setItem(KEY, "{not json");
    await useAppStore.persist.rehydrate();
    expect(loadError()).toBeTruthy();

    await AsyncStorage.setItem(KEY, JSON.stringify({ state: { isOnboarded: true, initialBalance: 777 }, version: STORE_VERSION }));
    await retryLoad();

    expect(hydrated()).toBe(true);
    expect(loadError()).toBeNull();
    expect(useAppStore.getState().initialBalance).toBe(777);
  });

  it("starting over deletes the damaged data and opens a fresh app", async () => {
    await AsyncStorage.setItem(KEY, "{not json");
    await AsyncStorage.setItem(`${KEY}:tx:2026`, "[{broken");
    await useAppStore.persist.rehydrate();

    await startOver();

    expect(hydrated()).toBe(true);
    expect(loadError()).toBeNull();
    expect(useAppStore.getState().isOnboarded).toBe(false);
    expect(await AsyncStorage.getItem(`${KEY}:tx:2026`)).toBeNull();
    expect(await AsyncStorage.getItem(KEY)).not.toBe("{not json");
  });
});
