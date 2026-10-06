import type { PersistedState } from "../models";
import { STORE_VERSION } from "./migrations";

/** JSON export of everything the app stores, for the user to keep (R-11). */
export const buildExport = (data: PersistedState, now: Date = new Date()): string =>
  JSON.stringify(
    { app: "mojbudzet", storeVersion: STORE_VERSION, exportedAt: now.toISOString(), data },
    null,
    2
  );
