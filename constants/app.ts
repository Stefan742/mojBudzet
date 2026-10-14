import Constants from "expo-constants";

/** Version from app.json, shown in Settings (R-7). */
export const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";

/**
 * Contact address shown in the privacy policy (in the app and on the hosted
 * page, https://moj-budzet-privacy.vercel.app/).
 */
export const CONTACT_EMAIL = "stefan742dev@gmail.com";
