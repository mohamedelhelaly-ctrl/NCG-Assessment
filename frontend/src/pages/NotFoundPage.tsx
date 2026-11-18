import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { usePageTitle } from '../hooks/usePageTitle'

export default function NotFoundPage() {
  const { t } = useTranslation()
  usePageTitle('title.notFound')
  return (
    <div className="mx-auto max-w-xl space-y-3 px-4 py-16">
      <h1 className="text-2xl font-semibold">{t('notFound.title')}</h1>
      <p>{t('notFound.body')}</p>
      <Link to="/" className="btn btn-primary">
        {t('notFound.home')}
      </Link>
    </div>
  )
}
