import { useMemo, useState } from 'react'
import AppLayout from '../components/AppLayout'
import Reveal from '../components/Reveal'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { useLanguage } from '../context/LanguageContext'
import { currentPeriodKey } from '../lib/activities'
import {
  StoreIcon,
  AlertIcon,
  EditIcon,
  TrashIcon,
  CloseIcon,
  LinkIcon,
  CameraIcon,
  PlusIcon,
  MinusIcon,
  CartIcon,
  StampIcon
} from '../components/icons'
import { format } from 'date-fns'

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
  out: { labelKey: 'shopping.stockOut', dot: 'bg-clay-500', chip: 'bg-clay-100 dark:bg-clay-500/20 text-clay-500 border-2 border-clay-500/40', order: 0 },
  low: { labelKey: 'shopping.stockLow', dot: 'bg-gold-500', chip: 'bg-gold-100 dark:bg-gold-400/20 text-gold-500 border-2 border-gold-500/40', order: 1 },
  ok: { labelKey: 'shopping.stockOk', dot: 'bg-sage-500', chip: 'bg-sage-100 dark:bg-sage-500/20 text-sage-500 border-2 border-sage-500/40', order: 2 }
}

export default function Shopping() {
  const { user } = useAuth()
  const {
    members,
    activities,
    activityCompletions,
    weekKey,
    shoppingItems,
    shoppingPurchases,
    addShoppingItem,
    updateShoppingItem,
    removeShoppingItem,
    setItemStock,
    markItemPurchased,
    recordPurchaseSession
  } = useData()
  const { showToast } = useToast()
  const { t, dateLocale } = useLanguage()
  // 'menu' | 'buy' (Hacer la compra) | 'edit' (Preparar lista) | 'status'
  const [mode, setMode] = useState('menu')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showHistory, setShowHistory] = useState(false)

  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members])
  const comprasActivity = activities.find((a) => a.fixedKey === 'compras')
  const comprasPeriod = comprasActivity ? currentPeriodKey(comprasActivity, weekKey) : null
  const comprasCompletion = comprasPeriod
    ? activityCompletions.find((c) => c.activityId === comprasActivity.id && c.periodKey === comprasPeriod)
    : null
  const shopper = comprasCompletion ? memberById[comprasCompletion.assignedUserId] : null
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
  const pendingItems = useMemo(() => sortedItems.filter((i) => i.stockLevel !== 'ok'), [sortedItems])

  const history = useMemo(
    () => shoppingPurchases.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [shoppingPurchases]
  )

  async function handleFormSubmit(values) {
    if (editing) {
      await updateShoppingItem(editing.id, values)
      showToast(t('shopping.itemUpdatedToast'), 'success')
    } else {
      await addShoppingItem(values)
      showToast(t('shopping.itemAddedToast'), 'success')
    }
    setShowForm(false)
    setEditing(null)
  }

  async function handleAddOnTheFly(name) {
    return addShoppingItem({ name, recurring: false })
  }

  async function handleConfirmPurchase(payload) {
    await recordPurchaseSession(payload)
    showToast(t('shopping.purchaseRecordedToast'), 'success')
    setMode('menu')
  }

  return (
    <AppLayout title={t('shopping.title')}>
      {mode === 'menu' && (
        <MenuScreen
          pendingCount={pendingItems.length}
          outCount={outCount}
          totalCount={shoppingItems.length}
          onSelect={setMode}
          t={t}
        />
      )}

      {mode === 'buy' && (
        <BuyScreen
          items={pendingItems}
          onAddItem={handleAddOnTheFly}
          onConfirm={handleConfirmPurchase}
          onBack={() => setMode('menu')}
          t={t}
        />
      )}

      {mode === 'status' && (
        <StatusScreen items={sortedItems} onSetStock={setItemStock} onBack={() => setMode('menu')} t={t} />
      )}

      {mode === 'edit' && (
        <>
          <BackButton onBack={() => setMode('menu')} t={t} />

          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-lg font-bold">{t('shopping.listTitle')}</h2>
              {shopper && (
                <p className="text-sm text-ink-900/60 dark:text-cream-100/60">
                  {isShopper ? t('shopping.buysThisWeekYou') : t('shopping.buysThisWeekOther', { name: shopper.name })}
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
              {showForm && !editing ? t('shopping.cancel') : t('shopping.addProduct')}
            </button>
          </div>

          {outCount > 0 && (
            <Reveal>
              <OutOfStockBanner outCount={outCount} t={t} />
            </Reveal>
          )}

          {(showForm || editing) && (
            <ItemForm
              initial={editing}
              onCancel={() => {
                setShowForm(false)
                setEditing(null)
              }}
              onSubmit={handleFormSubmit}
              t={t}
            />
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
                    markItemPurchased(item.id, payload).then(() =>
                      showToast(t('shopping.itemPurchasedToast', { name: item.name }), 'success')
                    )
                  }
                  t={t}
                />
              </Reveal>
            ))}
            {sortedItems.length === 0 && (
              <p className="text-sm text-ink-900/50 dark:text-cream-100/50 col-span-full">{t('shopping.emptyList')}</p>
            )}
          </div>

          <div className="card p-5">
            <button type="button" className="flex items-center justify-between w-full" onClick={() => setShowHistory((s) => !s)}>
              <h3 className="font-display font-semibold">{t('shopping.purchaseHistoryTitle')}</h3>
              <span className="text-xs font-semibold text-violet-500">{showHistory ? t('shopping.hide') : t('shopping.show')}</span>
            </button>
            {showHistory &&
              (history.length === 0 ? (
                <p className="text-sm text-ink-900/50 dark:text-cream-100/50 mt-3">{t('shopping.noPurchasesYet')}</p>
              ) : (
                <ul className="flex flex-col gap-1 mt-3 max-h-72 overflow-y-auto">
                  {history.map((p) => (
                    <li
                      key={p.id}
                      className="flex justify-between text-sm py-1.5 border-b last:border-0 border-ink-900/10 dark:border-cream-100/15"
                    >
                      <span>{t('shopping.someoneBought', { name: memberById[p.userId]?.name || t('shopping.someone'), item: p.itemName })}</span>
                      <span className="text-ink-900/40 dark:text-cream-100/40 text-xs shrink-0 ml-2">
                        {p.price ? `${p.price}€ · ` : ''}
                        {format(new Date(p.createdAt), 'd MMM, HH:mm', { locale: dateLocale })}
                      </span>
                    </li>
                  ))}
                </ul>
              ))}
          </div>
        </>
      )}
    </AppLayout>
  )
}

