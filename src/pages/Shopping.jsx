import { useMemo, useState } from 'react'
import AppLayout from '../components/AppLayout'
import Reveal from '../components/Reveal'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { StoreIcon, AlertIcon, EditIcon, TrashIcon, CloseIcon, LinkIcon } from '../components/icons'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

/** Valida que sea una URL http(s) bien formada — no cualquier esquema
 * (bloquea javascript:/data: y similares antes de guardarla como link). */
function isValidHttpUrl(value) {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** Sugerencia de nombre de supermercado a partir del dominio del link
 * (ej. "https://www.mercadona.es/..." → "Mercadona"). Es solo una ayuda
 * para no escribirlo a mano — el campo de supermercado sigue siendo
 * editable libremente, no se garantiza que acierte siempre. */
function guessStoreFromUrl(value) {
  try {
    const host = new URL(value).hostname.replace(/^www\./, '')
    const name = host.split('.')[0]
    return name.charAt(0).toUpperCase() + name.slice(1)
  } catch {
    return ''
  }
}

const STOCK_META = {
  out: { label: 'Agotado', dot: 'bg-clay-500', chip: 'bg-clay-500/15 text-clay-500', order: 0 },
  low: { label: 'Por acabarse', dot: 'bg-gold-500', chip: 'bg-gold-400/20 text-gold-500', order: 1 },
  ok: { label: 'Con stock', dot: 'bg-sage-500', chip: 'bg-sage-500/15 text-sage-500', order: 2 }
}

export default function Shopping() {
  const { user } = useAuth()
  const {
    members,
    tasks,
    shoppingItems,
    shoppingPurchases,
    addShoppingItem,
    updateShoppingItem,
    removeShoppingItem,
    setItemStock,
    markItemPurchased
  } = useData()
  const { showToast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showHistory, setShowHistory] = useState(false)

  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members])
  const comprasTask = tasks.find((t) => t.type === 'compras')
  const shopper = comprasTask ? memberById[comprasTask.assignedUserId] : null
  const isShopper = shopper?.id === user.id

  // Prioridad de compra: primero lo agotado, luego lo que está por
  // acabarse, y al final lo que tiene stock de sobra.
  const sortedItems = useMemo(
    () =>
      shoppingItems
        .slice()
        .sort((a, b) => STOCK_META[a.stockLevel].order - STOCK_META[b.stockLevel].order || a.name.localeCompare(b.name)),
    [shoppingItems]
  )
  const outCount = shoppingItems.filter((i) => i.stockLevel === 'out').length

  const history = useMemo(
    () => shoppingPurchases.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [shoppingPurchases]
  )

  async function handleFormSubmit(values) {
    if (editing) {
      await updateShoppingItem(editing.id, values)
      showToast('Producto actualizado', 'success')
    } else {
      await addShoppingItem(values)
      showToast('Producto agregado a la lista', 'success')
    }
    setShowForm(false)
    setEditing(null)
  }

  return (
    <AppLayout title="Compras">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-lg font-bold">Lista de compras</h2>
          {shopper && (
            <p className="text-sm text-ink-900/60 dark:text-cream-100/60">
              Esta semana compra {isShopper ? <strong>tú</strong> : <strong>{shopper.name}</strong>}.
            </p>
          )}
        </div>
        <button
          className="btn-primary text-sm shrink-0"
          onClick={() => {
            setEditing(null)
            setShowForm((s) => !s)
          }}
        >
          {showForm && !editing ? 'Cancelar' : '+ Producto'}
        </button>
      </div>

      {outCount > 0 && (
        <Reveal>
          <div className="card p-3 mb-4 flex items-center gap-2 border-clay-500/50">
            <AlertIcon className="w-5 h-5 text-clay-500 shrink-0" />
            <p className="text-sm font-medium text-clay-500">
              {outCount} producto{outCount > 1 ? 's' : ''} agotado{outCount > 1 ? 's' : ''}: hace falta reponer.
            </p>
          </div>
        </Reveal>
      )}

      {(showForm || editing) && (
        <Reveal>
          <ItemForm
            initial={editing}
            onCancel={() => {
              setShowForm(false)
              setEditing(null)
            }}
            onSubmit={handleFormSubmit}
          />
        </Reveal>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {sortedItems.map((item, i) => (
          <Reveal key={item.id} delay={i * 40}>
            <ShoppingCard
              item={item}
              onEdit={() => {
                setEditing(item)
                setShowForm(false)
              }}
              onDelete={() => removeShoppingItem(item.id)}
              onSetStock={(level) => setItemStock(item.id, level)}
              onPurchase={(payload) =>
                markItemPurchased(item.id, payload).then(() => showToast(`${item.name} marcado como comprado`, 'success'))
              }
            />
          </Reveal>
        ))}
        {sortedItems.length === 0 && (
          <p className="text-sm text-ink-900/50 dark:text-cream-100/50 col-span-full">
            Todavía no hay productos en la lista. Agrega el primero con "+ Producto".
          </p>
        )}
      </div>

      <div className="card p-5">
        <button type="button" className="flex items-center justify-between w-full" onClick={() => setShowHistory((s) => !s)}>
          <h3 className="font-display font-semibold">Historial de compras</h3>
          <span className="text-xs font-semibold text-violet-500">{showHistory ? 'Ocultar' : 'Ver'}</span>
        </button>
        {showHistory &&
          (history.length === 0 ? (
            <p className="text-sm text-ink-900/50 dark:text-cream-100/50 mt-3">Todavía no se ha comprado nada.</p>
          ) : (
            <ul className="flex flex-col gap-1 mt-3 max-h-72 overflow-y-auto">
              {history.map((p) => (
                <li
                  key={p.id}
                  className="flex justify-between text-sm py-1.5 border-b last:border-0 border-ink-900/10 dark:border-cream-100/15"
                >
                  <span>
                    <strong>{memberById[p.userId]?.name || 'Alguien'}</strong> compró {p.itemName}
                  </span>
                  <span className="text-ink-900/40 dark:text-cream-100/40 text-xs shrink-0 ml-2">
                    {p.price ? `${p.price}€ · ` : ''}
                    {format(new Date(p.createdAt), "d MMM, HH:mm", { locale: es })}
                  </span>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </AppLayout>
  )
}

function ItemForm({ initial, onCancel, onSubmit }) {
  const [name, setName] = useState(initial?.name || '')
  const [store, setStore] = useState(initial?.store || '')
  const [storeLocation, setStoreLocation] = useState(initial?.storeLocation || '')
  const [usualQuantity, setUsualQuantity] = useState(initial?.usualQuantity || '')
  const [recurring, setRecurring] = useState(initial?.recurring !== false)
  const [estimatedPrice, setEstimatedPrice] = useState(initial?.estimatedPrice || '')
  const [note, setNote] = useState(initial?.note || '')
  const [linkUrl, setLinkUrl] = useState(initial?.linkUrl || '')
  const [linkError, setLinkError] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(initial?.imageUrl || null)
  const [saving, setSaving] = useState(false)

  function handleImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result)
    reader.readAsDataURL(file)
  }

  function handleLinkChange(e) {
    const value = e.target.value
    setLinkUrl(value)
    setLinkError('')
    // Sugerencia de supermercado a partir del dominio, solo si el campo
    // todavía está vacío — nunca pisa lo que el usuario ya haya escrito.
    if (!store.trim() && isValidHttpUrl(value)) {
      const guess = guessStoreFromUrl(value)
      if (guess) setStore(guess)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    const trimmedLink = linkUrl.trim()
    if (trimmedLink && !isValidHttpUrl(trimmedLink)) {
      setLinkError('El link debe ser una URL válida (empezando por http:// o https://).')
      return
    }
    setSaving(true)
    try {
      await onSubmit({
        name: name.trim(),
        store: store.trim() || null,
        storeLocation: storeLocation.trim() || null,
        usualQuantity: usualQuantity.trim() || null,
        recurring,
        estimatedPrice: estimatedPrice || null,
        note: note.trim() || null,
        linkUrl: trimmedLink || null,
        ...(imageFile ? { imageFile } : {})
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 mb-4 flex flex-col gap-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <input className="input" placeholder="Producto (ej. Leche)" value={name} onChange={(e) => setName(e.target.value)} required />
        <input
          className="input"
          placeholder="Cantidad habitual (ej. 2 unidades)"
          value={usualQuantity}
          onChange={(e) => setUsualQuantity(e.target.value)}
        />
        <input className="input" placeholder="Supermercado" value={store} onChange={(e) => setStore(e.target.value)} />
        <input
          className="input"
          placeholder="Ubicación (opcional)"
          value={storeLocation}
          onChange={(e) => setStoreLocation(e.target.value)}
        />
        <input
          className="input"
          type="number"
          step="0.01"
          min="0"
          placeholder="Precio estimado (opcional)"
          value={estimatedPrice}
          onChange={(e) => setEstimatedPrice(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-3">
        {imagePreview && <img src={imagePreview} alt="" className="w-14 h-14 object-cover rounded-lg shrink-0" />}
        <label className="btn-secondary text-sm cursor-pointer">
          {imagePreview ? 'Cambiar foto' : 'Añadir foto (opcional)'}
          <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleImageChange} />
        </label>
      </div>
      <label className="text-sm">
        Nota (opcional)
        <textarea
          className="input mt-1 min-h-16"
          value={note}
          maxLength={300}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ej. Comprar la versión sin gluten, o de marca blanca"
        />
        <span className="text-xs text-ink-900/40 dark:text-cream-100/40">{note.length}/300</span>
      </label>
      <label className="text-sm">
        Link del producto (opcional)
        <input
          className="input mt-1"
          type="url"
          value={linkUrl}
          onChange={handleLinkChange}
          placeholder="https://www.mercadona.es/..."
        />
        {linkError && <span className="text-xs font-medium text-clay-500 block mt-1">{linkError}</span>}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
        Producto recurrente (si no, queda como compra puntual)
      </label>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary text-sm" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary text-sm" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}

function ShoppingCard({ item, onEdit, onDelete, onSetStock, onPurchase }) {
  const [buying, setBuying] = useState(false)
  const [price, setPrice] = useState(item.estimatedPrice || '')
  const [addToPot, setAddToPot] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  async function confirmPurchase(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onPurchase({ price: price || null, addToPot: addToPot && !!price })
      setBuying(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`card p-4 flex flex-col gap-3 relative ${item.stockLevel === 'out' ? 'border-clay-500/50' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          {item.imageUrl && (
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="shrink-0 active:scale-95 transition-transform"
              title="Ver foto en grande"
            >
              <img src={item.imageUrl} alt="" className="w-12 h-12 object-cover rounded-lg" />
            </button>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-display font-semibold truncate">{item.name}</p>
              {!item.recurring && (
                <span className="text-[10px] uppercase font-bold text-violet-500 bg-violet-50 dark:bg-violet-700/25 px-1.5 py-0.5 rounded-md shrink-0">
                  Puntual
                </span>
              )}
            </div>
            {item.store && (
              <p className="flex items-center gap-1 text-xs text-ink-900/50 dark:text-cream-100/50 mt-0.5">
                <StoreIcon className="w-3 h-3 shrink-0" />
                {item.store}
                {item.storeLocation ? ` · ${item.storeLocation}` : ''}
              </p>
            )}
            {item.usualQuantity && <p className="text-xs text-ink-900/50 dark:text-cream-100/50">{item.usualQuantity}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            title="Editar"
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700"
          >
            <EditIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Eliminar"
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700 text-clay-500"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {(item.note || item.linkUrl) && (
        <div className="flex flex-col gap-1">
          {item.note && <p className="text-xs text-ink-900/60 dark:text-cream-100/60 line-clamp-2">{item.note}</p>}
          {item.linkUrl && (
            <a
              href={item.linkUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center gap-1 text-xs font-semibold text-violet-500 hover:underline py-1 -my-1 w-fit"
            >
              <LinkIcon className="w-3.5 h-3.5 shrink-0" />
              Ver producto{item.store ? ` en ${item.store}` : ''}
            </a>
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        {Object.entries(STOCK_META).map(([level, m]) => (
          <button
            key={level}
            type="button"
            onClick={() => onSetStock(level)}
            className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full transition-transform active:scale-95 ${
              item.stockLevel === level ? m.chip : 'text-ink-900/40 dark:text-cream-100/40 hover:bg-cream-200 dark:hover:bg-ink-700'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${item.stockLevel === level ? m.dot : 'bg-ink-900/20 dark:bg-cream-100/20'}`} />
            {m.label}
          </button>
        ))}
      </div>

      {buying ? (
        <form onSubmit={confirmPurchase} className="flex flex-col gap-2 pt-2 border-t border-ink-900/10 dark:border-cream-100/15">
          <input
            type="number"
            step="0.01"
            min="0"
            className="input text-sm"
            placeholder="Precio pagado (opcional)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <label className="flex items-center gap-2 text-xs text-ink-900/60 dark:text-cream-100/60">
            <input type="checkbox" checked={addToPot} disabled={!price} onChange={(e) => setAddToPot(e.target.checked)} />
            Registrar como gasto en el pote
          </label>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-xs flex-1" onClick={() => setBuying(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary text-xs flex-1" disabled={submitting}>
              {submitting ? 'Guardando…' : 'Confirmar'}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn-secondary text-sm" onClick={() => setBuying(true)}>
          Marcar como comprado
        </button>
      )}

      {lightboxOpen && item.imageUrl && (
        <div
          className="absolute inset-0 z-20 rounded-[inherit] bg-ink-900/90 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center bg-cream-100/20 text-cream-100 hover:bg-cream-100/30"
            title="Cerrar"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
          <img src={item.imageUrl} alt={item.name} className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </div>
  )
}
