import { useState } from 'react'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../context/AuthContext'
import { useData, REWARD_CATALOG } from '../context/DataContext'
import { CoinIcon } from '../components/icons'
import { useToast } from '../context/ToastContext'
import Reveal from '../components/Reveal'

export default function Rewards() {
  const { user } = useAuth()
  const { leaderboard, redemptions, redeemReward } = useData()
  const { showToast } = useToast()
  const [feedback, setFeedback] = useState(null)

  function handleRedeem(key) {
    const result = redeemReward(key)
    setFeedback(result)
    showToast(result.message, result.ok ? 'success' : 'default')
    setTimeout(() => setFeedback(null), 3500)
  }

  return (
    <AppLayout title="Convis y recompensas">
      <div className="grid md:grid-cols-2 gap-5">
        <Reveal as="section" delay={0} className="card p-5">
          <h2 className="font-display font-semibold mb-4">Ranking del piso</h2>
          <ol className="flex flex-col gap-2">
            {leaderboard.map((m, idx) => (
              <li key={m.id} className="flex items-center gap-3 px-2 py-2 rounded-xl bg-cream-100 dark:bg-ink-700">
                <span className="w-6 text-center font-display font-bold text-violet-500">{idx + 1}</span>
                <div className="w-8 h-8 rounded-full bg-gold-400 border-2 border-ink-900 flex items-center justify-center text-sm font-bold text-ink-900">
                  {m.name[0].toUpperCase()}
                </div>
                <span className="flex-1 text-sm font-medium">{m.name}{m.id === user.id ? ' (tú)' : ''}</span>
                <span className="flex items-center gap-1 text-sm font-semibold">
                  <CoinIcon className="w-4 h-4 text-gold-500" />{m.points || 0}
                </span>
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal as="section" delay={80} className="card p-5">
          <h2 className="font-display font-semibold mb-1">Canjear Convis</h2>
          <p className="flex items-center gap-1.5 text-sm text-ink-900/60 dark:text-cream-100/60 mb-4">
            Tienes <strong className="inline-flex items-center gap-1"><CoinIcon className="w-4 h-4 text-gold-500" />{user.points || 0}</strong> Convis disponibles.
          </p>
          <div className="flex flex-col gap-3">
            {REWARD_CATALOG.map((r) => {
              const canAfford = (user.points || 0) >= r.cost
              return (
                <div key={r.key} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-cream-100 dark:bg-ink-700">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{r.icon}</span>
                    <div>
                      <p className="text-sm font-medium">{r.label}</p>
                      <p className="flex items-center gap-1 text-xs text-ink-900/50 dark:text-cream-100/50">
                        <CoinIcon className="w-3 h-3" />{r.cost} Convis
                      </p>
                    </div>
                  </div>
                  <button
                    disabled={!canAfford}
                    onClick={() => handleRedeem(r.key)}
                    className="btn-secondary text-xs disabled:opacity-40"
                  >
                    Canjear
                  </button>
                </div>
              )
            })}
          </div>
          {feedback && (
            <p className={`text-sm font-medium mt-3 ${feedback.ok ? 'text-sage-500' : 'text-clay-500'}`}>{feedback.message}</p>
          )}
        </Reveal>

        <Reveal as="section" delay={160} className="card p-5 md:col-span-2">
          <h2 className="font-display font-semibold mb-3">Historial de canjes</h2>
          {redemptions.length === 0 ? (
            <p className="text-sm text-ink-900/50 dark:text-cream-100/50">Todavía no se ha canjeado nada.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {redemptions.map((r) => (
                <li key={r.id} className="flex justify-between py-1.5 border-b last:border-0 border-ink-900/10 dark:border-cream-100/15">
                  <span><strong>{r.userName}</strong> canjeó {r.rewardLabel}</span>
                  <span className="flex items-center gap-1 text-ink-900/40 dark:text-cream-100/40">
                    <CoinIcon className="w-3 h-3" />{r.cost}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Reveal>
      </div>
    </AppLayout>
  )
}