/** Aviso de agotados: mismo lenguaje visual "urgente" que ya usa el
 * pop-up de compras pendientes de Inicio (borde grueso + halo de color
 * + insignia con pulso) — para que nadie lo pase por alto. */
function OutOfStockBanner({ outCount, t }) {
  return (
    <div className="card p-3.5 mb-4 flex items-center gap-3 border-[3px] border-clay-500 shadow-[0_0_0_4px_theme(colors.clay.100)] dark:shadow-[0_0_0_4px_theme(colors.clay.500/20%)]">
      <div className="w-10 h-10 rounded-full bg-clay-500 flex items-center justify-center shrink-0 animate-pulse">
        <AlertIcon className="w-5 h-5 text-white" />
      </div>
      <p className="text-sm sm:text-base font-extrabold text-clay-500">
        {t('shopping.outOfStockBanner', { count: outCount, plural: outCount > 1 ? 's' : '' })}
      </p>
    </div>
  )
}

function BackButton({ onBack, t }) {
  return (
    <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm font-semibold text-violet-500 hover:underline mb-4">
      {t('shopping.backToShopping')}
    </button>
  )
}

/** Pantalla de entrada: elegir la intención antes de mostrar nada más
 * (comprar / organizar la lista / chequear qué queda) — en vez de mezclar
 * las tres cosas en cada tarjeta como antes. */
