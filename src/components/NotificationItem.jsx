import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useLanguage } from '../context/LanguageContext'
import { notificationRoute } from '../lib/notifications'
import DisputeContributionDialog from './DisputeContributionDialog'

/**
 * Una notificación (Topbar e Inicio). Si su tipo tiene un apartado propio
 * (ver lib/notifications.js), tocarla la marca como leída y lleva a esa
 * pantalla; si no, es solo texto. `onNavigate` deja cerrar el desplegable
 * de donde se tocó.
 *
 * Las de tipo 'pot_on_behalf' (alguien registró un aporte/gasto a tu
 * nombre en el Pote) llevan además, muy discreto y aparte del contenido
 * principal, un "Reportar incidencia" — solo si la notificación es de
 * verdad la tuya (no la copia que recibe tu pareja de habitación, ver
 * notifyUser) y todavía no se reportó. Es un botón normal, no anidado
 * dentro del que navega, para no meter un <button> dentro de otro.
 */
export default function NotificationItem({ notification: n, className = '', onNavigate }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { markNotificationRead, potContributions, disputePotContribution } = useData()
  const { t, dateLocale } = useLanguage()
  const route = notificationRoute(n.type)
  const [disputing, setDisputing] = useState(false)

  const contribution = n.type === 'pot_on_behalf' && n.refId ? potContributions.find((c) => c.id === n.refId) : null
  const canDispute = !!contribution && contribution.userId === user?.id

  const content = (
    <>
      <p className={n.read ? '' : 'font-semibold'}>{n.message}</p>
      <p className="text-xs text-ink-900/40 dark:text-cream-100/40 mt-0.5">
        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: dateLocale })}
      </p>
    </>
  )

  function open() {
    if (!n.read) markNotificationRead(n.id)
    onNavigate?.()
    navigate(route)
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        {route ? (
          <button type="button" onClick={open} className="min-w-0 flex-1 text-left flex items-center gap-2 cursor-pointer">
            <span className="min-w-0 flex-1">{content}</span>
            <span aria-hidden="true" className="shrink-0 text-lg leading-none text-ink-900/30 dark:text-cream-100/30">›</span>
          </button>
        ) : (
          <div className="min-w-0 flex-1">{content}</div>
        )}
      </div>
      {canDispute &&
        (contribution.disputed ? (
          <p className="mt-1 text-[11px] text-ink-900/35 dark:text-cream-100/35">{t('wallet.disputeReportedNote')}</p>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setDisputing(true)
            }}
            className="mt-1 text-[11px] text-ink-900/35 dark:text-cream-100/35 hover:text-clay-500 hover:underline"
          >
            {t('wallet.reportDisputeButton')}
          </button>
        ))}
      {disputing && (
        <DisputeContributionDialog
          contribution={contribution}
          onCancel={() => setDisputing(false)}
          onConfirm={async (reason) => {
            await disputePotContribution(contribution.id, reason)
            setDisputing(false)
          }}
        />
      )}
    </div>
  )
}
