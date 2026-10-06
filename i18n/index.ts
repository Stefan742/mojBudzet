import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";

import en from "./en.json";
import mk from "./mk.json";

const SUPPORTED = ["mk", "en"];
const device = Localization.getLocales()[0]?.languageCode ?? "mk";

// Device language when supported; a saved choice is applied on hydration.
i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: "v4",
    resources: {
      en: { translation: en },
      mk: { translation: mk },
    },
    lng: SUPPORTED.includes(device) ? device : "mk",
    fallbackLng: "mk",
    supportedLngs: SUPPORTED,
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;