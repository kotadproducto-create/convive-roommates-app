import { useState } from 'react'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../context/AuthContext'
import { useData, REWARD_CATALOG } from '../context/DataContext'

export default function Rewards() {
  const { user } = useAuth()
  const { leaderboard, redemptions, redeemReward } = useData()
  const [feedback, setFeedback] = useState(null)

  function handleRedeem(key) {
    const result = redeemReward(key)
    setFeedback(result)
    setTimeout(() => setFeedback(null), 3500)
  }

  return (
    <AppLayout title="Puntos y recompensas">
      <div className="grid md:grid-cols-2 gap-5">
        <section className="card p-5">
          <h2 className="font-display font-semibold mb-4">Ranking del piso</h2>
          <ol className="flex flex-col gap-2">
            {leaderboard.map((m, idx) => (
              <li key={m.id} className="flex items-center gap-3 px-2 py-2 rounded-xl bg-linen-100 dark:bg-charcoal-700">
                <span className="w-6 text-center font-display font-semibold text-plum-500">{idx + 1}</span>
                <div className="w-8 h-8 rounded-full bg-mustard-400 flex items-center justify-center text-sm font-semibold">
                  {m.name[0].toUpperCase()}
                </div>
                <span className="flex-1 text-sm font-medium">{m.name}{m.id === user.id ? ' (tú)' : ''}</span>
                <span className="text-sm font-semibold">{m.points || 0} pts</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="card p-5">
          <h2 className="font-display font-semibold mb-1">Canjear puntos</h2>
          <p className="text-sm text-charcoal-900/60 dark:text-linen-100/60 mb-4">
            Tienes <strong>{user.points || 0}</strong> puntos disponibles.
          </p>
          <div className="flex flex-col gap-3">
            {REWARD_CATALOG.map((r) => {
              const canAfford = (user.points || 0) >= r.cost
              return (
                <div key={r.key} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-linen-100 dark:bg-charcoal-700">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{r.icon}</span>
                    <div>
                      <p className="text-sm font-medium">{r.label}</p>
                      <p className="text-xs text-charcoal-900/50 dark:text-linen-100/50">{r.cost} puntos</p>
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
            <p className={`text-sm mt-3 ${feedback.ok ? 'text-sage-500' : 'text-clay-500'}`}>{feedback.message}</p>
          )}
        </section>

        <section className="card p-5 md:col-span-2">
          <h2 className="font-display font-semibold mb-3">Historial de canjes</h2>
          {redemptions.length === 0 ? (
            <p className="text-sm text-charcoal-900/50 dark:text-linen-100/50">Todavía no se ha canjeado nada.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {redemptions.map((r) => (
                <li key={r.id} className="flex justify-between py-1.5 border-b last:border-0 border-linen-200 dark:border-charcoal-700">
                  <span><strong>{r.userName}</strong> canjeó {r.rewardLabel}</span>
                  <span className="text-charcoal-900/40 dark:text-linen-100/40">{r.cost} pts</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppLayout>
  )
}