function MenuScreen({ pendingCount, outCount, totalCount, onSelect, t }) {
  return (
    <div>
      <h2 className="font-display text-lg font-bold mb-1">{t('shopping.title')}</h2>
      <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-5">{t('shopping.whatToDo')}</p>

      {outCount > 0 && (
        <Reveal>
          <OutOfStockBanner outCount={outCount} t={t} />
        </Reveal>
      )}

      <div className="flex flex-col gap-4">
        <Reveal delay={0}>
          <MenuCard
            tone="coral"
            icon={CartIcon}
            title={t('shopping.buyMenuTitle')}
            subtitle={
              pendingCount > 0
                ? t('shopping.buyMenuSubtitlePending', { count: pendingCount, plural: pendingCount > 1 ? 's' : '' })
                : t('shopping.buyMenuSubtitleDone')
            }
            onClick={() => onSelect('buy')}
          />
        </Reveal>
        <Reveal delay={60}>
          <MenuCard
            tone="violet"
            icon={EditIcon}
            title={t('shopping.editMenuTitle')}
            subtitle={t('shopping.editMenuSubtitle', { count: totalCount, plural: totalCount === 1 ? '' : 's' })}
            onClick={() => onSelect('edit')}
          />
        </Reveal>
        <Reveal delay={120}>
          <MenuCard
            tone="sage"
            icon={StampIcon}
            title={t('shopping.statusMenuTitle')}
            subtitle={t('shopping.statusMenuSubtitle')}
            onClick={() => onSelect('status')}
          />
        </Reveal>
      </div>
    </div>
  )
}

const MENU_TONE_CLASSES = {
  coral: 'bg-gradient-to-br from-coral-500 to-[#E24322] text-white',
  violet: 'bg-gradient-to-br from-violet-500 to-[#4C36AD] text-white',
  sage: 'bg-gradient-to-br from-sage-500 to-[#2E8552] text-white'
}

function MenuCard({ tone, icon: Icon, title, subtitle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl p-5 flex items-center gap-4 border-2 border-ink-900 dark:border-cream-100/40 transition-transform active:scale-[0.98] ${MENU_TONE_CLASSES[tone]}`}
    >
      <div className="w-12 h-12 rounded-xl border-2 border-white/50 bg-white/20 flex items-center justify-center shrink-0">
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <p className="font-display font-bold text-lg">{title}</p>
        <p className="text-sm opacity-85">{subtitle}</p>
      </div>
    </button>
  )
}

/** "Status de productos": solo los 3 chips de stock, sin editar/borrar/
 * comprar — para que cualquier roomie actualice qué queda en casa sin
 * pasar por el flujo de compra. */
function StatusScreen({ items, onSetStock, onBack, t }) {
  return (
    <div>
      <BackButton onBack={onBack} t={t} />
      <h2 className="font-display text-lg font-bold mb-1">{t('shopping.statusTitle')}</h2>
      <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-4">{t('shopping.statusSubtitle')}</p>

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.id} className="card p-3 flex items-center justify-between gap-2 flex-wrap">
            <p className="font-display font-semibold">{item.name}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {Object.entries(STOCK_META).map(([level, m]) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => onSetStock(item.id, level)}
                  className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full transition-transform active:scale-95 ${
                    item.stockLevel === level ? m.chip : 'text-ink-900/40 dark:text-cream-100/40 hover:bg-cream-200 dark:hover:bg-ink-700'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${item.stockLevel === level ? m.dot : 'bg-ink-900/20 dark:bg-cream-100/20'}`} />
                  {t(m.labelKey)}
                </button>
              ))}
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-ink-900/50 dark:text-cream-100/50">{t('shopping.noProductsYet')}</p>}
      </div>
    </div>
  )
}

/** "Hacer la compra": lo agotado + por acabarse, con un contador de
 * cantidad por producto (en vez de checkbox), agregar algo no listado
 * sobre la marcha, un monto total del viaje y una foto de ticket
 * opcional — todo en un solo "Confirmar compra". */
