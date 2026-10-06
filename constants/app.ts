import Constants from "expo-constants";

/** Version from app.json, shown in Settings (R-7). */
export const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";

/**
 * Contact address shown in the privacy policy. Must be filled in before
 * submitting to the stores (see RELEASE_CHECKLIST.md).
 */
export const CONTACT_EMAIL = "";
