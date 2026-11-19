import { useTranslation } from 'react-i18next'
import { setLanguage } from '../../lib/i18n'
import type { Language } from '../../lib/i18n'

/** Shows the OTHER language's name, written in that language, so its speakers can find it. */
export default function LanguageSwitcher({ className }: { className?: string }) {
  const { t, i18n } = useTranslation()
  const target: Language = i18n.language === 'ar' ? 'en' : 'ar'
  return (
    <button
      type="button"
      lang={target}
      className={className ?? 'btn btn-sm btn-quiet font-semibold max-sm:px-1.5'}
      onClick={() => void setLanguage(target)}
    >
      {t('nav.switchLanguage')}
    </button>
  )
}
