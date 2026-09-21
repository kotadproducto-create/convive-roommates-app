import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '../context/LanguageContext'
import { VIRTUAL_COLORS } from '../lib/virtualMembers'
import { CloseIcon } from './icons'

/** Etiqueta "Perfil virtual": distingue a una persona del piso sin cuenta de un usuario real. */
export function VirtualTag({ className = '' }) {
  const { t } = useLanguage()
  return (
    <span
      className={`inline-block align-middle text-[10px] uppercase font-bold tracking-wide px-1.5 py-0.5 rounded-md border border-dashed border-ink-900/30 dark:border-cream-100/30 text-ink-900/60 dark:text-cream-100/60 whitespace-nowrap ${className}`}
    >
      {t('virtual.tag')}
    </span>
  )
}

/** Marco común de los pop-ups (portal en document.body: ver CLAUDE.md sobre `fixed` dentro de tarjetas). */
function Sheet({ title, onClose, children, layer = 'z-40' }) {
  return createPortal(
    <div
      className={`fixed inset-0 ${layer} bg-ink-900/40 backdrop-blur-sm flex items-end sm:items-center sm:justify-center`}
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm sm:rounded-2xl bg-cream-100 dark:bg-ink-800 border-t-[2.5px] sm:border-2 border-ink-900 dark:border-cream-100/40 rounded-t-2xl p-5 pb-8 sm:pb-5 relative max-h-[90vh] overflow-y-auto"
      >
        <div className="w-9 h-1.5 rounded-full bg-ink-900/15 dark:bg-cream-100/15 mx-auto mb-4 sm:hidden" />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
        <h3 className="font-display text-lg font-bold mb-2 pr-8">{title}</h3>
        {children}
      </div>
    </div>,
    document.body
  )
}

/**
 * Crear o editar un perfil virtual (solo admins): nombre y un color. Sin foto:
 * si la persona se une de verdad, tendrá su perfil normal (ver "Vincular").
 */
export function VirtualMemberFormDialog({ member, onSubmit, onClose }) {
  const { t } = useLanguage()
  const editing = Boolean(member)
  const [name, setName] = useState(member?.name || '')
  const [color, setColor] = useState(member?.color || VIRTUAL_COLORS[0])
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setWorking(true)
    setError('')
    try {
      await onSubmit(name.trim(), color)
      onClose()
    } catch (err) {
      console.error('virtual member', err)
      setError(t('floorSettings.virtual.error'))
    } finally {
      setWorking(false)
    }
  }

  return (
    <Sheet title={editing ? t('floorSettings.virtual.editTitle') : t('floorSettings.virtual.createTitle')} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {!editing && <p className="text-sm text-ink-900/70 dark:text-cream-100/70">{t('floorSettings.virtual.createBody')}</p>}
        <label className="text-sm">
          {t('floorSettings.virtual.nameLabel')}
          <input className="input mt-1" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoFocus required />
        </label>
        <div>
          <p className="text-sm mb-1.5">{t('floorSettings.virtual.colorLabel')}</p>
          <div className="flex flex-wrap gap-2">
            {VIRTUAL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={c}
                aria-pressed={color === c}
                className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-ink-900 dark:border-cream-100 ring-2 ring-offset-2 ring-ink-900/30' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        {error && <p className="text-sm font-medium text-clay-500">{error}</p>}
        <div className="flex gap-2 mt-1">
          <button type="button" className="btn-secondary text-sm flex-1" onClick={onClose} disabled={working}>
            {t('floorSettings.cancel')}
          </button>
          <button type="submit" className="btn-primary text-sm flex-1" disabled={working || !name.trim()}>
            {editing ? t('floorSettings.virtual.save') : t('floorSettings.virtual.create')}
          </button>
        </div>
      </form>
    </Sheet>
  )
}

/**
 * Pop-up "¿Seguro?" para las acciones que no se pueden deshacer (quitar o
 * vincular un perfil virtual). Reemplaza al confirm() del navegador, que en
 * varios navegadores móviles y webviews está bloqueado y siempre responde "no".
 */
export function ConfirmVirtualDialog({ title, body, confirmLabel, workingLabel, danger = false, onConfirm, onClose, layer = 'z-40' }) {
  const { t } = useLanguage()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    setWorking(true)
    setError('')
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      console.error('confirm virtual action', err)
      setError(t('floorSettings.virtual.error'))
      setWorking(false)
    }
  }

  return (
    <Sheet title={title} onClose={working ? () => {} : onClose} layer={layer}>
      <p className="text-sm text-ink-900/70 dark:text-cream-100/70 mb-5">{body}</p>
      {error && <p className="text-sm font-medium text-clay-500 mb-3">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-secondary text-sm flex-1" onClick={onClose} disabled={working}>
          {t('floorSettings.cancel')}
        </button>
        <button type="button" className={`text-sm flex-1 ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={handleConfirm} disabled={working}>
          {working ? workingLabel : confirmLabel}
        </button>
      </div>
    </Sheet>
  )
}

/**
 * Vincular un perfil virtual con la cuenta real de la misma persona (cuando por
 * fin se une a la app): sus turnos, historial, Pote y lugar en la rotación pasan
 * a esa cuenta, y el perfil virtual desaparece. Se elige entre los miembros
 * reales del piso.
 */
export function LinkVirtualDialog({ virtual, realCandidates, onLink, onClose }) {
  const { t } = useLanguage()
  const [realId, setRealId] = useState('')
  const [confirming, setConfirming] = useState(false)
  const realName = realCandidates.find((m) => m.id === realId)?.name || ''

  return (
    <Sheet title={t('floorSettings.virtual.linkTitle', { name: virtual.name })} onClose={onClose}>
      {realCandidates.length === 0 ? (
        <>
          <p className="text-sm text-ink-900/70 dark:text-cream-100/70 mb-4">{t('floorSettings.virtual.linkNone', { name: virtual.name })}</p>
          <button type="button" className="btn-secondary text-sm w-full" onClick={onClose}>
            {t('floorSettings.virtual.close')}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-900/70 dark:text-cream-100/70 mb-3">{t('floorSettings.virtual.linkBody', { name: virtual.name })}</p>
          <label className="text-sm block mb-3">
            {t('floorSettings.virtual.linkPick')}
            <select className="input mt-1" value={realId} onChange={(e) => setRealId(e.target.value)}>
              <option value="">—</option>
              {realCandidates.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-sm flex-1" onClick={onClose}>
              {t('floorSettings.cancel')}
            </button>
            <button type="button" className="btn-primary text-sm flex-1" onClick={() => setConfirming(true)} disabled={!realId}>
              {t('floorSettings.virtual.linkConfirm')}
            </button>
          </div>
          {confirming && (
            <ConfirmVirtualDialog
              layer="z-50"
              title={t('floorSettings.virtual.linkSureTitle')}
              body={t('floorSettings.virtual.linkSureBody', { name: virtual.name, real: realName })}
              confirmLabel={t('floorSettings.virtual.linkSureYes')}
              workingLabel={t('floorSettings.virtual.linking')}
              onConfirm={async () => {
                await onLink(virtual.id, realId)
                onClose()
              }}
              onClose={() => setConfirming(false)}
            />
          )}
        </>
      )}
    </Sheet>
  )
}
