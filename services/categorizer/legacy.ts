import AsyncStorage from "@react-native-async-storage/async-storage";

/** Storage of the old statistical categorizer, which learned separately from the transactions. */
const LEGACY_KEYS = ["@nb_model_v1", "@nb_model_v2", "@nb_samples_v1", "@nb_pending_v1"];

/** Removes it; harmless when it is already gone. */
export const clearLegacyCategorizerData = (): Promise<void> =>
  AsyncStorage.multiRemove(LEGACY_KEYS).catch(() => undefined);
