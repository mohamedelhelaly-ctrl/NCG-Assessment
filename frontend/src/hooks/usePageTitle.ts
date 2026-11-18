import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/** Sets the document title in the current language, for example "Products · MedicStore". */
export function usePageTitle(key: string) {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  useEffect(() => {
    document.title = `${t(key)} · ${t('app.name')}`
  }, [t, key, language])
}
