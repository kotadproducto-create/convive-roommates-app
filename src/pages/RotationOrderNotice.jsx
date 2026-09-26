import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import Reveal from '../components/Reveal'
import MarqueeText from '../components/MarqueeText'
import { VirtualTag } from '../components/VirtualMembers'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { useLanguage } from '../context/LanguageContext'
import { buildFloorTurnsPreview } from '../lib/publicTurns'
import { SunIcon } from '../components/icons'

/**
 * Se llega aquí al abrir la notificación "un admin actualizó el orden de
 * rotación" (ver updateRotationOrderDirect en DataContext.jsx): el cambio ya
 * se aplicó, esto es solo una previsualización clara + "Estoy de acuerdo"
 * (acción principal, no hace falta votar nada). Quien prefiera otro orden
 * puede tocar el enlace secundario, que lleva a Tu piso con el formulario de
 * propuesta ya abierto — esa alternativa sí pasa por la votación de siempre.
 * Siempre muestra el orden ACTUAL del piso (no una foto vieja del momento del
 * aviso), así que sigue siendo correcta aunque se reabra un aviso antiguo o
 * el orden haya vuelto a cambiar desde entonces.
 */
export default function RotationOrderNotice() {
  const navigate = useNavigate()
  const { floor, members, activities, activityCompletions, awayUserIds } = useData()
  const { showToast } = useToast()
  const { t } = useLanguage()

  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members])
  const preview = useMemo(
    () => buildFloorTurnsPreview(floor, members, awayUserIds, activities, activityCompletions),
    [floor, members, awayUserIds, activities, activityCompletions]
  )
  const order = floor?.rotationOrder || []

  function handleAgree() {
    showToast(t('rotationNotice.agreedToast'), 'success')
    navigate('/')
  }

  function handleSuggest() {
    navigate('/piso', { state: { openProposeOrder: true } })
  }

  return (
    <AppLayout title={t('rotationNotice.title')}>
      <div className="max-w-lg mx-auto flex flex-col gap-4">
        <Reveal>
          <div className="card p-5">
            <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-5">{t('rotationNotice.subtitle')}</p>

            <h2 className="font-display font-semibold mb-2">{t('rotationNotice.orderTitle')}</h2>
            <ol className="flex flex-col gap-2 mb-5">
              {order.map((id, idx) => {
                const m = memberById[id]
                if (!m) return null
                const away = awayUserIds.has(id)
                return (
                  <li key={id} className="flex items-center gap-2 bg-cream-100 dark:bg-ink-700 rounded-xl px-3 py-2 text-sm min-w-0">
                    <span className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-700/25 text-violet-600 dark:text-violet-200 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <MarqueeText className="min-w-0 font-medium">{m.name}</MarqueeText>
                    {m.isVirtual && <VirtualTag className="shrink-0" />}
                    {away && (
                      <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-gold-500 bg-gold-400/15 px-1.5 py-0.5 rounded-md shrink-0">
                        <SunIcon className="w-3 h-3" />
                        {t('floorSettings.awayTag')}
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>

            {preview.activities.length > 0 && (
              <>
                <h2 className="font-display font-semibold mb-2">{t('rotationNotice.turnsTitle')}</h2>
                <ul className="flex flex-col gap-2 mb-5">
                  {preview.activities.map((a) => (
                    <li key={a.id} className="rounded-xl border-2 border-ink-900/10 dark:border-cream-100/15 px-3 py-2.5 min-w-0">
                      <MarqueeText className="text-sm font-semibold min-w-0">{a.title}</MarqueeText>
                      <p className="text-xs text-ink-900/60 dark:text-cream-100/60 mt-0.5 break-words">
                        {a.now
                          ? a.now.person
                            ? t('rotationNotice.nowLabel', { name: a.now.person.name })
                            : a.now.everyone
                              ? t('publicTurns.everyone')
                              : t('publicTurns.unassigned')
                          : t('publicTurns.notThisPeriod')}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="flex flex-col gap-2 pt-1">
              <button type="button" className="btn-primary w-full py-3 text-base" onClick={handleAgree}>
                {t('rotationNotice.agree')}
              </button>
              <button
                type="button"
                onClick={handleSuggest}
                className="text-xs font-semibold text-ink-900/50 dark:text-cream-100/50 hover:underline self-center"
              >
                {t('rotationNotice.suggestLink')}
              </button>
            </div>
          </div>
        </Reveal>
      </div>
    </AppLayout>
  )
}
