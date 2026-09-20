import { useMemo, useState } from 'react'
import AppLayout from '../components/AppLayout'
import Reveal from '../components/Reveal'
import PotCalendar from '../components/PotCalendar'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { useLanguage } from '../context/LanguageContext'
import { JarIcon, EditIcon, TrashIcon, ChevronUpIcon, ChevronDownIcon, CloseIcon } from '../components/icons'
import { potAmountColorClass, potAmountBubbleMessage, isPotAdjustment } from '../lib/pot'
import { computeWallets } from '../lib/wallets'
import { format } from 'date-fns'

export default function Wallet() {
  const { user, membership } = useAuth()
  const {
    floor,
    members,
    potContributions,
    addPotContribution,
    addPotExpense,
    updatePotExpense,
    deletePotExpense,
    polls,
    pollVotes,
    walletResets,
    resetMyWallet,
    proposeWalletResetForAll,
    pendingBalanceResetPoll,
    pendingPotAdjustmentPoll,
    requestPotAdjustment,
    castVote,
    closePoll
  } = useData()
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
  // Modificación manual del importe: pop-up de 2 pasos (cantidad →
  // confirmación) que solo ENVÍA una solicitud a todo el piso, nunca
  // cambia el Pote directo (ver PotAdjustDialog / requestPotAdjustment).
  const [showAdjustDialog, setShowAdjustDialog] = useState(false)
  // "Reiniciar saldo": solo para mí (al instante) o para todos (consulta en Votaciones).
  const [showResetDialog, setShowResetDialog] = useState(false)

  // Wallet de cada persona: suma lo que aporta y resta su parte de cada
  // gasto (Pote o Compras), repartido en partes iguales — ver lib/wallets.js.
  const wallets = useMemo(() => computeWallets(members, potContributions, walletResets), [members, potContributions, walletResets])

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

  // Historial: los movimientos del pote, más cada reinicio de saldo (individual
  // o aprobado por consulta) y cada propuesta de reinicio para todos.
  const history = useMemo(
    () =>
      [
        ...potContributions.map((c) => ({ type: 'pot', id: c.id, createdAt: c.createdAt, c })),
        ...walletResets.map((r) => ({ type: 'reset', id: `reset-${r.id}`, createdAt: r.createdAt, r })),
        ...polls.filter((p) => p.kind === 'balance_reset').map((p) => ({ type: 'proposal', id: `proposal-${p.id}`, createdAt: p.createdAt, p }))
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [potContributions, walletResets, polls]
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
                {!pendingPotAdjustmentPoll && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowAdjustDialog(true)
                    }}
                    className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-ink-900/40 dark:text-cream-100/40 hover:text-violet-500"
                  >
                    <EditIcon className="w-3 h-3 shrink-0" />
                    {t('wallet.adjustButton')}
                  </button>
                )}
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

      {pendingPotAdjustmentPoll && (
        <Reveal delay={60}>
          <div className="mb-5">
            <PotAdjustmentRequestCard
              poll={pendingPotAdjustmentPoll}
              votes={pollVotes.filter((v) => v.pollId === pendingPotAdjustmentPoll.id)}
              members={members}
              user={user}
              isAdmin={isAdmin}
              castVote={castVote}
              closePoll={closePoll}
              t={t}
              dateLocale={dateLocale}
            />
          </div>
        </Reveal>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        <Reveal delay={80}>
          <section className="card p-5">
            <h2 className="font-display font-semibold mb-1">{t('wallet.balancePerPersonTitle')}</h2>
            <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-4">{t('wallet.balanceLegend')}</p>
            <ul className="flex flex-col gap-2">
              {members.map((m) => {
                const w = wallets[m.id] || { contributed: 0, expenseShare: 0, balance: 0 }
                const positive = w.balance >= 0.01
                const negative = w.balance <= -0.01
                return (
                  <li key={m.id} className="flex items-center justify-between gap-2 px-2 py-2 rounded-xl bg-cream-100 dark:bg-ink-700">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-700/25 text-violet-600 dark:text-violet-200 flex items-center justify-center text-xs font-bold shrink-0">
                        {m.name[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{m.name}{m.id === user.id ? t('wallet.you') : ''}</p>
                        <p className="text-xs text-ink-900/40 dark:text-cream-100/40">
                          {t('wallet.walletBreakdown', { contributed: w.contributed.toFixed(2), share: w.expenseShare.toFixed(2) })}
                          {w.resetAdjustment !== undefined &&
                            ` · ${t('wallet.walletResetAdjustment', { amount: `${w.resetAdjustment > 0 ? '+' : ''}${w.resetAdjustment.toFixed(2)}` })}`}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${positive ? 'text-sage-500' : negative ? 'text-clay-500' : 'text-ink-900/50 dark:text-cream-100/50'}`}>
                      {w.balance > 0 ? '+' : ''}{w.balance.toFixed(2)}€
                    </span>
                  </li>
                )
              })}
            </ul>
            {/* Acción discreta, como el "Ajustar importe" del total del Pote */}
            <button
              type="button"
              onClick={() => setShowResetDialog(true)}
              className="mt-3 text-xs font-semibold text-ink-900/40 dark:text-cream-100/40 hover:text-violet-500 hover:underline"
            >
              {t('wallet.resetButton')}
            </button>
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
                  {history.map((item) =>
                    item.type === 'reset' ? (
                      <ResetHistoryRow key={item.id} reset={item.r} name={memberById[item.r.userId]?.name || t('wallet.someone')} t={t} dateLocale={dateLocale} />
                    ) : item.type === 'proposal' ? (
                      <ResetProposalRow key={item.id} poll={item.p} name={memberById[item.p.createdBy]?.name || t('wallet.someone')} t={t} dateLocale={dateLocale} />
                    ) : (
                      <HistoryRow
                        key={item.id}
                        contribution={item.c}
                        authorName={memberById[item.c.userId]?.name || t('wallet.someone')}
                        canManage={!isPotAdjustment(item.c) && item.c.userId === user.id && Number(item.c.amount) < 0 && Date.now() - new Date(item.c.createdAt).getTime() < 24 * 60 * 60 * 1000}
                        onUpdate={updatePotExpense}
                        onDelete={deletePotExpense}
                        t={t}
                        dateLocale={dateLocale}
                      />
                    )
                  )}
                </ul>
              ))}
          </section>
        </Reveal>
      </div>

      {pendingAction && (
        <ConfirmPotDialog action={pendingAction} onCancel={() => setPendingAction(null)} onConfirm={confirmPending} t={t} />
      )}

      {showResetDialog && (
        <WalletResetDialog
          hasPendingProposal={!!pendingBalanceResetPoll}
          onCancel={() => setShowResetDialog(false)}
          onConfirm={async (scope, newBalance) => {
            if (scope === 'self') {
              await resetMyWallet(newBalance)
              showToast(t('wallet.resetSelfToast', { amount: newBalance.toFixed(2) }), 'success')
            } else {
              await proposeWalletResetForAll(newBalance)
              showToast(t('wallet.resetAllToast'), 'success')
            }
            setShowResetDialog(false)
          }}
          t={t}
        />
      )}

      {showAdjustDialog && (
        <PotAdjustDialog
          currentAmount={Number(floor?.potAmount ?? 0)}
          onCancel={() => setShowAdjustDialog(false)}
          onSend={async (newAmount) => {
            await requestPotAdjustment(newAmount)
            setShowAdjustDialog(false)
            showToast(t('wallet.adjustSentToast'), 'success')
          }}
          t={t}
        />
      )}
    </AppLayout>
  )
}

/** Pop-up de 2 pasos para pedir un nuevo importe del Pote: (1) escribir
 * la cantidad (0 para ponerlo a cero), (2) leer qué va a pasar y
 * confirmar el envío. Aquí NO se cambia el Pote — solo se envía una
 * solicitud que debe aprobar todo el piso (ver requestPotAdjustment). */
function PotAdjustDialog({ currentAmount, onCancel, onSend, t }) {
  const [step, setStep] = useState('input')
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)

  const parsed = value === '' ? null : Math.round(Number(value) * 100) / 100
  const invalid = parsed === null || !Number.isFinite(parsed) || parsed < 0
  const sameAsCurrent = !invalid && parsed === Math.round(currentAmount * 100) / 100

  async function handleSend() {
    setSending(true)
    try {
      await onSend(parsed)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm flex items-end sm:items-center sm:justify-center" onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm sm:rounded-2xl bg-cream-100 dark:bg-ink-800 border-t-[2.5px] sm:border-2 border-ink-900 dark:border-cream-100/40 rounded-t-2xl p-5 pb-8 sm:pb-5 relative max-h-[90vh] overflow-y-auto"
      >
        <div className="w-9 h-1.5 rounded-full bg-ink-900/15 dark:bg-cream-100/15 mx-auto mb-4 sm:hidden" />
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700"
        >
          <CloseIcon className="w-4 h-4" />
        </button>

        {step === 'input' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!invalid && !sameAsCurrent) setStep('confirm')
            }}
          >
            <h3 className="font-display text-lg font-bold mb-1 pr-8">{t('wallet.adjustTitle')}</h3>
            <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-1">{t('wallet.adjustBody')}</p>
            <p className="text-xs font-semibold text-ink-900/50 dark:text-cream-100/50 mb-4">
              {t('wallet.adjustCurrent', { amount: currentAmount.toFixed(2) })}
            </p>
            <label className="text-sm block mb-1">
              {t('wallet.adjustInputLabel')}
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="input mt-1"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
                required
              />
            </label>
            {sameAsCurrent && <p className="text-xs font-semibold text-clay-500 mb-1">{t('wallet.adjustSameAmount')}</p>}
            <div className="flex gap-2 mt-4">
              <button type="button" className="btn-secondary text-sm flex-1" onClick={onCancel}>
                {t('wallet.cancel')}
              </button>
              <button type="submit" className="btn-primary text-sm flex-1" disabled={invalid || sameAsCurrent}>
                {t('wallet.adjustContinue')}
              </button>
            </div>
          </form>
        ) : (
          <>
            <h3 className="font-display text-lg font-bold mb-2 pr-8">{t('wallet.adjustConfirmTitle')}</h3>
            <div className="text-sm text-ink-900/70 dark:text-cream-100/70 flex flex-col gap-2 mb-5">
              <p className="font-semibold text-ink-900 dark:text-cream-100">
                {t('wallet.adjustConfirmLine1', { amount: parsed.toFixed(2) })}
              </p>
              <p>{t('wallet.adjustConfirmLine2')}</p>
              <p>{t('wallet.adjustConfirmLine3')}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary text-sm flex-1" onClick={() => setStep('input')} disabled={sending}>
                {t('wallet.adjustBack')}
              </button>
              <button type="button" className="btn-primary text-sm flex-1" onClick={handleSend} disabled={sending}>
                {sending ? t('wallet.saving') : t('wallet.adjustSend')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Estado de una solicitud de modificación del Pote en curso: quién la
 * pidió, a qué importe, quién ya aprobó y a quién le falta. Cada
 * conviviente aprueba o rechaza desde acá (también aparece en
 * Votaciones); un solo rechazo la tumba, se aplica solo cuando aprueban
 * todos. */
function PotAdjustmentRequestCard({ poll, votes, members, user, isAdmin, castVote, closePoll, t, dateLocale }) {
  const requester = members.find((m) => m.id === poll.createdBy)
  const voteByUser = Object.fromEntries(votes.map((v) => [v.userId, v.option]))
  const approvedNames = members.filter((m) => voteByUser[m.id] === 'Aprobar').map((m) => m.name)
  const pendingNames = members.filter((m) => !voteByUser[m.id]).map((m) => m.name)
  const myVote = voteByUser[user?.id]
  const newAmount = Number(poll.payload?.newAmount ?? 0)
  const canCancel = poll.createdBy === user?.id || isAdmin

  async function handleCancel() {
    if (!confirm(t('wallet.adjustCancelConfirm'))) return
    await closePoll(poll.id)
  }

  return (
    <div className="card p-5 border-gold-500/60">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 mb-2">
        <h2 className="font-display font-semibold min-w-0">{t('wallet.adjustPendingTitle')}</h2>
        <span className="text-[10px] uppercase font-bold text-gold-500 bg-gold-400/15 px-2 py-1 rounded-md shrink-0">
          {t('wallet.adjustPendingBadge')}
        </span>
      </div>
      <p className="text-sm text-ink-900/70 dark:text-cream-100/70">
        {t('wallet.adjustRequestedBy', { name: requester?.name || t('wallet.someone') })}
      </p>
      <p className="font-display text-lg font-bold my-1">{t('wallet.adjustProposes', { amount: newAmount.toFixed(2) })}</p>
      {poll.deadlineAt && (
        <p className="text-xs text-ink-900/50 dark:text-cream-100/50 mb-3">
          {t('wallet.adjustDeadline', { date: format(new Date(poll.deadlineAt), 'd MMM, HH:mm', { locale: dateLocale }) })}
        </p>
      )}

      <div className="flex flex-col gap-1.5 text-sm mb-4">
        <p>
          <span className="font-semibold text-sage-500">{t('wallet.adjustApprovedBy')}:</span>{' '}
          {approvedNames.length ? approvedNames.join(', ') : '—'}
        </p>
        <p>
          <span className="font-semibold text-gold-500">{t('wallet.adjustStillPending')}:</span>{' '}
          {pendingNames.length ? pendingNames.join(', ') : '—'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!myVote && (
          <>
            <button type="button" className="btn-danger text-sm" onClick={() => castVote(poll.id, 'Rechazar')}>
              {t('wallet.adjustReject')}
            </button>
            <button type="button" className="btn-primary text-sm" onClick={() => castVote(poll.id, 'Aprobar')}>
              {t('wallet.adjustApprove')}
            </button>
          </>
        )}
        {myVote === 'Aprobar' && (
          <>
            <span className="text-sm font-semibold text-sage-500">{t('wallet.adjustYouApproved')}</span>
            <button type="button" className="text-xs font-semibold text-clay-500 hover:underline" onClick={() => castVote(poll.id, 'Rechazar')}>
              {t('wallet.adjustChangeToReject')}
            </button>
          </>
        )}
        {canCancel && (
          <button type="button" onClick={handleCancel} className="text-xs font-semibold text-violet-500 hover:underline ml-auto">
            {t('wallet.adjustCancel')}
          </button>
        )}
      </div>
    </div>
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

/** "Reiniciar saldo": (1) elegir para quién — solo para mí o para todos —
 * y (2) el nuevo saldo (0 por defecto, editable). "Solo para mí" cambia
 * únicamente el saldo propio, al instante. "Para todos" NO cambia ningún
 * saldo: crea una consulta en Votaciones y solo se modifica el saldo de
 * quien la apruebe (ver proposeWalletResetForAll). */
function WalletResetDialog({ hasPendingProposal, onCancel, onConfirm, t }) {
  const [scope, setScope] = useState(null) // 'self' | 'all'
  const [value, setValue] = useState('0')
  const [sending, setSending] = useState(false)

  const parsed = value.trim() === '' ? null : Math.round(Number(value) * 100) / 100
  const invalid = parsed === null || !Number.isFinite(parsed)
  const canSubmit = scope !== null && !invalid && !(scope === 'all' && hasPendingProposal)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setSending(true)
    try {
      await onConfirm(scope, parsed)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm flex items-end sm:items-center sm:justify-center" onClick={onCancel}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm sm:rounded-2xl bg-cream-100 dark:bg-ink-800 border-t-[2.5px] sm:border-2 border-ink-900 dark:border-cream-100/40 rounded-t-2xl p-5 pb-8 sm:pb-5 relative max-h-[90vh] overflow-y-auto"
      >
        <div className="w-9 h-1.5 rounded-full bg-ink-900/15 dark:bg-cream-100/15 mx-auto mb-4 sm:hidden" />
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700"
        >
          <CloseIcon className="w-4 h-4" />
        </button>

        <h3 className="font-display text-lg font-bold mb-3 pr-8">{t('wallet.resetTitle')}</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {['self', 'all'].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setScope(opt)}
              className={`text-left text-sm font-semibold px-3 py-2.5 rounded-xl border-2 ${
                scope === opt
                  ? 'bg-gold-100 dark:bg-gold-400/25 border-ink-900 dark:border-cream-100/50 text-ink-900 dark:text-cream-100'
                  : 'border-ink-900/15 dark:border-cream-100/20 text-ink-900/70 dark:text-cream-100/70'
              }`}
            >
              {opt === 'self' ? t('wallet.resetOptionSelf') : t('wallet.resetOptionAll')}
            </button>
          ))}
        </div>

        {scope && (
          <>
            <label className="text-sm block mb-2">
              {t('wallet.resetAmountLabel')}
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                className="input mt-1"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
              />
            </label>
            <p className="text-xs text-ink-900/60 dark:text-cream-100/60 mb-2">
              {scope === 'self' ? t('wallet.resetSelfHint') : t('wallet.resetAllHint')}
            </p>
            {scope === 'all' && hasPendingProposal && (
              <p className="text-xs font-semibold text-clay-500 mb-2">{t('wallet.resetAllPending')}</p>
            )}
          </>
        )}

        <div className="flex gap-2 mt-4">
          <button type="button" className="btn-secondary text-sm flex-1" onClick={onCancel} disabled={sending}>
            {t('wallet.cancel')}
          </button>
          <button type="submit" className="btn-primary text-sm flex-1" disabled={!canSubmit || sending}>
            {sending ? t('wallet.saving') : scope === 'all' ? t('wallet.resetSubmitAll') : scope === 'self' ? t('wallet.resetSubmitSelf') : t('wallet.resetSubmitNone')}
          </button>
        </div>
      </form>
    </div>
  )
}

/** Fila del historial: alguien reinició su propio saldo — individualmente
 * ("Solo para mí") o al aprobar una propuesta "para todos". */
function ResetHistoryRow({ reset: r, name, t, dateLocale }) {
  return (
    <li className="py-2 border-b last:border-0 border-ink-900/10 dark:border-cream-100/15">
      <div className="flex justify-between text-sm gap-2">
        <span className="min-w-0">
          {t(r.scope === 'poll' ? 'wallet.historyResetPoll' : 'wallet.historyResetSelf', { name, amount: Number(r.newBalance).toFixed(2) })}
        </span>
        <span className="text-ink-900/40 dark:text-cream-100/40 text-xs shrink-0">
          {format(new Date(r.createdAt), 'd MMM, HH:mm', { locale: dateLocale })}
        </span>
      </div>
    </li>
  )
}

/** Fila del historial: alguien propuso reiniciar el saldo de todos (la
 * consulta vive en Votaciones; acá queda constancia del importe y su estado). */
function ResetProposalRow({ poll, name, t, dateLocale }) {
  const status =
    poll.status === 'pending' ? t('wallet.resetProposalPending') : poll.status === 'expired' ? t('wallet.resetProposalExpired') : t('wallet.resetProposalDone')
  return (
    <li className="py-2 border-b last:border-0 border-ink-900/10 dark:border-cream-100/15">
      <div className="flex justify-between text-sm gap-2">
        <span className="min-w-0">
          <strong>{t('wallet.historyResetProposal', { name, amount: Number(poll.payload?.newBalance ?? 0).toFixed(2) })}</strong>
        </span>
        <span className="text-ink-900/40 dark:text-cream-100/40 text-xs shrink-0">
          {format(new Date(poll.createdAt), 'd MMM, HH:mm', { locale: dateLocale })}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-900/50 dark:text-cream-100/50">{status}</p>
    </li>
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

  if (isPotAdjustment(c)) {
    return (
      <li className="py-2 border-b last:border-0 border-ink-900/10 dark:border-cream-100/15">
        <div className="flex justify-between text-sm gap-2">
          <span className="min-w-0">
            <strong>{t('wallet.manualAdjustment')}</strong>
          </span>
          <span className="flex items-center gap-2 shrink-0">
            <span className="text-ink-900/40 dark:text-cream-100/40 text-xs">
              {format(new Date(c.createdAt), 'd MMM, HH:mm', { locale: dateLocale })}
            </span>
            <span className="font-semibold text-violet-500">
              {Number(c.amount) > 0 ? '+' : '-'}
              {Math.abs(Number(c.amount)).toFixed(2)}€
            </span>
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-900/50 dark:text-cream-100/50">
          {c.note && <span>{c.note} · </span>}
          {t('wallet.manualAdjustmentApproved')}
        </p>
      </li>
    )
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
