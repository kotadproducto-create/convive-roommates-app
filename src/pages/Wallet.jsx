import { useMemo, useState } from 'react'
import AppLayout from '../components/AppLayout'
import Reveal from '../components/Reveal'
import PotCalendar from '../components/PotCalendar'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { JarIcon, EditIcon, TrashIcon } from '../components/icons'
import { potAmountColorClass } from '../lib/pot'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Wallet() {
  const { user, membership } = useAuth()
  const { floor, members, potContributions, addPotContribution, addPotExpense, updatePotExpense, deletePotExpense, setMemberPotActive } =
    useData()
  const { showToast } = useToast()
  const isAdmin = membership?.role === 'admin'
  const [amount, setAmount] = useState(floor?.potPerPerson || 10)

  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseNote, setExpenseNote] = useState('')
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState(null)
  const [submittingExpense, setSubmittingExpense] = useState(false)

  const activeMembers = useMemo(() => members.filter((m) => m.potActive !== false), [members])
  const inactiveMembers = useMemo(() => members.filter((m) => m.potActive === false), [members])

  // Solo los aportes (montos positivos) cuentan para el saldo personal de
  // cada quien. Los gastos son del grupo, no una deuda de quien los registra.
  const aportes = useMemo(() => potContributions.filter((c) => Number(c.amount) > 0), [potContributions])

  const balances = useMemo(() => {
    const totalsByUser = {}
    for (const c of aportes) {
      totalsByUser[c.userId] = (totalsByUser[c.userId] || 0) + Number(c.amount)
    }
    const activeIds = new Set(activeMembers.map((m) => m.id))
    const totalAmongActive = aportes
      .filter((c) => activeIds.has(c.userId))
      .reduce((sum, c) => sum + Number(c.amount), 0)
    const fairShare = activeMembers.length ? totalAmongActive / activeMembers.length : 0
    const byId = {}
    for (const m of activeMembers) {
      byId[m.id] = { contributed: totalsByUser[m.id] || 0, fairShare, balance: (totalsByUser[m.id] || 0) - fairShare }
    }
    return byId
  }, [aportes, activeMembers])

  async function handleContribute() {
    await addPotContribution(amount)
    showToast(`¡Aportaste ${amount}€ al pote!`, 'success')
  }

  function handleReceiptChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setReceiptFile(file)
    const reader = new FileReader()
    reader.onload = () => setReceiptPreview(reader.result)
    reader.readAsDataURL(file)
  }

  async function handleSubmitExpense(e) {
    e.preventDefault()
    if (!expenseAmount || Number(expenseAmount) <= 0) return
    setSubmittingExpense(true)
    try {
      await addPotExpense(expenseAmount, { note: expenseNote.trim() || null, receiptFile })
      showToast(`Registraste un gasto de ${expenseAmount}€`, 'default')
      setExpenseAmount('')
      setExpenseNote('')
      setReceiptFile(null)
      setReceiptPreview(null)
      setShowExpenseForm(false)
    } catch (err) {
      showToast('No se pudo registrar el gasto: ' + err.message, 'default')
    } finally {
      setSubmittingExpense(false)
    }
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
        <div className="mb-5">
          <PotCalendar contributions={potContributions} memberById={memberById} />
        </div>
      </Reveal>

      <Reveal delay={40}>
        <div className="card p-5 mb-5 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gold-100 dark:bg-gold-400/20 text-gold-500 flex items-center justify-center shrink-0">
                <JarIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50">Total del pote</p>
                <p className={`text-2xl font-display font-bold ${potAmountColorClass(floor?.potAmount ?? 0)}`}>{floor?.potAmount ?? 0}€</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input type="number" className="input w-24" value={amount} min={1} onChange={(e) => setAmount(e.target.value)} />
              <button className="btn-primary text-sm" onClick={handleContribute}>
                Aportar
              </button>
              <button className="btn-secondary text-sm" onClick={() => setShowExpenseForm((s) => !s)}>
                {showExpenseForm ? 'Cancelar' : 'Gastos'}
              </button>
            </div>
          </div>

          {showExpenseForm && (
            <form onSubmit={handleSubmitExpense} className="flex flex-col gap-3 pt-4 border-t border-ink-900/10 dark:border-cream-100/15">
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="input"
                  placeholder="Monto gastado (€)"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  required
                />
                <label className="btn-secondary text-sm cursor-pointer justify-self-start">
                  📷 {receiptFile ? 'Cambiar factura' : 'Añadir factura (opcional)'}
                  <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleReceiptChange} />
                </label>
              </div>
              {receiptPreview && <img src={receiptPreview} alt="Factura" className="w-20 h-20 object-cover rounded-lg" />}
              <textarea
                className="input min-h-16"
                placeholder="Nota (opcional): ej. 2x Leche 1.50€, Pan 1.20€ — o solo el total"
                value={expenseNote}
                onChange={(e) => setExpenseNote(e.target.value)}
              />
              <button className="btn-danger text-sm self-start" type="submit" disabled={submittingExpense}>
                {submittingExpense ? 'Guardando…' : 'Registrar gasto'}
              </button>
            </form>
          )}
        </div>
      </Reveal>

      <div className="grid md:grid-cols-2 gap-5 mb-5">
        <Reveal delay={80}>
          <section className="card p-5">
            <h2 className="font-display font-semibold mb-1">Saldo por persona</h2>
            <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-4">
              Verde: aportó de más. Rojo: le falta para llegar a su parte equitativa. Los gastos son del grupo y no afectan este saldo.
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

        <Reveal delay={140}>
          <section className="card p-5">
            <h2 className="font-display font-semibold mb-3">Historial de movimientos</h2>
            {history.length === 0 ? (
              <p className="text-sm text-ink-900/50 dark:text-cream-100/50">Todavía no se ha registrado ningún movimiento.</p>
            ) : (
              <ul className="flex flex-col gap-2 max-h-96 overflow-y-auto">
                {history.map((c) => (
                  <HistoryRow
                    key={c.id}
                    contribution={c}
                    authorName={memberById[c.userId]?.name || 'Alguien'}
                    canManage={c.userId === user.id && Number(c.amount) < 0 && Date.now() - new Date(c.createdAt).getTime() < 24 * 60 * 60 * 1000}
                    onUpdate={updatePotExpense}
                    onDelete={deletePotExpense}
                  />
                ))}
              </ul>
            )}
          </section>
        </Reveal>
      </div>
    </AppLayout>
  )
}

