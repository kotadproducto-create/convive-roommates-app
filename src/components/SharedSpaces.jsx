import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { useLanguage } from '../context/LanguageContext'
import { SHARED_SPACES, currentSpaceUse, minutesLeft, splitMinutes } from '../lib/sharedSpaces'
import { WasherIcon, SparkleIcon } from './icons'

// Ícono de cada espacio, por clave — uno nuevo cae al genérico.
const SPACE_ICONS = { washer: WasherIcon }

/**
 * Estado en vivo de un espacio compartido: `current` es el uso vigente
 * (null = libre), `user` quien lo está usando y `left` los minutos que
 * faltan. La hora se refresca cada 30 s para que "libre" se note solo al
 * vencer el tiempo (no hay cron: se calcula con la hora actual).
 */
export function useSpaceUse(spaceKey) {
  const { sharedSpaceUses, members } = useData()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])
  const current = useMemo(() => currentSpaceUse(sharedSpaceUses, spaceKey, now), [sharedSpaceUses, spaceKey, now])
  const user = current ? members.find((m) => m.id === current.userId) : null
  // `left` se calcula con la hora de ESTE render (no con `now`, que solo
  // cambia cada 30 s y dejaría el conteo un minuto atrasado al empezar).
  return { current, user, left: current ? minutesLeft(current) : 0 }
}

/** "1 h 35 min" / "35 min" / "2 h" */
export function formatLeft(total, t) {
  const { hours, minutes } = splitMinutes(total)
  if (!hours) return t('sharedSpaces.minutesShort', { m: minutes })
  return minutes ? t('sharedSpaces.hoursMinutesShort', { h: hours, m: minutes }) : t('sharedSpaces.hoursShort', { h: hours })
}

/**
 * Actividades → "Espacios compartidos": elementos de uso común del piso
 * (hoy la lavadora). Aparte de las actividades de limpieza/tareas: aquí no
 * hay turnos ni puntos, solo avisar "voy a usarla" y ver quién la tiene en
 * uso. Para sumar otro espacio, ver lib/sharedSpaces.js.
 */
export default function SharedSpaces() {
  const { t } = useLanguage()
  return (
    <section className="mb-6">
      <h3 className="font-display font-semibold">{t('sharedSpaces.title')}</h3>
      <p className="text-xs text-ink-900/50 dark:text-cream-100/50 mb-3">{t('sharedSpaces.subtitle')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {SHARED_SPACES.map((space) => (
          <SpaceCard key={space.key} space={space} />
        ))}
      </div>
    </section>
  )
}

function SpaceCard({ space }) {
  const { user: me, membership } = useAuth()
  const { startSharedSpaceUse, releaseSharedSpaceUse } = useData()
  const { showToast } = useToast()
  const { t } = useLanguage()
  const { current, user: userInUse, left } = useSpaceUse(space.key)
  const [minutes, setMinutes] = useState(space.defaultMinutes)
  const [busy, setBusy] = useState(false)
  const Icon = SPACE_ICONS[space.key] || SparkleIcon
  const isMine = current?.userId === me?.id
  const canRelease = current && (isMine || membership?.role === 'admin')

  async function handleStart() {
    setBusy(true)
    try {
      const result = await startSharedSpaceUse(space.key, minutes)
      if (result?.ok) {
        showToast(t('sharedSpaces.startedToast', { space: t(`sharedSpaces.spaceRef.${space.key}`), time: format(new Date(result.use.endsAt), 'HH:mm') }), 'success')
      } else if (result?.reason === 'busy') {
        showToast(t('sharedSpaces.busyToast', { space: t(`sharedSpaces.spaceRef.${space.key}`) }), 'default')
      }
    } catch (err) {
      console.error('startSharedSpaceUse', err)
      showToast(t('sharedSpaces.errorToast'), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleRelease() {
    setBusy(true)
    try {
      await releaseSharedSpaceUse(current.id)
      showToast(t('sharedSpaces.releasedToast', { space: t(`sharedSpaces.spaceRef.${space.key}`) }), 'default')
    } catch (err) {
      console.error('releaseSharedSpaceUse', err)
      showToast(t('sharedSpaces.errorToast'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl border-2 border-ink-900/70 dark:border-cream-100/30 bg-violet-100 dark:bg-violet-700/25 text-violet-600 dark:text-violet-200 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="font-display font-semibold truncate">{t(`sharedSpaces.spaces.${space.key}`)}</p>
          <p className="text-xs text-ink-900/50 dark:text-cream-100/50">{t(`sharedSpaces.hints.${space.key}`)}</p>
        </div>
      </div>

      {current ? (
        <div className="rounded-xl bg-gold-100 dark:bg-gold-400/15 border-2 border-gold-500/40 px-3 py-2.5">
          <p className="text-sm font-semibold break-words">
            {isMine
              ? t('sharedSpaces.inUseByYou', { space: t(`sharedSpaces.spaceRef.${space.key}`) })
              : t('sharedSpaces.inUseBy', { name: userInUse?.name || t('sharedSpaces.someone'), space: t(`sharedSpaces.spaceRef.${space.key}`) })}
          </p>
          <p className="text-xs text-ink-900/60 dark:text-cream-100/60">
            {t('sharedSpaces.untilTime', { time: format(new Date(current.endsAt), 'HH:mm'), left: formatLeft(left, t) })}
          </p>
        </div>
      ) : (
        <p className="text-xs font-semibold text-sage-500">{t('sharedSpaces.free')}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!current && (
          <label className="flex items-center gap-1.5 text-xs text-ink-900/60 dark:text-cream-100/60">
            {t('sharedSpaces.duration')}
            <select className="input !w-auto text-xs py-1.5" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {space.durations.map((d) => (
                <option key={d} value={d}>
                  {formatLeft(d, t)}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className="btn-primary text-sm flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={busy || !!current}
          onClick={handleStart}
        >
          {t('sharedSpaces.cta')}
        </button>
        {canRelease && (
          <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={handleRelease}>
            {isMine ? t('sharedSpaces.release') : t('sharedSpaces.releaseAdmin')}
          </button>
        )}
      </div>
    </div>
  )
}
