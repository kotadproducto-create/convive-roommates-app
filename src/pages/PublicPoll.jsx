import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { AuthShell } from './Login'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { PIN_LENGTH, cleanPinInput, isValidPin, voteErrorKey } from '../lib/publicPoll'
import { fetchPublicPoll, voteWithPin, voteWithDevice, forgetThisDevice } from '../lib/publicPollApi'

/**
 * Votar una consulta desde el link de WhatsApp, sin iniciar sesión: la persona
 * elige su nombre y pone su PIN (o, en un móvil ya recordado, vota directo).
 * Solo se puede votar; no se puede cambiar nada más. Ver supabase/public_polls.sql.
 */
export default function PublicPoll() {
  const { pollId } = useParams()
  const { user } = useAuth()
  const { t, dateLocale } = useLanguage()
  const [phase, setPhase] = useState('loading') // 'loading' | 'ready' | 'notfound' | 'error'
  const [data, setData] = useState(null)
  // Confirmación del último voto (se ve tanto si el móvil queda recordado como si no).
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      const result = await fetchPublicPoll(pollId)
      if (result?.ok) {
        setData(result)
        setPhase('ready')
      } else {
        setPhase('notfound')
      }
    } catch (err) {
      console.error('public poll', err)
      setPhase('error')
    }
  }, [pollId])

  useEffect(() => {
    load()
  }, [load])

  if (phase === 'loading') {
    return (
      <AuthShell>
        <p className="text-sm text-ink-900/60 dark:text-cream-100/60 text-center">{t('publicPoll.loading')}</p>
      </AuthShell>
    )
  }

  if (phase !== 'ready') {
    return (
      <AuthShell>
        <h1 className="font-display text-xl font-bold mb-1">{t(phase === 'notfound' ? 'publicPoll.notFoundTitle' : 'publicPoll.errorTitle')}</h1>
        <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-4">{t(phase === 'notfound' ? 'publicPoll.notFoundBody' : 'publicPoll.errorBody')}</p>
        {phase === 'error' && (
          <button type="button" className="btn-secondary text-sm mb-3" onClick={load}>
            {t('publicPoll.retry')}
          </button>
        )}
        <Link to="/login" className="block text-sm font-semibold text-violet-500 hover:underline">
          {t('publicPoll.openApp')}
        </Link>
      </AuthShell>
    )
  }

  const { poll, members, me, tally, voted_count: votedCount, total_voters: totalVoters } = data
  const deadlineLabel = poll.deadline_at
    ? format(new Date(poll.deadline_at), 'd MMM, HH:mm', { locale: dateLocale })
    : poll.deadline
      ? format(new Date(`${poll.deadline}T00:00:00`), t('calendar.dayMonthFormat'), { locale: dateLocale })
      : null

  return (
    <AuthShell>
      {poll.floor_name && (
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50 mb-1 break-words">
          {t('publicPoll.fromFloor', { floor: poll.floor_name })}
        </p>
      )}
      <h1 className="font-display text-xl font-bold leading-snug mb-2 break-words">{poll.question}</h1>
      <p className="text-xs text-ink-900/50 dark:text-cream-100/50 mb-4">
        {poll.resolution_mode === 'unanimity' ? t('votaciones.modeUnanimity') : t('votaciones.modeMajority')}
        {deadlineLabel && ` · ${t('votaciones.deadlineLabel', { date: deadlineLabel })}`}
        {` · ${t('publicPoll.votedCount', { voted: votedCount, total: totalVoters })}`}
      </p>

      {notice && poll.is_open && <p className="text-sm font-semibold text-sage-500 mb-3 break-words">{notice}</p>}

      {!poll.is_open ? (
        <ClosedBlock poll={poll} tally={tally} t={t} />
      ) : me ? (
        <RememberedVoter pollId={pollId} poll={poll} me={me} tally={tally} onChanged={load} onNotice={setNotice} t={t} />
      ) : (
        <PinVoter pollId={pollId} poll={poll} members={members} onVoted={load} onNotice={setNotice} t={t} />
      )}

      <div className="mt-5 pt-4 border-t border-ink-900/10 dark:border-cream-100/15 flex flex-col gap-1.5">
        {user && (
          <Link to="/votaciones" className="text-sm font-semibold text-violet-500 hover:underline">
            {t('publicPoll.goVotaciones')}
          </Link>
        )}
        <Link to="/login" className="text-xs font-medium text-ink-900/50 dark:text-cream-100/50 hover:underline">
          {t('publicPoll.openApp')}
        </Link>
      </div>
    </AuthShell>
  )
}

/** Opciones como botones de ancho completo (no se recortan aunque el texto sea largo). */
function OptionButtons({ options, selected, onPick, disabled, tally }) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((option, index) => {
        const isSelected = selected === index
        return (
          <button
            key={`${index}-${option}`}
            type="button"
            aria-pressed={isSelected}
            disabled={disabled}
            onClick={() => onPick(index)}
            className={`w-full min-w-0 text-left px-4 py-3 rounded-xl text-sm font-semibold border-2 transition break-words disabled:opacity-60 ${
              isSelected
                ? 'bg-gold-100 dark:bg-gold-400/25 border-ink-900 dark:border-cream-100/50 text-ink-900 dark:text-cream-100'
                : 'border-ink-900/15 dark:border-cream-100/20 text-ink-900/80 dark:text-cream-100/80 hover:bg-cream-100 dark:hover:bg-ink-700'
            }`}
          >
            {option}
            {tally && ` · ${tally[option] || 0}`}
          </button>
        )
      })}
    </div>
  )
}

