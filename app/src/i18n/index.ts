import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import cs from './locales/cs.json';
import en from './locales/en.json';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      cs: { translation: cs },
      en: { translation: en },
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export default i18n;