function HistoryRow({ contribution: c, authorName, canManage, onUpdate, onDelete }) {
  const isExpense = Number(c.amount) < 0
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState(Math.abs(Number(c.amount)))
  const [note, setNote] = useState(c.note || '')
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return
    setSaving(true)
    try {
      await onUpdate(c.id, { amount, note: note.trim() || null })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  function handleDelete() {
    if (confirm('¿Eliminar este gasto? El total del pote se ajustará.')) {
      onDelete(c.id)
    }
  }

  if (editing) {
    return (
      <li className="py-2 border-b last:border-0 border-ink-900/10 dark:border-cream-100/15">
        <form onSubmit={handleSave} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="input text-sm flex-1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <input className="input text-sm" placeholder="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-xs flex-1" onClick={() => setEditing(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary text-xs flex-1" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="py-2 border-b last:border-0 border-ink-900/10 dark:border-cream-100/15">
      <div className="flex justify-between text-sm gap-2">
        <span className="min-w-0">
          <strong>{authorName}</strong> {isExpense ? 'gastó' : 'aportó'}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <span className="text-ink-900/40 dark:text-cream-100/40 text-xs">
            {format(new Date(c.createdAt), "d MMM, HH:mm", { locale: es })}
          </span>
          <span className={`font-semibold ${isExpense ? 'text-clay-500' : 'text-sage-500'}`}>
            {isExpense ? '-' : '+'}
            {Math.abs(Number(c.amount)).toFixed(2)}€
          </span>
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-ink-900/50 dark:text-cream-100/50 min-w-0">
          {c.note && <span className="truncate">{c.note}</span>}
          {c.receiptUrl && (
            <a href={c.receiptUrl} target="_blank" rel="noreferrer" className="font-semibold text-violet-500 hover:underline shrink-0">
              Ver factura
            </a>
          )}
        </div>
        {canManage && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setEditing(true)}
              title="Editar (disponible 24h)"
              className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700"
            >
              <EditIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              title="Eliminar (disponible 24h)"
              className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700 text-clay-500"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </li>
  )
}