function BuyScreen({ items, onAddItem, onConfirm, onBack, t }) {
  const { showToast } = useToast()
  const [quantities, setQuantities] = useState({})
  const [expanded, setExpanded] = useState(() => new Set())
  const [adHocItems, setAdHocItems] = useState([])
  const [addingNew, setAddingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const allItems = [...items, ...adHocItems]

  function inc(id) {
    setQuantities((q) => ({ ...q, [id]: (q[id] || 0) + 1 }))
  }
  function dec(id) {
    setQuantities((q) => ({ ...q, [id]: Math.max(0, (q[id] || 0) - 1) }))
  }
  function toggleInfo(id) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleAddNew(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    const created = await onAddItem(name)
    if (created) {
      setAdHocItems((list) => [...list, created])
      setQuantities((q) => ({ ...q, [created.id]: 1 }))
    }
    setNewName('')
    setAddingNew(false)
  }

  function handleReceiptChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setReceiptFile(file)
    const reader = new FileReader()
    reader.onload = () => setReceiptPreview(reader.result)
    reader.readAsDataURL(file)
  }

  const selectedIds = Object.entries(quantities)
    .filter(([, qty]) => qty > 0)
    .map(([id]) => id)

  async function handleConfirm() {
    if (selectedIds.length === 0) {
      showToast(t('shopping.markAtLeastOne'), 'error')
      return
    }
    setSubmitting(true)
    try {
      await onConfirm({ itemIds: selectedIds, totalAmount, receiptFile })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <BackButton onBack={onBack} t={t} />
      <h2 className="font-display text-lg font-bold mb-1">{t('shopping.buyScreenTitle')}</h2>
      <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-4">{t('shopping.buyScreenSubtitle')}</p>

      {allItems.length === 0 ? (
        <p className="text-sm text-ink-900/50 dark:text-cream-100/50 mb-4">{t('shopping.nothingToBuy')}</p>
      ) : (
        <div className="flex flex-col gap-2 mb-4">
          {allItems.map((item) => (
            <BuyItemRow
              key={item.id}
              item={item}
              qty={quantities[item.id] || 0}
              onInc={() => inc(item.id)}
              onDec={() => dec(item.id)}
              expanded={expanded.has(item.id)}
              onToggleInfo={() => toggleInfo(item.id)}
              t={t}
            />
          ))}
        </div>
      )}

      {addingNew ? (
        <form onSubmit={handleAddNew} className="flex gap-2 mb-5">
          <input
            className="input text-sm flex-1"
            autoFocus
            placeholder={t('shopping.productNamePlaceholder')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" className="btn-primary text-sm shrink-0">
            {t('shopping.add')}
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAddingNew(true)}
          className="btn-secondary text-sm w-full mb-5 flex items-center justify-center gap-1.5"
        >
          <PlusIcon className="w-3.5 h-3.5" /> {t('shopping.addUnlistedProduct')}
        </button>
      )}

      <div className="card p-4 flex flex-col gap-4 mb-5">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50 block mb-1">
            {t('shopping.amountToPay')}
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input"
            placeholder="€"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50 block mb-1">
            {t('shopping.receiptPhoto')}
          </label>
          {receiptPreview && (
            <img
              src={receiptPreview}
              alt=""
              className="w-full max-h-40 object-cover rounded-xl border-2 border-ink-900/70 dark:border-cream-100/30 mb-2"
            />
          )}
          <label className="btn-secondary text-sm cursor-pointer inline-flex items-center gap-1.5">
            <CameraIcon className="w-4 h-4" /> {receiptPreview ? t('shopping.changePhoto') : t('shopping.attachReceipt')}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleReceiptChange} />
          </label>
        </div>
      </div>

      <button type="button" className="btn-primary w-full" onClick={handleConfirm} disabled={submitting}>
        {submitting ? t('shopping.saving') : t('shopping.confirmPurchase')}
      </button>
    </div>
  )
}

