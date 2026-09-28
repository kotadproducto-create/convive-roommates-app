import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useLanguage } from '../context/LanguageContext'
import { notificationRoute } from '../lib/notifications'
import { formatMoney } from '../lib/pot'
import DisputeContributionDialog from './DisputeContributionDialog'

// Claves cuyos parámetros incluyen importes en euros: se formatean en el
// idioma de quien ve la notificación (coma o punto decimal), nunca en el
// de quien la generó — a diferencia de `message` (español fijo, ver
// notifyUser en DataContext.jsx), que solo es respaldo/push.
const MONEY_PARAMS_BY_KEY = {
  'notifications.potLow': ['amount', 'perPerson'],
  'notifications.potOnBehalf': ['amount'],
  'notifications.potOnBehalfWithNote': ['amount'],
  'notifications.pollResolvedPotApproved': ['amount']
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Texto final de una notificación, en el idioma de quien la ve. Si trae
 * `messageKey` (notificaciones nuevas, ver notifyUser/removeMember en
 * DataContext.jsx) se arma con `t()`; algunos parámetros son claves de
 * dominio (spaceKey, verbKind, areaKey) que hay que resolver a su propia
 * traducción antes de interpolar. Si no trae `messageKey` (filas viejas)
 * se muestra `message` tal cual quedó grabado.
 */
function notificationText(n, t, language) {
  if (!n.messageKey) return n.message
  const params = { ...(n.messageParams || {}) }

  if (params.spaceKey) params.space = t(`sharedSpaces.spaceRef.${params.spaceKey}`)
  if (params.verbKind) params.verb = t(`notifications.verb${capitalize(params.verbKind)}`)
  if (params.areaKey) params.area = t(`notifications.area${capitalize(params.areaKey)}`)
  for (const field of MONEY_PARAMS_BY_KEY[n.messageKey] || []) {
    if (params[field] != null) params[field] = formatMoney(params[field], language)
  }

  if (n.messageKey === 'notifications.sharedSpaceReminder') {
    const hint = params.hasHint ? t('notifications.sharedSpaceReminderHintSuffix', { hint: t(`sharedSpaces.reminderHint.${params.spaceKey}`) }) : ''
    return t(n.messageKey, params) + hint
  }

  return t(n.messageKey, params)
}

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
  const { t, dateLocale, language } = useLanguage()
  const route = notificationRoute(n.type)
  const [disputing, setDisputing] = useState(false)

  const contribution = n.type === 'pot_on_behalf' && n.refId ? potContributions.find((c) => c.id === n.refId) : null
  const canDispute = !!contribution && contribution.userId === user?.id

  const content = (
    <>
      <p className={n.read ? '' : 'font-semibold'}>{notificationText(n, t, language)}</p>
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
