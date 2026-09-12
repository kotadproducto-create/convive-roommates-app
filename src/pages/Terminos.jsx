import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useLanguage } from '../context/LanguageContext'
import { AlertIcon } from '../components/icons'

/**
 * Términos y condiciones — borrador genérico (ver ajustes.js/AboutCard).
 * Marcado explícitamente como borrador: el usuario debe revisarlo y
 * reemplazarlo antes de compartir la app fuera de su grupo de confianza.
 */
export default function Terminos() {
  const { t } = useLanguage()
  const body = t('legal.termsBody')

  return (
    <AppLayout title={t('legal.termsTitle')}>
      <div className="max-w-2xl flex flex-col gap-4">
        <Link to="/ajustes" className="text-sm font-semibold text-violet-500 hover:underline w-fit">
          {t('legal.back')}
        </Link>
        <div className="card p-3.5 flex items-center gap-2.5 border-gold-500/50">
          <AlertIcon className="w-4 h-4 text-gold-500 shrink-0" />
          <p className="text-xs font-medium text-gold-600 dark:text-gold-400">{t('legal.draftNotice')}</p>
        </div>
        <div className="card p-5 flex flex-col gap-3 text-sm text-ink-900/80 dark:text-cream-100/80">
          {Array.isArray(body) &&
            body.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
        </div>
      </div>
    </AppLayout>
  )
}
