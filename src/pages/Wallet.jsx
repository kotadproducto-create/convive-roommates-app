import { useMemo, useState } from 'react'
import AppLayout from '../components/AppLayout'
import Reveal from '../components/Reveal'
import PotCalendar from '../components/PotCalendar'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { useLanguage } from '../context/LanguageContext'
import { JarIcon, EditIcon, TrashIcon, ChevronUpIcon, ChevronDownIcon } from '../components/icons'
import { potAmountColorClass, potAmountBubbleMessage } from '../lib/pot'
import { format } from 'date-fns'

export default function Wallet() {
  const { user, membership } = useAuth()
  const { floor, members, potContributions, addPotContribution, addPotExpense, updatePotExpense, deletePotExpense, setMemberPotActive } =
    useData()
  const { showToast } = useToast()
  const { t, dateLocale } = useLanguage()
  const isAdmin = membership?.role === 'admin'
  const [amount, setAmount] = useState(floor?.potPerPerson || 10)

  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseNote, setExpenseNote] = useState('')
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState(null)
  const [submittingExpense, setSubmittingExpense] = useState(false)
  // Acción de aporte/gasto pendiente de confirmar en el pop-up — no se
  // toca el pote hasta que la persona confirma ahí (ver ConfirmPotDialog).
  const [pendingAction, setPendingAction] = useState(null)
  // Historial de movimientos: oculto por defecto para no ocupar espacio;
  // se despliega/oculta sin perder ni afectar ningún movimiento (los datos
  // ya están cargados, esto solo alterna si se muestran).
  const [showHistory, setShowHistory] = useState(false)

  const activeMembers = useMemo(() => members.filter((m) => m.potActive !== false), [members])
  const inactiveMembers = useMemo(() => members.filter((m) => m.potActive === false), [members])

  // Quien ya aportó o registró un gasto no puede marcarse "De baja": una
  // vez que participó en el pote, ya está "adentro" — para salirse de
  // verdad está el mecanismo de "Estoy fuera" en Convives (con fecha de
  // regreso), no este toggle manual pensado para alguien que todavía no
  // había empezado a participar.
  const hasPotActivity = useMemo(() => new Set(potContributions.map((c) => c.userId)), [potContributions])

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

  // El aporte y el gasto ya no ejecutan directo al pulsar el botón — solo
  // abren el pop-up de confirmación (ConfirmPotDialog); la operación real
  // vive en confirmPending(), que se dispara al pulsar "Confirmar" ahí.
  function requestContribute() {
    if (!amount || Number(amount) <= 0) return
    setPendingAction({ type: 'contribute', amount })
  }

  function handleReceiptChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setReceiptFile(file)
    const reader = new FileReader()
    reader.onload = () => setReceiptPreview(reader.result)
    reader.readAsDataURL(file)
  }

  function requestExpense(e) {
    e.preventDefault()
    if (!expenseAmount || Number(expenseAmount) <= 0) return
    setPendingAction({ type: 'expense', amount: expenseAmount, note: expenseNote, receiptFile })
  }

  async function confirmPending() {
    if (!pendingAction) return
    if (pendingAction.type === 'contribute') {
      await addPotContribution(pendingAction.amount)
      showToast(t('wallet.contributedToast', { amount: pendingAction.amount }), 'success')
      setPendingAction(null)
      return
    }
    setSubmittingExpense(true)
    try {
      await addPotExpense(pendingAction.amount, { note: pendingAction.note.trim() || null, receiptFile: pendingAction.receiptFile })
      showToast(t('wallet.expenseRecordedToast', { amount: pendingAction.amount }), 'default')
      setExpenseAmount('')
      setExpenseNote('')
      setReceiptFile(null)
      setReceiptPreview(null)
      setShowExpenseForm(false)
      setPendingAction(null)
    } catch (err) {
      showToast(t('wallet.expenseErrorToast', { error: err.message }), 'default')
      setPendingAction(null)
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
    <AppLayout title={t('wallet.title')}>
      <Reveal>
        <div className="mb-5">
          <PotCalendar contributions={potContributions} memberById={memberById} />
        </div>
      </Reveal>

      <Reveal delay={40}>
        <div className="card p-5 mb-5 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div className="flex items-center gap-3 hoverbubble" tabIndex={0}>
              <div className="bubble">{potAmountBubbleMessage(floor?.potAmount ?? 0, t)}</div>
              <div className="w-12 h-12 rounded-xl border-2 border-ink-900/70 dark:border-cream-100/30 bg-gold-100 dark:bg-gold-400/20 text-gold-500 flex items-center justify-center shrink-0">
                <JarIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50">{t('wallet.totalLabel')}</p>
                <p className={`text-2xl font-display font-bold ${potAmountColorClass(floor?.potAmount ?? 0)}`}>{floor?.potAmount ?? 0}€</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!showExpenseForm && (
                <>
                  <input type="number" className="input w-24" value={amount} min={1} onChange={(e) => setAmount(e.target.value)} />
                  <button className="btn-primary text-sm" onClick={requestContribute}>
                    {t('wallet.contribute')}
                  </button>
                </>
              )}
              <button className="btn-secondary text-sm" onClick={() => setShowExpenseForm((s) => !s)}>
                {showExpenseForm ? t('wallet.cancel') : t('wallet.expenses')}
              </button>
            </div>
          </div>

          {showExpenseForm && (
            <form onSubmit={requestExpense} className="flex flex-col gap-3 pt-4 border-t border-ink-900/10 dark:border-cream-100/15">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="input"
                  placeholder={t('wallet.amountSpentPlaceholder')}
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  required
                />
                <label className="btn-secondary text-sm cursor-pointer justify-self-start">
                  📷 {receiptFile ? t('wallet.changeReceipt') : t('wallet.addReceipt')}
                  <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleReceiptChange} />
                </label>
              </div>
              {receiptPreview && <img src={receiptPreview} alt={t('wallet.receiptAlt')} className="w-20 h-20 object-cover rounded-lg" />}
              <textarea
                className="input min-h-16"
                placeholder={t('wallet.notePlaceholder')}
                value={expenseNote}
                onChange={(e) => setExpenseNote(e.target.value)}
              />
              <button className="btn-danger text-sm self-start" type="submit" disabled={submittingExpense}>
                {submittingExpense ? t('wallet.saving') : t('wallet.logExpense')}
              </button>
            </form>
          )}
        </div>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        <Reveal delay={80}>
          <section className="card p-5">
            <h2 className="font-display font-semibold mb-1">{t('wallet.balancePerPersonTitle')}</h2>
            <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-4">{t('wallet.balanceLegend')}</p>
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
                        <p className="text-sm font-medium truncate">{m.name}{m.id === user.id ? t('wallet.you') : ''}</p>
                        <p className="text-xs text-ink-900/40 dark:text-cream-100/40">{t('wallet.contributed', { amount: b.contributed.toFixed(2) })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-bold ${positive ? 'text-sage-500' : negative ? 'text-clay-500' : 'text-ink-900/50 dark:text-cream-100/50'}`}>
                        {b.balance > 0 ? '+' : ''}{b.balance.toFixed(2)}€
                      </span>
                      {canToggle(m) && !hasPotActivity.has(m.id) && (
                        <button onClick={() => toggleActive(m)} className="text-xs font-semibold text-violet-500 hover:underline">
                          {t('wallet.setInactive')}
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>

            {inactiveMembers.length > 0 && (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/40 dark:text-cream-100/40 mt-4 mb-2">{t('wallet.temporarilyInactiveTitle')}</p>
                <ul className="flex flex-col gap-2">
                  {inactiveMembers.map((m) => (
                    <li key={m.id} className="flex items-center justify-between px-2 py-2 rounded-xl opacity-60">
                      <span className="text-sm">{m.name}{m.id === user.id ? t('wallet.you') : ''}</span>
                      {canToggle(m) && (
                        <button onClick={() => toggleActive(m)} className="text-xs font-semibold text-violet-500 hover:underline">
                          {t('wallet.reactivate')}
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
            <button
              type="button"
              onClick={() => setShowHistory((s) => !s)}
              className="w-full flex items-center justify-between gap-2 text-left"
            >
              <h2 className="font-display font-semibold">{t('wallet.historyTitle')}</h2>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-violet-500 shrink-0">
                {showHistory ? t('wallet.hideHistory') : t('wallet.showHistory')}
                {showHistory ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
              </span>
            </button>

            {showHistory &&
              (history.length === 0 ? (
                <p className="text-sm text-ink-900/50 dark:text-cream-100/50 mt-3">{t('wallet.noHistoryYet')}</p>
              ) : (
                <ul className="flex flex-col gap-2 max-h-96 overflow-y-auto mt-3">
                  {history.map((c) => (
                    <HistoryRow
                      key={c.id}
                      contribution={c}
                      authorName={memberById[c.userId]?.name || t('wallet.someone')}
                      canManage={c.userId === user.id && Number(c.amount) < 0 && Date.now() - new Date(c.createdAt).getTime() < 24 * 60 * 60 * 1000}
                      onUpdate={updatePotExpense}
                      onDelete={deletePotExpense}
                      t={t}
                      dateLocale={dateLocale}
                    />
                  ))}
                </ul>
              ))}
          </section>
        </Reveal>
      </div>

      {pendingAction && (
        <ConfirmPotDialog action={pendingAction} onCancel={() => setPendingAction(null)} onConfirm={confirmPending} t={t} />
      )}
    </AppLayout>
  )
}

/** Pop-up de confirmación antes de tocar el pote de verdad — ni aportar
 * ni registrar un gasto ejecutan hasta que la persona confirma acá. */
function ConfirmPotDialog({ action, onCancel, onConfirm, t }) {
  const [submitting, setSubmitting] = useState(false)
  const isExpense = action.type === 'expense'

  async function handleConfirmClick() {
    setSubmitting(true)
    try {
      await onConfirm()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm flex items-end sm:items-center sm:justify-center" onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm sm:rounded-2xl bg-cream-100 dark:bg-ink-800 border-t-[2.5px] sm:border-2 border-ink-900 dark:border-cream-100/40 rounded-t-2xl p-5 pb-8 sm:pb-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="w-9 h-1.5 rounded-full bg-ink-900/15 dark:bg-cream-100/15 mx-auto mb-4 sm:hidden" />
        <h3 className="font-display text-lg font-bold mb-2">{t('wallet.confirmTitle')}</h3>
        <p className="text-sm text-ink-900/70 dark:text-cream-100/70 mb-5">
          {isExpense
            ? t('wallet.confirmExpenseBody', { amount: Number(action.amount).toFixed(2) })
            : t('wallet.confirmContributeBody', { amount: Number(action.amount).toFixed(2) })}
        </p>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary text-sm flex-1" onClick={onCancel} disabled={submitting}>
            {t('wallet.cancel')}
          </button>
          <button
            type="button"
            className={`text-sm flex-1 ${isExpense ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleConfirmClick}
            disabled={submitting}
          >
            {submitting ? t('wallet.saving') : t('wallet.confirmAction')}
          </button>
        </div>
      </div>
    </div>
  )
}

function HistoryRow({ contribution: c, authorName, canManage, onUpdate, onDelete, t, dateLocale }) {
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
    if (confirm(t('wallet.deleteConfirm'))) {
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
          <input className="input text-sm" placeholder={t('wallet.notePlaceholderShort')} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-xs flex-1" onClick={() => setEditing(false)}>
              {t('wallet.cancel')}
            </button>
            <button type="submit" className="btn-primary text-xs flex-1" disabled={saving}>
              {saving ? t('wallet.saving') : t('wallet.save')}
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
          <strong>{authorName}</strong> {isExpense ? t('wallet.spent') : t('wallet.contributedVerb')}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <span className="text-ink-900/40 dark:text-cream-100/40 text-xs">
            {format(new Date(c.createdAt), 'd MMM, HH:mm', { locale: dateLocale })}
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
              {t('wallet.viewReceipt')}
            </a>
          )}
        </div>
        {canManage && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setEditing(true)}
              title={t('wallet.editTitle')}
              className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700"
            >
              <EditIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              title={t('wallet.deleteTitle')}
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