function BuyItemRow({ item, qty, onInc, onDec, expanded, onToggleInfo, t }) {
  const meta = STOCK_META[item.stockLevel]
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className={`font-display font-semibold truncate ${qty > 0 ? 'line-through text-ink-900/40 dark:text-cream-100/40' : ''}`}>
              {item.name}
            </p>
            {meta && item.stockLevel !== 'ok' && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${meta.chip}`}>{t(meta.labelKey)}</span>
            )}
          </div>
          {(item.note || item.linkUrl) && (
            <button type="button" onClick={onToggleInfo} className="text-xs font-semibold text-violet-500 hover:underline mt-0.5">
              {expanded ? t('shopping.hideInfo') : t('shopping.moreInfo')}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {qty > 0 && (
            <>
              <button
                type="button"
                onClick={onDec}
                aria-label={t('shopping.decreaseAria')}
                className="w-7 h-7 rounded-full border-2 border-ink-900/70 dark:border-cream-100/30 flex items-center justify-center"
              >
                <MinusIcon className="w-3 h-3" />
              </button>
              <span className="w-5 text-center font-bold text-sm">{qty}</span>
            </>
          )}
          <button
            type="button"
            onClick={onInc}
            aria-label={t('shopping.increaseAria')}
            className="w-8 h-8 rounded-full bg-coral-500 border-2 border-ink-900 text-white flex items-center justify-center active:scale-90 transition-transform"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-ink-900/10 dark:border-cream-100/15 flex flex-col gap-1">
          {item.note && <p className="text-xs text-ink-900/60 dark:text-cream-100/60">{item.note}</p>}
          {item.linkUrl && (
            <a
              href={item.linkUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center gap-1 text-xs font-semibold text-violet-500 hover:underline w-fit"
            >
              <LinkIcon className="w-3.5 h-3.5" /> {t('shopping.viewProduct')}
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function ItemForm({ initial, onCancel, onSubmit, t }) {
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

  // Las filas de detalle empiezan abiertas solo si ya tenían algo cargado
  // (al editar); si no, quedan colapsadas detrás de un "+" para no saturar
  // el formulario con campos que la mayoría de las veces quedan vacíos.
  const [openRows, setOpenRows] = useState(() => {
    const open = new Set()
    if (initial?.storeLocation) open.add('ubicacion')
    if (initial?.usualQuantity) open.add('cantidad')
    if (initial?.estimatedPrice) open.add('precio')
    if (initial?.note) open.add('nota')
    if (initial?.linkUrl) open.add('link')
    return open
  })

  function toggleRow(key) {
    setOpenRows((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

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
      setLinkError(t('shopping.linkInvalid'))
      setOpenRows((prev) => new Set(prev).add('link'))
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
    <div className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm flex items-end sm:items-center sm:justify-center" onClick={onCancel}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md sm:rounded-2xl bg-cream-100 dark:bg-ink-800 border-t-[2.5px] sm:border-2 border-ink-900 dark:border-cream-100/40 rounded-t-2xl p-5 pb-8 sm:pb-5 max-h-[88vh] overflow-y-auto relative"
      >
        <div className="w-9 h-1.5 rounded-full bg-ink-900/15 dark:bg-cream-100/15 mx-auto mb-4 sm:hidden" />
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700"
          aria-label={t('shopping.closeAria')}
        >
          <CloseIcon className="w-4 h-4" />
        </button>

        <h2 className="font-display text-lg font-bold mb-4">{initial ? t('shopping.editItemTitle') : t('shopping.addItemTitle')}</h2>

        {/* Tarjeta del producto: foto + nombre + supermercado, siempre visibles */}
        <div className="bg-cream-200/60 dark:bg-ink-700/60 rounded-2xl p-4 flex flex-col items-center text-center mb-4">
          <div className="w-16 h-16 rounded-2xl border-2 border-ink-900/70 dark:border-cream-100/30 bg-coral-100 dark:bg-coral-500/20 flex items-center justify-center overflow-hidden mb-2">
            {imagePreview ? (
              <img src={imagePreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <CameraIcon className="w-6 h-6 text-coral-500" />
            )}
          </div>
          <input
            className="font-display font-semibold text-center bg-transparent border-none focus-visible:outline-none w-full mb-1 placeholder:text-ink-900/30 dark:placeholder:text-cream-100/30"
            placeholder={t('shopping.productNamePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="text-xs text-center bg-transparent border-none focus-visible:outline-none w-full text-ink-900/50 dark:text-cream-100/50 placeholder:text-ink-900/30 dark:placeholder:text-cream-100/30"
            placeholder={t('shopping.storeNamePlaceholder')}
            value={store}
            onChange={(e) => setStore(e.target.value)}
          />
          <label className="btn-secondary text-xs cursor-pointer mt-3">
            {imagePreview ? t('shopping.changePhoto') : t('shopping.addPhoto')}
            <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleImageChange} />
          </label>
        </div>

        <div className="flex flex-col">
          <ExpandRow label={t('shopping.locationLabel')} open={openRows.has('ubicacion')} onToggle={() => toggleRow('ubicacion')}>
            <input
              className="input"
              placeholder={t('shopping.locationPlaceholder')}
              value={storeLocation}
              onChange={(e) => setStoreLocation(e.target.value)}
            />
          </ExpandRow>
          <ExpandRow label={t('shopping.usualQtyLabel')} open={openRows.has('cantidad')} onToggle={() => toggleRow('cantidad')}>
            <input
              className="input"
              placeholder={t('shopping.usualQtyPlaceholder')}
              value={usualQuantity}
              onChange={(e) => setUsualQuantity(e.target.value)}
            />
          </ExpandRow>
          <ExpandRow label={t('shopping.estPriceLabel')} open={openRows.has('precio')} onToggle={() => toggleRow('precio')}>
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              placeholder="€"
              value={estimatedPrice}
              onChange={(e) => setEstimatedPrice(e.target.value)}
            />
          </ExpandRow>
          <ExpandRow label={t('shopping.noteLabel')} open={openRows.has('nota')} onToggle={() => toggleRow('nota')}>
            <textarea
              className="input min-h-16"
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('shopping.notePlaceholder')}
            />
            <span className="text-xs text-ink-900/40 dark:text-cream-100/40">{note.length}/300</span>
          </ExpandRow>
          <ExpandRow label={t('shopping.linkLabel')} open={openRows.has('link')} onToggle={() => toggleRow('link')}>
            <input className="input" type="url" value={linkUrl} onChange={handleLinkChange} placeholder="https://www.mercadona.es/..." />
            {linkError && <span className="text-xs font-medium text-clay-500 block mt-1">{linkError}</span>}
          </ExpandRow>
        </div>

        <label className="flex items-center gap-2 text-sm mt-4">
          <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
          {t('shopping.recurringCheckbox')}
        </label>

        <button type="submit" className="btn-primary text-sm w-full mt-5" disabled={saving}>
          {saving ? t('shopping.saving') : t('shopping.saveChanges')}
        </button>
      </form>
    </div>
  )
}

/** Fila de detalle colapsable: toca el encabezado para mostrar/ocultar el
 * campo. El "+" gira 45° (queda como "×") cuando está abierta. */
function ExpandRow({ label, open, onToggle, children }) {
  return (
    <div className="border-b border-ink-900/10 dark:border-cream-100/15 last:border-0">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between py-3 text-sm font-semibold">
        {label}
        <span
          className={`w-5 h-5 rounded-full border-2 border-ink-900/70 dark:border-cream-100/30 flex items-center justify-center shrink-0 transition-transform ${open ? 'rotate-45' : ''}`}
        >
          <PlusIcon className="w-2.5 h-2.5" />
        </span>
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  )
}

function ShoppingCard({ item, onEdit, onDelete, onSetStock, onPurchase, t }) {
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
              title={t('shopping.viewPhotoTitle')}
            >
              <img src={item.imageUrl} alt="" className="w-12 h-12 object-cover rounded-lg" />
            </button>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-display font-semibold truncate">{item.name}</p>
              {!item.recurring && (
                <span className="text-[10px] uppercase font-bold text-violet-500 bg-violet-50 dark:bg-violet-700/25 px-1.5 py-0.5 rounded-md shrink-0">
                  {t('shopping.oneTimeTag')}
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
            title={t('shopping.editTitle')}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700"
          >
            <EditIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title={t('shopping.deleteTitle')}
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
              {item.store ? t('shopping.viewProductAt', { store: item.store }) : t('shopping.viewProduct')}
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
            {t(m.labelKey)}
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
            placeholder={t('shopping.pricePaidPlaceholder')}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <label className="flex items-center gap-2 text-xs text-ink-900/60 dark:text-cream-100/60">
            <input type="checkbox" checked={addToPot} disabled={!price} onChange={(e) => setAddToPot(e.target.checked)} />
            {t('shopping.logAsPotExpense')}
          </label>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-xs flex-1" onClick={() => setBuying(false)}>
              {t('shopping.cancel')}
            </button>
            <button type="submit" className="btn-primary text-xs flex-1" disabled={submitting}>
              {submitting ? t('shopping.saving') : t('shopping.confirm')}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn-secondary text-sm" onClick={() => setBuying(true)}>
          {t('shopping.markPurchased')}
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
            title={t('shopping.closePhotoTitle')}
          >
            <CloseIcon className="w-4 h-4" />
          </button>
          <img src={item.imageUrl} alt={item.name} className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </div>
  )
}
