import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { AuthShell } from './Login'
import { useLanguage } from '../context/LanguageContext'
import { buildPublicTurns, isPublicTurnsToken } from '../lib/publicTurns'
import { fetchPublicTurns } from '../lib/publicTurnsApi'

/**
 * Link público de turnos: a quién le toca y quién está a cargo del piso ahora.
 * Solo lectura, sin iniciar sesión (ver supabase/public_turns.sql).
 */
export default function PublicTurns() {
  const { token } = useParams()
  const { t, dateLocale } = useLanguage()
  const [phase, setPhase] = useState(isPublicTurnsToken(token) ? 'loading' : 'notfound') // 'loading' | 'ready' | 'notfound' | 'error'
  const [data, setData] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)

  const load = useCallback(async () => {
    if (!isPublicTurnsToken(token)) {
      setPhase('notfound')
      return
    }
    try {
      const result = await fetchPublicTurns(token)
      if (result?.ok) {
        setData(result)
        setUpdatedAt(new Date())
        setPhase('ready')
      } else {
        setPhase('notfound')
      }
    } catch (err) {
      console.error('public turns', err)
      // Si ya había datos en pantalla se dejan (mejor eso que borrarlos por un fallo de red).
      setPhase((current) => (current === 'ready' ? current : 'error'))
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  // Se vuelve a leer al volver a la pestaña o a la app, para que no muestre turnos viejos.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  // Además, mientras la pestaña queda abierta y a la vista, se refresca sola
  // cada minuto — sin esto, un enlace dejado abierto (p. ej. una tablet en la
  // entrada del piso) se queda mostrando turnos viejos indefinidamente, ya
  // que nunca dispara "visibilitychange" si nadie cambia de pestaña. No hay
  // cron en esta arquitectura (ver notas de DataContext.jsx): esto es sondeo
  // simple del lado del cliente, no un socket en vivo.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, 60000)
    return () => clearInterval(id)
  }, [load])

  const view = useMemo(() => (data ? buildPublicTurns(data, updatedAt || new Date()) : null), [data, updatedAt])

  if (phase === 'loading') {
    return (
      <AuthShell>
        <p className="text-sm text-ink-900/60 dark:text-cream-100/60 text-center">{t('publicTurns.loading')}</p>
      </AuthShell>
    )
  }

  if (phase !== 'ready') {
    const notFound = phase === 'notfound'
    return (
      <AuthShell>
        <h1 className="font-display text-xl font-bold mb-1">{t(notFound ? 'publicTurns.notFoundTitle' : 'publicTurns.errorTitle')}</h1>
        <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-4">{t(notFound ? 'publicTurns.notFoundBody' : 'publicTurns.errorBody')}</p>
        {!notFound && (
          <button type="button" className="btn-secondary text-sm mb-3" onClick={load}>
            {t('publicTurns.retry')}
          </button>
        )}
        <Link to="/login" className="block text-sm font-semibold text-violet-500 hover:underline">
          {t('publicTurns.openApp')}
        </Link>
      </AuthShell>
    )
  }

  const dateLabel = (date) => format(date, 'EEE d MMM', { locale: dateLocale })

  return (
    <AuthShell>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50 mb-1">{t('publicTurns.readOnly')}</p>
      <h1 className="font-display text-xl font-bold leading-snug mb-4 break-words">{view.floorName}</h1>

      <section className="rounded-xl bg-violet-50 dark:bg-violet-700/25 border-2 border-violet-500/30 px-4 py-3 mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-200 mb-1">{t('publicTurns.keeperTitle')}</p>
        <p className="font-display text-2xl font-bold break-words">{view.keeper.now ? view.keeper.now.name : t('publicTurns.nobody')}</p>
        {view.keeper.next && (
          <p className="text-xs text-ink-900/60 dark:text-cream-100/60 mt-1 break-words">
            {t('publicTurns.keeperNext', { name: view.keeper.next.name })}{' '}
            {view.keeper.nextChangeDate && (
              <span className="text-ink-900/40 dark:text-cream-100/40">
                ({format(view.keeper.nextChangeDate, 'd MMM', { locale: dateLocale })})
              </span>
            )}
          </p>
        )}
      </section>

      <h2 className="font-display font-semibold mb-2">{t('publicTurns.activitiesTitle')}</h2>
      {view.activities.length === 0 ? (
        <p className="text-sm text-ink-900/50 dark:text-cream-100/50 mb-5">{t('publicTurns.noActivities')}</p>
      ) : (
        <ul className="flex flex-col gap-2 mb-5">
          {view.activities.map((a) => (
            <li key={a.id} className="rounded-xl border-2 border-ink-900/10 dark:border-cream-100/15 px-3 py-2.5">
              <p className="text-sm font-semibold break-words">{a.title}</p>
              {a.now ? (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-sm">
                  <span className="text-xs text-ink-900/50 dark:text-cream-100/50">{t('publicTurns.now')}</span>
                  <span className="font-semibold min-w-0 break-words">{a.now.person ? a.now.person.name : a.now.everyone ? t('publicTurns.everyone') : t('publicTurns.unassigned')}</span>
                  <StatusChip turn={a.now} t={t} />
                </div>
              ) : (
                <p className="text-xs text-ink-900/50 dark:text-cream-100/50 mt-1">{t('publicTurns.notThisPeriod')}</p>
              )}
              {a.next && (
                <p className="text-xs text-ink-900/60 dark:text-cream-100/60 mt-1 break-words">
                  {t('publicTurns.next')}: <span className="font-semibold">{a.next.person ? a.next.person.name : a.next.everyone ? t('publicTurns.everyone') : t('publicTurns.unassigned')}</span> · {dateLabel(a.next.date)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {view.sharedSpaces.length > 0 && (
        <>
          <h2 className="font-display font-semibold mb-2">{t('sharedSpaces.title')}</h2>
          <ul className="flex flex-col gap-2 mb-5">
            {view.sharedSpaces.map((space) => (
              <li key={space.key} className="rounded-xl border-2 border-ink-900/10 dark:border-cream-100/15 px-3 py-2.5">
                <p className="text-sm font-semibold break-words">{t(`sharedSpaces.spaces.${space.key}`)}</p>
                {space.current ? (
                  <p className="text-xs text-gold-600 dark:text-gold-300 mt-1 break-words">
                    {t('sharedSpaces.inUseBy', {
                      name: space.current.person ? space.current.person.name : t('sharedSpaces.someone'),
                      space: t(`sharedSpaces.spaceRef.${space.key}`)
                    })}{' '}
                    · {t('publicTurns.spaceUntil', { time: format(space.current.endsAt, 'HH:mm') })}
                  </p>
                ) : (
                  <p className="text-xs text-sage-600 dark:text-sage-300 mt-1">{t('sharedSpaces.free')}</p>
                )}
                {space.waitlist.length > 0 && (
                  <p className="text-xs text-ink-900/60 dark:text-cream-100/60 mt-1 break-words">
                    {t('sharedSpaces.waitlistTitle')}: {space.waitlist.map((p) => p.name).join(', ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {view.rotation.length > 0 && (
        <>
          <h2 className="font-display font-semibold mb-2">{t('publicTurns.rotationTitle')}</h2>
          <ol className="flex flex-col gap-1.5 mb-5">
            {view.rotation.map((m, index) => {
              const isKeeperNow = view.keeper.now?.id === m.id
              const isKeeperNext = !isKeeperNow && view.keeper.next?.id === m.id
              return (
                <li
                  key={m.id}
                  className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm min-w-0 rounded-lg px-2 py-1.5 ${
                    isKeeperNow
                      ? 'bg-violet-50 dark:bg-violet-700/25 border-2 border-violet-500/40'
                      : isKeeperNext
                        ? 'bg-violet-50/60 dark:bg-violet-700/10'
                        : ''
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                      isKeeperNow ? 'bg-violet-500 text-white' : 'bg-violet-100 dark:bg-violet-700/25 text-violet-600 dark:text-violet-200'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className={`min-w-0 break-words ${isKeeperNow ? 'font-bold' : ''}`}>{m.name}</span>
                  {isKeeperNow && (
                    <span className="text-[10px] uppercase font-bold text-violet-600 dark:text-violet-200 bg-violet-100 dark:bg-violet-700/30 px-1.5 py-0.5 rounded-md shrink-0">
                      {t('publicTurns.keeperNowTag')}
                    </span>
                  )}
                  {isKeeperNext && (
                    <span className="text-[10px] uppercase font-semibold text-violet-500/70 dark:text-violet-300/70 shrink-0">
                      {t('publicTurns.keeperNextTag')}
                    </span>
                  )}
                  {m.away && (
                    <span className="text-[10px] uppercase font-bold text-gold-500 bg-gold-400/15 px-1.5 py-0.5 rounded-md shrink-0">{t('publicTurns.awayTag')}</span>
                  )}
                </li>
              )
            })}
          </ol>
        </>
      )}

      <div className="pt-4 border-t border-ink-900/10 dark:border-cream-100/15 flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="text-xs text-ink-900/50 dark:text-cream-100/50">
            {updatedAt && t('publicTurns.updatedAt', { time: format(updatedAt, 'HH:mm') })}
          </span>
          <button type="button" onClick={load} className="text-xs font-semibold text-violet-500 hover:underline">
            {t('publicTurns.refresh')}
          </button>
        </div>
        <Link to="/login" className="text-xs font-medium text-ink-900/50 dark:text-cream-100/50 hover:underline">
          {t('publicTurns.openApp')}
        </Link>
      </div>

      {view.inviteCode && (
        <div className="mt-5 pt-5 border-t border-ink-900/10 dark:border-cream-100/15 flex flex-col items-stretch gap-1.5">
          <Link to={`/unirse/${view.inviteCode}`} className="btn-primary text-sm text-center">
            {t('publicTurns.joinButton')}
          </Link>
          <p className="text-xs text-center text-ink-900/50 dark:text-cream-100/50">{t('publicTurns.joinNote')}</p>
        </div>
      )}
    </AuthShell>
  )
}

/** Estado del turno actual: hecho, pendiente o progreso (p. ej. 1/3). */
function StatusChip({ turn, t }) {
  if (turn.everyone && !turn.person) return null
  if (turn.done) {
    return <span className="text-[10px] uppercase font-bold text-sage-500 bg-sage-100 dark:bg-sage-500/20 px-1.5 py-0.5 rounded-md">{t('publicTurns.done')}</span>
  }
  const label = turn.target > 1 ? t('publicTurns.progress', { done: turn.timesDone, total: turn.target }) : t('publicTurns.pending')
  return <span className="text-[10px] uppercase font-bold text-gold-500 bg-gold-400/15 px-1.5 py-0.5 rounded-md">{label}</span>
}
