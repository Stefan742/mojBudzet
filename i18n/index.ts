import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";

import en from "./en.json";
import mk from "./mk.json";

i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: "v4",
    resources: {
      en: { translation: en },
      mk: { translation: mk },
    },
    lng: Localization.getLocales()[0]?.languageCode ?? "mk",
    fallbackLng: "mk",
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;