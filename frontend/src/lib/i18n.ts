import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { configureApi } from './api'
import ar from '../locales/ar.json'
import en from '../locales/en.json'

export const LANGUAGES = ['en', 'ar'] as const
export type Language = (typeof LANGUAGES)[number]

const STORAGE_KEY = 'lang'

// Storage can throw (private windows, blocked storage); the app must still work without it.
function storedLanguage(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'ar' ? 'ar' : 'en'
  } catch {
    return 'en'
  }
}

/** Language and direction live on <html>, so the whole page (and CSS) follows. */
function applyToDocument(language: string) {
  document.documentElement.lang = language
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ar: { translation: ar } },
  lng: storedLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React escapes already
  initAsync: false, // resources are bundled, so translations are ready immediately
})

applyToDocument(i18n.language)
i18n.on('languageChanged', applyToDocument)
configureApi({ getLanguage: () => i18n.language })

export async function setLanguage(language: Language) {
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // ignore
  }
  await i18n.changeLanguage(language)
}

export default i18n
