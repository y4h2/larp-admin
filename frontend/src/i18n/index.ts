import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/locales/en.json';
import zh from '@/locales/zh.json';

// Get saved language from localStorage or default to 'en'
const getSavedLanguage = (): string => {
  try {
    const uiState = localStorage.getItem('larp-admin-ui');
    if (uiState) {
      const parsed = JSON.parse(uiState);
      return parsed.state?.language || 'zh';
    }
  } catch {
    // Ignore parsing errors
  }
  return 'zh';
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zh: { translation: zh },
    },
    lng: getSavedLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
