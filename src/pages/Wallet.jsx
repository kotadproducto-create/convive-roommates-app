import { useMemo, useState } from 'react'
import AppLayout from '../components/AppLayout'
import Reveal from '../components/Reveal'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { JarIcon } from '../components/icons'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Wallet() {
  const { user, membership } = useAuth()
  const { floor, members, potContributions, addPotContribution, setMemberPotActive } = useData()
  const { showToast } = useToast()
  const isAdmin = membership?.role === 'admin'
  const [amount, setAmount] = useState(floor?.potPerPerson || 10)

  const potLow = floor && floor.potAmount < floor.potThreshold

  const activeMembers = useMemo(() => members.filter((m) => m.potActive !== false), [members])
  const inactiveMembers = useMemo(() => members.filter((m) => m.potActive === false), [members])

  // Saldo estilo Splitwise: se reparte en partes iguales SOLO lo aportado
  // por quienes están activos en el pote ahora mismo, entre esos mismos
  // activos. Quien está de baja no cuenta ni aporta ni debe nada mientras
  // dure la baja.
  const balances = useMemo(() => {
    const totalsByUser = {}
    for (const c of potContributions) {
      totalsByUser[c.userId] = (totalsByUser[c.userId] || 0) + Number(c.amount)
    }
    const activeIds = new Set(activeMembers.map((m) => m.id))
    const totalAmongActive = potContributions
      .filter((c) => activeIds.has(c.userId))
      .reduce((sum, c) => sum + Number(c.amount), 0)
    const fairShare = activeMembers.length ? totalAmongActive / activeMembers.length : 0
    const byId = {}
    for (const m of activeMembers) {
      byId[m.id] = { contributed: totalsByUser[m.id] || 0, fairShare, balance: (totalsByUser[m.id] || 0) - fairShare }
    }
    return byId
  }, [potContributions, activeMembers])

  async function handleContribute() {
    await addPotContribution(amount)
    showToast(`¡Aportaste ${amount}€ al pote!`, 'success')
  }

  function toggleActive(member) {
    setMemberPotActive(member.membershipId, !(member.potActive === true))
  }

  const canToggle = (member) => member.id === user.id || isAdmin

  const history = useMemo(
    () => potContributions.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [potContributions]
  )
  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members])

  return (
    <AppLayout title="Pote de dinero">
      <Reveal>
        <div className="card p-5 mb-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gold-100 dark:bg-gold-400/20 text-gold-500 flex items-center justify-center shrink-0">
              <JarIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50">Total del pote</p>
              <p className={`text-2xl font-display font-bold ${potLow ? 'text-clay-500' : 'text-sage-500'}`}>{floor?.potAmount ?? 0}€</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="number" className="input w-24" value={amount} min={1} onChange={(e) => setAmount(e.target.value)} />
            <button className="btn-primary text-sm" onClick={handleContribute}>
              Aportar
            </button>
          </div>
        </div>
      </Reveal>

      <div className="grid md:grid-cols-2 gap-5 mb-5">
        <Reveal delay={60}>
          <section className="card p-5">
            <h2 className="font-display font-semibold mb-1">Saldo por persona</h2>
            <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-4">
              Verde: aportó de más. Rojo: le falta para llegar a su parte equitativa.
            </p>
            <ul className="flex flex-col gap-2">
              {activeMembers.map((m) => {
                const b = balances[m.id] || { contributed: 0, balance: 0 }
                const positive = b.balance >= 0.01
                const negative = b.balance <= -0.01
                return (
                  <li key={m.id} className="flex items-center justify-between px-2 py-2 rounded-xl bg-cream-100 dark:bg-ink-700">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-700/25 text-violet-600 dark:text-violet-200 flex items-center justify-center text-xs font-bold shrink-0">
                        {m.name[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{m.name}{m.id === user.id ? ' (tú)' : ''}</p>
                        <p className="text-xs text-ink-900/40 dark:text-cream-100/40">Aportó {b.contributed.toFixed(2)}€</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-bold ${positive ? 'text-sage-500' : negative ? 'text-clay-500' : 'text-ink-900/50 dark:text-cream-100/50'}`}>
                        {b.balance > 0 ? '+' : ''}{b.balance.toFixed(2)}€
                      </span>
                      {canToggle(m) && (
                        <button onClick={() => toggleActive(m)} className="text-xs font-semibold text-violet-500 hover:underline">
                          De baja
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>

            {inactiveMembers.length > 0 && (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/40 dark:text-cream-100/40 mt-4 mb-2">De baja temporal</p>
                <ul className="flex flex-col gap-2">
                  {inactiveMembers.map((m) => (
                    <li key={m.id} className="flex items-center justify-between px-2 py-2 rounded-xl opacity-60">
                      <span className="text-sm">{m.name}{m.id === user.id ? ' (tú)' : ''}</span>
                      {canToggle(m) && (
                        <button onClick={() => toggleActive(m)} className="text-xs font-semibold text-violet-500 hover:underline">
                          Reactivar
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </Reveal>

        <Reveal delay={120}>
          <section className="card p-5">
            <h2 className="font-display font-semibold mb-3">Historial de aportes</h2>
            {history.length === 0 ? (
              <p className="text-sm text-ink-900/50 dark:text-cream-100/50">Todavía no se ha registrado ningún aporte.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm max-h-80 overflow-y-auto">
                {history.map((c) => (
                  <li key={c.id} className="flex justify-between py-1.5 border-b last:border-0 border-ink-900/10 dark:border-cream-100/15">
                    <span>
                      <strong>{memberById[c.userId]?.name || 'Alguien'}</strong> aportó
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-ink-900/40 dark:text-cream-100/40 text-xs">
                        {format(new Date(c.createdAt), "d MMM, HH:mm", { locale: es })}
                      </span>
                      <span className="font-semibold text-sage-500">+{Number(c.amount).toFixed(2)}€</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Reveal>
      </div>
    </AppLayout>
  )
}
