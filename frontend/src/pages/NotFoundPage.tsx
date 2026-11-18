import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { usePageTitle } from '../hooks/usePageTitle'

export default function NotFoundPage() {
  const { t } = useTranslation()
  usePageTitle('title.notFound')
  return (
    <main className="mx-auto max-w-xl space-y-3 p-6">
      <h1 className="text-2xl font-semibold">{t('notFound.title')}</h1>
      <p>{t('notFound.body')}</p>
      <Link to="/" className="underline">
        {t('notFound.home')}
      </Link>
    </main>
  )
}