/** Consulta terminada: solo se muestra el resultado. */
function ClosedBlock({ poll, tally, t }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-ink-900/70 dark:text-cream-100/70">{t('publicPoll.closedTitle')}</p>
      {poll.status === 'resolved' && poll.resolved_option ? (
        <p className="text-sm font-semibold text-sage-500">{t('votaciones.winnerLabel', { option: poll.resolved_option })}</p>
      ) : (
        poll.status !== 'pending' && <p className="text-sm font-semibold text-ink-900/50 dark:text-cream-100/50">{t('votaciones.noWinner')}</p>
      )}
      {tally && (
        <ul className="flex flex-col gap-1 text-sm">
          {poll.options.map((option) => (
            <li key={option} className="flex justify-between gap-3 min-w-0">
              <span className="min-w-0 break-words">{option}</span>
              <span className="font-semibold shrink-0">{tally[option] || 0}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Este móvil ya está recordado: un toque y listo, sin PIN. */
function RememberedVoter({ pollId, poll, me, tally, onChanged, onNotice, t }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const selected = me.vote ? poll.options.indexOf(me.vote) : null

  async function handlePick(optionIndex) {
    setBusy(true)
    setError('')
    onNotice('')
    try {
      const result = await voteWithDevice({ pollId, optionIndex })
      if (result?.ok) {
        onNotice(t('publicPoll.voted', { option: poll.options[optionIndex] }))
      } else {
        setError(t(voteErrorKey(result?.error)))
      }
      await onChanged()
    } catch (err) {
      console.error('vote with device', err)
      setError(t('publicPoll.errGeneric'))
    } finally {
      setBusy(false)
    }
  }

  async function handleNotMe() {
    try {
      await forgetThisDevice()
    } catch (err) {
      console.error('forget device', err)
    }
    onNotice('')
    await onChanged()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-semibold min-w-0 break-words">{t('publicPoll.hello', { name: me.name })}</p>
        <button type="button" onClick={handleNotMe} className="text-xs font-semibold text-clay-500 hover:underline">
          {t('publicPoll.notMe')}
        </button>
      </div>
      <p className="text-xs text-ink-900/60 dark:text-cream-100/60">{t(me.vote ? 'publicPoll.canChange' : 'publicPoll.chooseOption')}</p>
      <OptionButtons options={poll.options} selected={selected} onPick={handlePick} disabled={busy} tally={tally} />
      {error && <p className="text-sm font-medium text-clay-500 break-words">{error}</p>}
    </div>
  )
}

/** Primer voto desde este móvil: nombre + PIN (+ recordar este móvil). */
function PinVoter({ pollId, poll, members, onVoted, onNotice, t }) {
  const [userId, setUserId] = useState('')
  const [pin, setPin] = useState('')
  const [optionIndex, setOptionIndex] = useState(null)
  const [remember, setRemember] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const chosen = members.find((m) => m.id === userId)
  const canSubmit = Boolean(chosen?.has_pin) && isValidPin(pin) && optionIndex !== null && !submitting

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError('')
    try {
      const result = await voteWithPin({ pollId, userId, pin, optionIndex, remember })
      if (result?.ok) {
        onNotice(t('publicPoll.voted', { option: poll.options[optionIndex] }))
        setPin('')
        await onVoted()
      } else {
        setError(t(voteErrorKey(result?.error)))
        if (result?.error === 'wrong_pin') setPin('')
      }
    } catch (err) {
      console.error('vote with pin', err)
      setError(t('publicPoll.errGeneric'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="text-sm font-medium block">
        {t('publicPoll.whoAreYou')}
        <select
          className="input mt-1 w-full min-w-0"
          value={userId}
          onChange={(e) => {
            setUserId(e.target.value)
            setError('')
          }}
          required
        >
          <option value="">{t('publicPoll.pickName')}</option>
          {members.map((m) => (
            <option key={m.id} value={m.id} disabled={!m.has_pin}>
              {m.name}
              {m.has_pin ? '' : ` ${t('publicPoll.noPinSuffix')}`}
            </option>
          ))}
        </select>
      </label>

      {chosen && !chosen.has_pin ? (
        <p className="text-sm text-gold-500 font-medium">{t('publicPoll.noPinHint')}</p>
      ) : (
        <>
          <label className="text-sm font-medium block">
            {t('publicPoll.pinLabel')}
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={PIN_LENGTH}
              className="input mt-1 w-full text-center text-lg tracking-[0.4em]"
              placeholder="••••••"
              value={pin}
              onChange={(e) => setPin(cleanPinInput(e.target.value))}
            />
          </label>

          <div>
            <p className="text-sm font-medium mb-2">{t('publicPoll.chooseOption')}</p>
            <OptionButtons options={poll.options} selected={optionIndex} onPick={setOptionIndex} disabled={submitting} />
          </div>

          <label className="flex items-start gap-2 text-xs text-ink-900/70 dark:text-cream-100/70 cursor-pointer">
            <input type="checkbox" className="mt-0.5 shrink-0" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span className="min-w-0">{t('publicPoll.remember')}</span>
          </label>

          {error && <p className="text-sm font-medium text-clay-500 break-words">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={!canSubmit}>
            {submitting ? t('publicPoll.voting') : t('publicPoll.vote')}
          </button>
        </>
      )}
    </form>
  )
}
