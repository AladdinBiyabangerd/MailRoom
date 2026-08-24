import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import az from "./locales/az.json";
import ru from "./locales/ru.json";
import ka from "./locales/ka.json";

export const supportedLanguages = [
  { code: "az", label: "Azərbaycan", flag: "🇦🇿" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "ka", label: "ქართული", flag: "🇬🇪" },
] as const;

export type LanguageCode = (typeof supportedLanguages)[number]["code"];

export const resources = {
  en: { translation: en },
  az: { translation: az },
  ru: { translation: ru },
  ka: { translation: ka },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: ["az", "en", "ru", "ka"],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "sb-admin-lang",
      caches: ["localStorage"],
    },
  });

export default i18n;
